import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UsuarioRow } from '../common/usuario.util';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateRequestDto } from './dto/create-request.dto';
import { UpdateRequestStatusDto } from './dto/update-request-status.dto';
import {
  actorPuede,
  ESTADO_SOLICITUD_INICIAL,
  EstadoSolicitud,
  normalizeEstado,
  resolveTransition,
  writeCandidates,
} from './request-state';

type SolicitudRow = {
  id_solicitud: number;
  id_cliente: number;
  id_trabajador: number;
  id_servicio: number;
  descripcion: string;
  ubicacion_aprox: string | null;
  fecha_deseada: string | null;
  estado: string;
  urgente: boolean;
};

type PerfilRow = {
  id_perfil: number;
  id_usuario: number;
  oficio_principal: string;
  disponibilidad: string | null;
};

type ServicioRow = {
  id_servicio: number;
  id_perfil: number;
  id_categoria: number;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
};

@Injectable()
export class RequestsService {
  constructor(private readonly supabase: SupabaseService) {}

  async create(cliente: UsuarioRow, dto: CreateRequestDto) {
    const perfil = await this.findPerfil(dto.id_trabajador);
    if (!perfil) {
      throw new NotFoundException('El trabajador indicado no existe.');
    }
    if (perfil.id_usuario === cliente.id_usuario) {
      throw new ForbiddenException('No puedes enviarte una solicitud a ti mismo.');
    }

    const dueno = await this.findUsuario(perfil.id_usuario);
    if (!dueno || !dueno.modo_activo || dueno.estado !== 'ACTIVO') {
      throw new BadRequestException('Ese trabajador no está disponible para nuevas solicitudes.');
    }

    const servicio = await this.findServicio(dto.id_servicio);
    if (!servicio || !servicio.activo) {
      throw new NotFoundException('El servicio indicado no existe o no está activo.');
    }
    if (servicio.id_perfil !== perfil.id_perfil) {
      throw new BadRequestException('Ese servicio no pertenece al trabajador seleccionado.');
    }

    const payload = {
      id_cliente: cliente.id_usuario,
      id_trabajador: perfil.id_perfil,
      id_servicio: servicio.id_servicio,
      descripcion: dto.descripcion.trim(),
      ubicacion_aprox: dto.ubicacion_aprox?.trim() || null,
      fecha_deseada: dto.fecha_deseada || null,
      estado: ESTADO_SOLICITUD_INICIAL,
      urgente: Boolean(dto.urgente),
    };

    const saved = await this.insertSolicitudWithEstado(payload);
    await this.registrarBitacora(cliente.id_usuario, 'CREATE_REQUEST', 'solicitud_servicio');
    return this.present(saved, perfil, servicio);
  }

  async listClient(cliente: UsuarioRow) {
    const rows = await this.findRequests('id_cliente', cliente.id_usuario);
    return this.presentMany(rows);
  }

  async listWorker(usuario: UsuarioRow) {
    const perfil = await this.findPerfilByUser(usuario.id_usuario);
    if (!perfil) {
      throw new NotFoundException('Aún no tienes un perfil de trabajador.');
    }
    const rows = await this.findRequests('id_trabajador', perfil.id_perfil);
    return this.presentMany(rows);
  }

  async updateStatus(usuario: UsuarioRow, idSolicitud: number, dto: UpdateRequestStatusDto) {
    const solicitud = await this.findSolicitud(idSolicitud);
    if (!solicitud) {
      throw new NotFoundException('La solicitud no existe.');
    }

    const perfil = await this.findPerfil(solicitud.id_trabajador);
    if (!perfil) {
      throw new NotFoundException('El trabajador de la solicitud ya no existe.');
    }

    const esCliente = solicitud.id_cliente === usuario.id_usuario;
    const esTrabajador = perfil.id_usuario === usuario.id_usuario;
    if (!esCliente && !esTrabajador) {
      throw new ForbiddenException('No puedes cambiar el estado de esta solicitud.');
    }

    const transicion = resolveTransition(solicitud.estado, dto.accion);
    if (!transicion.ok) {
      throw new BadRequestException(transicion.mensaje);
    }
    if (!actorPuede(transicion.rol, esCliente, esTrabajador)) {
      throw new ForbiddenException(
        `Solo el ${transicion.rol === 'trabajador' ? 'trabajador' : 'cliente'} puede ${dto.accion.toLowerCase()} esta solicitud.`,
      );
    }

    const saved =
      (await this.updateStatusViaRpc(idSolicitud, usuario.id_usuario, dto.accion)) ||
      (await this.updateStatusLocked(solicitud, transicion.next));
    saved.estado = transicion.next;

    const servicio = await this.findServicio(saved.id_servicio);
    await this.registrarBitacora(
      usuario.id_usuario,
      `STATUS_${dto.accion.toUpperCase()}`,
      'solicitud_servicio',
    );
    return this.present(saved, perfil, servicio);
  }

