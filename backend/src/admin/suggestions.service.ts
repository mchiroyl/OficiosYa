import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { UsuarioRow } from '../common/usuario.util';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateSuggestionDto } from './dto/create-suggestion.dto';

export type SugerenciaOficio = {
  id_sugerencia: number;
  id_usuario: number;
  nombre: string;
  descripcion: string | null;
  estado: string;
  fecha_creacion: string;
  autor?: { id_usuario: number; nombre: string; correo: string; rol?: string } | null;
};

@Injectable()
export class SuggestionsService {
  constructor(private readonly supabase: SupabaseService) {}

  async create(usuario: UsuarioRow, dto: CreateSuggestionDto) {
    const nombre = dto.nombre.trim();
    const existingCategory = await this.findCategoriaByNombre(nombre);
    if (existingCategory) {
      throw new ConflictException('Ese oficio ya está en el catálogo.');
    }

    const pending = await this.supabase
      .from('sugerencia_oficio')
      .select('id_sugerencia')
      .eq('id_usuario', usuario.id_usuario)
      .eq('estado', 'PENDIENTE')
      .ilike('nombre', nombre)
      .maybeSingle();

    if (pending.data) {
      throw new ConflictException('Ya enviaste una sugerencia pendiente con ese nombre.');
    }

    const payload = {
      id_usuario: usuario.id_usuario,
      nombre,
      descripcion: dto.descripcion?.trim() || null,
      estado: 'PENDIENTE',
    };

    const { data, error } = await this.supabase
      .from('sugerencia_oficio')
      .insert(payload)
      .select('*')
      .single();

    if (!error && data) {
      return {
        ...(data as SugerenciaOficio),
        message: 'Sugerencia enviada. Un administrador la revisará.',
      };
    }

    if (this.missingTable(error?.message)) {
      throw new BadRequestException(
        'Falta aplicar la migración de sugerencias de oficios (003_rol_admin_sugerencias.sql).',
      );
    }

    if (/null value in column ["']?id_sugerencia["']?/i.test(error?.message || '')) {
      const nextId = await this.nextId();
      const { data: retry, error: retryError } = await this.supabase
        .from('sugerencia_oficio')
        .insert({ ...payload, id_sugerencia: nextId })
        .select('*')
        .single();
      if (retryError || !retry) {
        throw new BadRequestException(retryError?.message || 'No se pudo enviar la sugerencia.');
      }
      return {
        ...(retry as SugerenciaOficio),
        message: 'Sugerencia enviada. Un administrador la revisará.',
      };
    }

    throw new BadRequestException(error?.message || 'No se pudo enviar la sugerencia.');
  }

  async listMine(usuario: UsuarioRow) {
    const { data, error } = await this.supabase
      .from('sugerencia_oficio')
      .select('*')
      .eq('id_usuario', usuario.id_usuario)
      .order('fecha_creacion', { ascending: false });

    if (error) {
      if (this.missingTable(error.message)) return [];
      throw new BadRequestException(error.message);
    }
    return (data || []) as SugerenciaOficio[];
  }

  async listAll(estado?: string) {
    let builder = this.supabase.from('sugerencia_oficio').select('*').order('fecha_creacion', {
      ascending: false,
    });
    if (estado && estado !== 'todos') {
      builder = builder.eq('estado', estado.toUpperCase());
    }

    const { data, error } = await builder;
    if (error) {
      if (this.missingTable(error.message)) {
        throw new BadRequestException(
          'Falta aplicar la migración de sugerencias de oficios (003_rol_admin_sugerencias.sql).',
        );
      }
      throw new BadRequestException(error.message);
    }

    const rows = (data || []) as SugerenciaOficio[];
    const userIds = [...new Set(rows.map((row) => Number(row.id_usuario)))];
    const authors = await this.loadUsers(userIds);
    return rows.map((row) => ({
      ...row,
      autor: authors.get(Number(row.id_usuario)) || null,
    }));
  }

  async review(admin: UsuarioRow, id: number, accion: 'aprobar' | 'rechazar', motivo?: string) {
    const current = await this.findById(id);
    if (current.estado !== 'PENDIENTE') {
      throw new ConflictException('Esta sugerencia ya fue revisada.');
    }

    if (accion === 'aprobar') {
      await this.ensureCategoria(current.nombre);
    }

    const estado = accion === 'aprobar' ? 'APROBADA' : 'RECHAZADA';
    const { data, error } = await this.supabase
      .from('sugerencia_oficio')
      .update({ estado })
      .eq('id_sugerencia', id)
      .select('*')
      .single();

    if (error || !data) {
      throw new BadRequestException(error?.message || 'No se pudo actualizar la sugerencia.');
    }

    await this.supabase.from('bitacora').insert({
      id_actor: admin.id_usuario,
      accion: accion === 'aprobar' ? 'ADMIN_APROBAR_OFICIO' : 'ADMIN_RECHAZAR_OFICIO',
      recurso: 'sugerencia_oficio',
      origen: 'api/admin',
    });

    return {
      ...(data as SugerenciaOficio),
      motivo: motivo?.trim() || null,
      message:
        accion === 'aprobar'
          ? 'Oficio aprobado y agregado al catálogo.'
          : 'Sugerencia rechazada.',
    };
  }

  private async findById(id: number) {
    const { data, error } = await this.supabase
      .from('sugerencia_oficio')
      .select('*')
      .eq('id_sugerencia', id)
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!data) throw new NotFoundException('Sugerencia no encontrada.');
    return data as SugerenciaOficio;
  }

