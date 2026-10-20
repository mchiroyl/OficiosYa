import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { UsuarioRow } from '../common/usuario.util';
import { SupabaseService } from '../supabase/supabase.service';
import { ResourceConfig } from './resources.config';

@Injectable()
export class ResourceService {
  constructor(private readonly supabase: SupabaseService) {}

  async findAll(config: ResourceConfig, query: Record<string, string>, user?: UsuarioRow) {
    this.assertReadable(config);
    if (config.anonFilter && !user && !query[config.anonFilter]) {
      return [];
    }
    let builder = this.supabase.from(config.table).select('*');

    for (const [key, value] of Object.entries(query)) {
      if (['select', 'limit', 'offset', 'order'].includes(key)) continue;
      if (value === undefined || value === '') continue;
      builder = builder.eq(key, value);
    }

    if (query.limit) builder = builder.limit(Number(query.limit));
    if (query.offset) {
      const from = Number(query.offset);
      const to = from + Number(query.limit || 50) - 1;
      builder = builder.range(from, to);
    }
    if (query.order) {
      const [column, direction] = query.order.split(':');
      builder = builder.order(column, { ascending: direction !== 'desc' });
    }

    const { data, error } = await builder;
    if (error) throw new BadRequestException(error.message);
    return this.sanitize(config, data || []);
  }