  private async updateStatusViaRpc(idSolicitud: number, idActor: number, accion: string) {
    const { data, error } = await this.supabase.admin.rpc('cambiar_estado_solicitud', {
      p_id_solicitud: idSolicitud,
      p_id_actor: idActor,
      p_accion: accion,
    });

    if (error) {
      if (this.isMissingRpc(error.message)) return null;
      if (/INVALID_TRANSITION/i.test(error.message)) {
        throw new BadRequestException(error.message.replace(/^INVALID_TRANSITION:\s*/i, ''));
      }
      if (/FORBIDDEN/i.test(error.message)) {
        throw new ForbiddenException('No puedes cambiar el estado de esta solicitud.');
      }
      if (/INVALID_ACTION/i.test(error.message)) {
        throw new BadRequestException('La acción debe ser Aceptar, Rechazar, Iniciar, Cancelar o Finalizar.');
      }
      if (/NOT_FOUND/i.test(error.message)) {
        throw new NotFoundException('La solicitud no existe.');
      }
      if (/CONFLICT|40001/i.test(error.message)) {
        throw new ConflictException('La solicitud cambió de estado. Recarga e inténtalo de nuevo.');
      }
      throw new BadRequestException(error.message);
    }

    if (!data) return null;
    return data as SolicitudRow;
  }

  private async updateStatusLocked(solicitud: SolicitudRow, next: EstadoSolicitud) {
    let lastCheckError: string | undefined;
    for (const estado of writeCandidates(next)) {
      const { data, error } = await this.supabase
        .from('solicitud_servicio')
        .update({ estado })
        .eq('id_solicitud', solicitud.id_solicitud)
        .eq('estado', solicitud.estado)
        .select('*')
        .maybeSingle();

      if (error && this.isEstadoCheckError(error.message)) {
        lastCheckError = error.message;
        continue;
      }
      if (error) throw new BadRequestException(error.message);
      if (!data) {
        throw new ConflictException('La solicitud cambió de estado. Recarga e inténtalo de nuevo.');
      }
      return data as SolicitudRow;
    }
    throw new BadRequestException(
      lastCheckError || 'El estado de la solicitud no es compatible con la base de datos.',
    );
  }

  private async insertSolicitudWithEstado(payload: Record<string, unknown>) {
    let lastCheckError: string | undefined;
    for (const estado of writeCandidates('Enviada')) {
      try {
        return await this.insertSolicitud({ ...payload, estado });
      } catch (error) {
        if (error instanceof BadRequestException && this.isEstadoCheckError(error.message)) {
          lastCheckError = error.message;
          continue;
        }
        throw error;
      }
    }
    throw new BadRequestException(
      lastCheckError || 'No se pudo crear la solicitud con un estado inicial válido.',
    );
  }

  private isEstadoCheckError(message?: string) {
    return /chk_solicitud_estado|check constraint/i.test(message || '');
  }

  private async presentMany(rows: SolicitudRow[]) {
    const profileIds = [...new Set(rows.map((row) => row.id_trabajador))];
    const serviceIds = [...new Set(rows.map((row) => row.id_servicio))];
    const clientIds = [...new Set(rows.map((row) => row.id_cliente))];
    const requestIds = rows.map((row) => row.id_solicitud);
    const [profiles, services, clients, reviews] = await Promise.all([
      this.loadMap('perfil_trabajador', 'id_perfil', profileIds, 'id_perfil, id_usuario, oficio_principal, disponibilidad'),
      this.loadMap('servicio_ofrecido', 'id_servicio', serviceIds, 'id_servicio, id_perfil, nombre, descripcion, activo'),
      this.loadMap('usuario', 'id_usuario', clientIds, 'id_usuario, nombre, telefono'),
      this.loadMap('resena', 'id_solicitud', requestIds, 'id_resena, id_solicitud, calificacion, comentario, fecha'),
    ]);
    const ownerIds = [...new Set([...profiles.values()].map((profile) => Number(profile.id_usuario)))];
    const owners = await this.loadMap('usuario', 'id_usuario', ownerIds, 'id_usuario, nombre, telefono');
    return rows.map((row) => {
      const profile = profiles.get(row.id_trabajador);
      const service = services.get(row.id_servicio);
      const client = clients.get(row.id_cliente);
      const owner = profile ? owners.get(Number(profile.id_usuario)) : null;
      const review = reviews.get(row.id_solicitud);
      return {
        ...row,
        estado: normalizeEstado(row.estado),
        cliente: client ? { id_usuario: client.id_usuario, nombre: client.nombre, telefono: client.telefono } : null,
        trabajador: profile ? { id_perfil: profile.id_perfil, id_usuario: profile.id_usuario, nombre: owner?.nombre || 'Trabajador', oficio_principal: profile.oficio_principal } : null,
        servicio: service ? { id_servicio: service.id_servicio, nombre: service.nombre } : null,
        resena: review || null,
      };
    });
  }