  private async findCategoriaByNombre(nombre: string) {
    const { data, error } = await this.supabase
      .from('categoria')
      .select('id_categoria, nombre')
      .ilike('nombre', nombre)
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  private async ensureCategoria(nombre: string) {
    const existing = await this.findCategoriaByNombre(nombre);
    if (existing) {
      await this.supabase
        .from('categoria')
        .update({ estado: 'ACTIVA' })
        .eq('id_categoria', (existing as { id_categoria: number }).id_categoria);
      return existing;
    }

    const payload = { nombre, estado: 'ACTIVA' };
    const { data, error } = await this.supabase.from('categoria').insert(payload).select('*').single();
    if (!error && data) return data;

    if (/null value in column ["']?id_categoria["']?/i.test(error?.message || '')) {
      const { data: last } = await this.supabase
        .from('categoria')
        .select('id_categoria')
        .order('id_categoria', { ascending: false })
        .limit(1);
      const nextId = (last?.[0]?.id_categoria || 0) + 1;
      const { data: retry, error: retryError } = await this.supabase
        .from('categoria')
        .insert({ ...payload, id_categoria: nextId })
        .select('*')
        .single();
      if (retryError || !retry) {
        throw new BadRequestException(retryError?.message || 'No se pudo crear la categoría.');
      }
      return retry;
    }

    if (/duplicate|unique/i.test(error?.message || '')) {
      return this.findCategoriaByNombre(nombre);
    }
    throw new BadRequestException(error?.message || 'No se pudo crear la categoría.');
  }

  private async loadUsers(ids: number[]) {
    const map = new Map<number, { id_usuario: number; nombre: string; correo: string; rol?: string }>();
    if (!ids.length) return map;
    const { data } = await this.supabase
      .from('usuario')
      .select('id_usuario, nombre, correo, rol')
      .in('id_usuario', ids);
    for (const row of data || []) {
      map.set(Number(row.id_usuario), row as { id_usuario: number; nombre: string; correo: string; rol?: string });
    }
    return map;
  }

  private async nextId() {
    const { data } = await this.supabase
      .from('sugerencia_oficio')
      .select('id_sugerencia')
      .order('id_sugerencia', { ascending: false })
      .limit(1);
    return (data?.[0]?.id_sugerencia || 0) + 1;
  }

  private missingTable(message?: string) {
    return /sugerencia_oficio/i.test(message || '') && /does not exist|schema cache|could not find/i.test(message || '');
  }
}