  async findOne(config: ResourceConfig, keys: Record<string, string | number>) {
    this.assertReadable(config);
    let builder = this.supabase.from(config.table).select('*');
    for (const [key, value] of Object.entries(keys)) {
      builder = builder.eq(key, value);
    }

    const { data, error } = await builder.maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!data) throw new NotFoundException('Recurso no encontrado.');
    return this.sanitize(config, data);
  }

  async create(config: ResourceConfig, body: Record<string, unknown>, user?: UsuarioRow) {
    this.assertWritable(config);
    if (config.denyCreate) {
      throw new ForbiddenException('Este recurso no se puede crear por esta vía.');
    }
    const payload = await this.applyOwnerOnCreate(config, this.stripHidden(config, body), user);
    const { data, error } = await this.supabase
      .from(config.table)
      .insert(payload)
      .select('*')
      .single();

    if (!error && data) return this.sanitize(config, data);

    if (this.needsGeneratedId(config, error?.message)) {
      const pk = Array.isArray(config.pk) ? null : config.pk;
      if (!pk) throw new BadRequestException(error?.message);
      const nextId = await this.nextId(config.table, pk);
      const { data: retry, error: retryError } = await this.supabase
        .from(config.table)
        .insert({ ...payload, [pk]: nextId })
        .select('*')
        .single();
      if (retryError || !retry) {
        throw new BadRequestException(retryError?.message || 'No se pudo crear el recurso.');
      }
      return this.sanitize(config, retry);
    }

    throw this.mapWriteError(error?.message, 'No se pudo crear el recurso.');
  }

  async update(
    config: ResourceConfig,
    keys: Record<string, string | number>,
    body: Record<string, unknown>,
    user?: UsuarioRow,
  ) {
    this.assertWritable(config);
    const current = await this.findOne(config, keys);
    await this.assertOwner(config, current as Record<string, unknown>, user);
    const payload = this.stripOwnerFields(config, this.stripHidden(config, body));

    let builder = this.supabase.from(config.table).update(payload);
    for (const [key, value] of Object.entries(keys)) {
      builder = builder.eq(key, value);
    }

    const { data, error } = await builder.select('*').single();
    if (error || !data) {
      throw this.mapWriteError(error?.message, 'No se pudo actualizar el recurso.');
    }
    return this.sanitize(config, data);
  }

  async remove(config: ResourceConfig, keys: Record<string, string | number>, user?: UsuarioRow) {
    this.assertWritable(config);
    const current = await this.findOne(config, keys);
    await this.assertOwner(config, current as Record<string, unknown>, user);

    let builder = this.supabase.from(config.table).delete();
    for (const [key, value] of Object.entries(keys)) {
      builder = builder.eq(key, value);
    }

    const { error } = await builder;
    if (error) throw this.mapWriteError(error.message, 'No se pudo eliminar el recurso.');
    return { message: 'Recurso eliminado.' };
  }

  private assertReadable(config: ResourceConfig) {
    if (config.table === 'reporte') {
      throw new ForbiddenException('Consulta las denuncias en GET /api/admin/reports.');
    }
  }

  private assertWritable(config: ResourceConfig) {
    if (!config.denyMutations) return;
    if (config.table === 'solicitud_servicio') {
      throw new ForbiddenException(
        'El estado de una solicitud solo cambia con PUT /api/requests/{id}/status.',
      );
    }
    if (config.table === 'resena') {
      throw new ForbiddenException('Las reseñas se crean con POST /api/reviews/create.');
    }
    if (config.table === 'reporte') {
      throw new ForbiddenException(
        'Los reportes se crean con POST /api/reports/create y se gestionan en /api/admin/reports.',
      );
    }
    if (config.table === 'mensaje') {
      throw new ForbiddenException(
        'Los mensajes se envían por POST /api/chat/threads/:id/messages o el WebSocket /chat.',
      );
    }
    if (config.table === 'portafolio') {
      throw new ForbiddenException(
        'Las fotos se suben con POST /api/portfolio/upload y se eliminan con DELETE /api/portfolio/{id}.',
      );
    }
    if (config.table === 'bitacora') {
      throw new ForbiddenException('La bitácora es de solo lectura.');
    }
    throw new ForbiddenException('Este recurso no admite altas, cambios ni bajas por esta vía.');
  }

  private async applyOwnerOnCreate(
    config: ResourceConfig,
    payload: Record<string, unknown>,
    user?: UsuarioRow,
  ) {
    if (!config.owner) return payload;
    if (!user) throw new ForbiddenException('Debes iniciar sesión.');

    if (config.owner.via === 'user') {
      const requested = payload[config.owner.field];
      if (requested != null && Number(requested) !== user.id_usuario) {
        throw new ForbiddenException('No puedes crear recursos de otra cuenta.');
      }
      return { ...payload, [config.owner.field]: user.id_usuario };
    }

    const profileId = await this.findOwnProfileId(user.id_usuario);
    if (!profileId) {
      throw new ForbiddenException('Necesitas un perfil de trabajador.');
    }
    const requested = payload[config.owner.field];
    if (requested != null && Number(requested) !== profileId) {
      throw new ForbiddenException('No puedes crear recursos de otro trabajador.');
    }
    return { ...payload, [config.owner.field]: profileId };
  }

  private async assertOwner(
    config: ResourceConfig,
    row: Record<string, unknown>,
    user?: UsuarioRow,
  ) {
    if (!config.owner) return;
    if (!user) throw new ForbiddenException('Debes iniciar sesión.');

    if (config.owner.via === 'user') {
      if (Number(row[config.owner.field]) !== user.id_usuario) {
        throw new ForbiddenException('No puedes modificar un recurso de otra cuenta.');
      }
      return;
    }

    const profileId = await this.findOwnProfileId(user.id_usuario);
    if (!profileId || Number(row[config.owner.field]) !== profileId) {
      throw new ForbiddenException('No puedes modificar un recurso de otro trabajador.');
    }
  }

  private stripOwnerFields(config: ResourceConfig, payload: Record<string, unknown>) {
    if (!config.owner) return payload;
    const copy = { ...payload };
    delete copy[config.owner.field];
    delete copy.id_usuario;
    delete copy.id_perfil;
    return copy;
  }

  private async findOwnProfileId(idUsuario: number) {
    const { data, error } = await this.supabase
      .from('perfil_trabajador')
      .select('id_perfil')
      .eq('id_usuario', idUsuario)
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    return data ? Number((data as { id_perfil: number }).id_perfil) : null;
  }

  private mapWriteError(message: string | undefined, fallback: string): never {
    if (/foreign key constraint|violates foreign key/i.test(message || '')) {
      throw new BadRequestException(
        'No se puede eliminar porque hay solicitudes u otros registros asociados.',
      );
    }
    throw new BadRequestException(message || fallback);
  }

  private sanitize(config: ResourceConfig, data: unknown) {
    if (Array.isArray(data)) {
      return data.map((row) => this.sanitize(config, row));
    }
    if (!data || typeof data !== 'object') return data;
    const copy = { ...(data as Record<string, unknown>) };
    for (const field of config.hiddenFields || []) {
      delete copy[field];
    }
    return copy;
  }

  private stripHidden(config: ResourceConfig, body: Record<string, unknown>) {
    const copy = { ...body };
    const protectedFields = new Set(config.protectedFields || []);
    let removedProtected = false;
    for (const field of [...(config.hiddenFields || []), ...protectedFields]) {
      if (field in copy) {
        if (protectedFields.has(field)) removedProtected = true;
        delete copy[field];
      }
    }
    if (!Object.keys(copy).length && removedProtected) {
      throw new BadRequestException(
        'El estado de una cuenta solo cambia con PATCH /api/admin/usuarios/{id}/sancion.',
      );
    }
    return copy;
  }

  private needsGeneratedId(config: ResourceConfig, message?: string) {
    if (!message || Array.isArray(config.pk)) return false;
    return new RegExp(`null value in column ["']?${config.pk}["']?`, 'i').test(message);
  }

  private async nextId(table: string, pk: string) {
    const { data } = await this.supabase
      .from(table)
      .select(pk)
      .order(pk, { ascending: false })
      .limit(1);
    return (Number(data?.[0]?.[pk]) || 0) + 1;
  }
}