  private async loadMap(table: string, key: string, ids: number[], select: string) {
    const map = new Map<number, Record<string, any>>();
    if (!ids.length) return map;
    const { data, error } = await this.supabase.from(table).select(select).in(key, ids);
    if (error) throw new BadRequestException(error.message);
    for (const row of data || []) map.set(Number((row as any)[key]), row as Record<string, any>);
    return map;
  }

  private async findRequests(key: 'id_cliente' | 'id_trabajador', value: number) {
    const { data, error } = await this.supabase
      .from('solicitud_servicio')
      .select('*')
      .eq(key, value)
      .order('id_solicitud', { ascending: false });
    if (error) throw new BadRequestException(error.message);
    return (data || []) as SolicitudRow[];
  }

  private async findPerfilByUser(idUsuario: number) {
    const { data, error } = await this.supabase
      .from('perfil_trabajador')
      .select('id_perfil, id_usuario, oficio_principal, disponibilidad')
      .eq('id_usuario', idUsuario)
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    return (data as PerfilRow) || null;
  }

  private present(row: SolicitudRow, perfil: PerfilRow, servicio: ServicioRow | null) {
    return {
      id_solicitud: row.id_solicitud,
      id_cliente: row.id_cliente,
      id_trabajador: row.id_trabajador,
      id_servicio: row.id_servicio,
      descripcion: row.descripcion,
      ubicacion_aprox: row.ubicacion_aprox,
      fecha_deseada: row.fecha_deseada,
      estado: normalizeEstado(row.estado),
      urgente: row.urgente,
      trabajador: {
        id_perfil: perfil.id_perfil,
        oficio_principal: perfil.oficio_principal,
      },
      servicio: servicio
        ? {
            id_servicio: servicio.id_servicio,
            nombre: servicio.nombre,
          }
        : null,
    };
  }

  private async findSolicitud(idSolicitud: number) {
    const { data, error } = await this.supabase
      .from('solicitud_servicio')
      .select('*')
      .eq('id_solicitud', idSolicitud)
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    return (data as SolicitudRow) || null;
  }

  private async findPerfil(idPerfil: number) {
    const { data, error } = await this.supabase
      .from('perfil_trabajador')
      .select('id_perfil, id_usuario, oficio_principal, disponibilidad')
      .eq('id_perfil', idPerfil)
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    return (data as PerfilRow) || null;
  }

  private async findServicio(idServicio: number) {
    const { data, error } = await this.supabase
      .from('servicio_ofrecido')
      .select('id_servicio, id_perfil, id_categoria, nombre, descripcion, activo')
      .eq('id_servicio', idServicio)
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    return (data as ServicioRow) || null;
  }

  private async findUsuario(idUsuario: number) {
    const { data, error } = await this.supabase
      .from('usuario')
      .select('id_usuario, modo_activo, estado')
      .eq('id_usuario', idUsuario)
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    return data as { id_usuario: number; modo_activo: boolean; estado: string } | null;
  }

  private async insertSolicitud(payload: Record<string, unknown>) {
    const { data, error } = await this.supabase
      .from('solicitud_servicio')
      .insert(payload)
      .select('*')
      .single();

    if (!error && data) return data as SolicitudRow;

    if (/null value in column ["']?id_solicitud["']?/i.test(error?.message || '')) {
      const nextId = await this.nextId('solicitud_servicio', 'id_solicitud');
      const { data: retry, error: retryError } = await this.supabase
        .from('solicitud_servicio')
        .insert({ ...payload, id_solicitud: nextId })
        .select('*')
        .single();
      if (retryError || !retry) {
        throw this.mapInsertError(retryError?.message);
      }
      return retry as SolicitudRow;
    }

    throw this.mapInsertError(error?.message);
  }

  private mapInsertError(message?: string): never {
    if (message && /duplicate|unique/i.test(message)) {
      throw new ConflictException('Ya existe una solicitud similar.');
    }
    throw new BadRequestException(message || 'No se pudo crear la solicitud.');
  }

  private async nextId(
    table: 'solicitud_servicio' | 'bitacora',
    pk: 'id_solicitud' | 'id_evento',
  ) {
    const { data } = await this.supabase
      .from(table)
      .select(pk)
      .order(pk, { ascending: false })
      .limit(1);
    const row = (data?.[0] || {}) as Record<string, number>;
    return (Number(row[pk]) || 0) + 1;
  }

  private async registrarBitacora(idActor: number, accion: string, recurso: string) {
    const payload = {
      id_actor: idActor,
      accion,
      recurso,
      origen: 'api/requests',
    };
    const { error } = await this.supabase.from('bitacora').insert(payload);
    if (!error) return;
    if (/null value in column ["']?id_evento["']?/i.test(error.message)) {
      const nextId = await this.nextId('bitacora', 'id_evento');
      await this.supabase.from('bitacora').insert({ ...payload, id_evento: nextId });
    }
  }

  private isMissingRpc(message?: string) {
    if (!message) return false;
    return /could not find the function|schema cache|does not exist|pgrst202/i.test(message);
  }
}
