import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UsuarioRow } from '../common/usuario.util';
import { normalizeEstado } from '../requests/request-state';
import { SupabaseService } from '../supabase/supabase.service';
import { parseProfileExtras, serializeProfileExtras } from '../worker/worker-profile.codec';
import { CreateReviewDto } from './dto/create-review.dto';

type SolicitudRow = {
  id_solicitud: number;
  id_cliente: number;
  id_trabajador: number;
  id_servicio: number;
  estado: string;
};

type ResenaRow = {
  id_resena: number;
  id_solicitud: number;
  id_cliente: number;
  id_trabajador: number;
  calificacion: number;
  comentario: string | null;
  respuesta: string | null;
  fecha: string;
};

@Injectable()
export class ReviewsService {
  constructor(private readonly supabase: SupabaseService) {}

  async create(cliente: UsuarioRow, dto: CreateReviewDto) {
    const solicitud = await this.findSolicitud(dto.id_solicitud);
    if (!solicitud) {
      throw new NotFoundException('La solicitud no existe.');
    }
    if (solicitud.id_cliente !== cliente.id_usuario) {
      throw new ForbiddenException('Solo el cliente de la solicitud puede dejar una reseña.');
    }
    if (normalizeEstado(solicitud.estado) !== 'Finalizada') {
      throw new BadRequestException(
        `Solo puedes calificar una solicitud Finalizada. Estado actual: ${normalizeEstado(solicitud.estado)}.`,
      );
    }

    const existing = await this.findBySolicitud(solicitud.id_solicitud);
    if (existing) {
      throw new ConflictException('Esta solicitud ya tiene una reseña.');
    }

    const saved = await this.insertResena({
      id_solicitud: solicitud.id_solicitud,
      id_cliente: cliente.id_usuario,
      id_trabajador: solicitud.id_trabajador,
      calificacion: dto.calificacion,
      comentario: dto.comentario?.trim() || null,
    });

    const promedio = await this.refreshPromedio(solicitud.id_trabajador);
    await this.registrarBitacora(cliente.id_usuario, 'CREATE_REVIEW', 'resena');

    return {
      ...this.present(saved),
      trabajador: {
        id_perfil: solicitud.id_trabajador,
        reputacion_promedio: promedio.reputacion,
        total_resenas: promedio.total_resenas,
      },
    };
  }

  private present(row: ResenaRow) {
    return {
      id_resena: row.id_resena,
      id_solicitud: row.id_solicitud,
      id_cliente: row.id_cliente,
      id_trabajador: row.id_trabajador,
      calificacion: row.calificacion,
      comentario: row.comentario,
      fecha: row.fecha,
    };
  }

  private async findSolicitud(idSolicitud: number) {
    const { data, error } = await this.supabase
      .from('solicitud_servicio')
      .select('id_solicitud, id_cliente, id_trabajador, id_servicio, estado')
      .eq('id_solicitud', idSolicitud)
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    return (data as SolicitudRow) || null;
  }

  private async findBySolicitud(idSolicitud: number) {
    const { data, error } = await this.supabase
      .from('resena')
      .select('id_resena')
      .eq('id_solicitud', idSolicitud)
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  private async insertResena(payload: Record<string, unknown>) {
    const { data, error } = await this.supabase
      .from('resena')
      .insert(payload)
      .select('*')
      .single();

    if (!error && data) return data as ResenaRow;

    if (/null value in column ["']?id_resena["']?/i.test(error?.message || '')) {
      const nextId = await this.nextId('resena', 'id_resena');
      const { data: retry, error: retryError } = await this.supabase
        .from('resena')
        .insert({ ...payload, id_resena: nextId })
        .select('*')
        .single();
      if (retryError || !retry) {
        throw this.mapInsertError(retryError?.message);
      }
      return retry as ResenaRow;
    }

    throw this.mapInsertError(error?.message);
  }

  private mapInsertError(message?: string): never {
    if (message && /duplicate|unique/i.test(message)) {
      throw new ConflictException('Esta solicitud ya tiene una reseña.');
    }
    throw new BadRequestException(message || 'No se pudo guardar la reseña.');
  }

  async refreshPromedio(idPerfil: number) {
    const { data, error } = await this.supabase
      .from('resena')
      .select('calificacion')
      .eq('id_trabajador', idPerfil);
    if (error) throw new BadRequestException(error.message);

    const rows = data || [];
    const total = rows.length;
    const reputacion =
      total === 0
        ? 0
        : Number(
            (
              rows.reduce((sum: number, row: { calificacion: number }) => sum + Number(row.calificacion), 0) /
              total
            ).toFixed(2),
          );

    const { error: updateError } = await this.supabase
      .from('perfil_trabajador')
      .update({
        reputacion_promedio: reputacion,
        total_resenas: total,
      })
      .eq('id_perfil', idPerfil);

    if (updateError) {
      if (!/column|schema cache|does not exist/i.test(updateError.message)) {
        throw new BadRequestException(updateError.message);
      }
      await this.persistPromedioEnPerfil(idPerfil, reputacion, total);
    }

    return { reputacion, total_resenas: total };
  }

  private async persistPromedioEnPerfil(idPerfil: number, reputacion: number, totalResenas: number) {
    const { data, error } = await this.supabase
      .from('perfil_trabajador')
      .select('id_perfil, descripcion')
      .eq('id_perfil', idPerfil)
      .maybeSingle();
    if (error || !data) return;

    const extras = parseProfileExtras(data.descripcion);
    await this.supabase
      .from('perfil_trabajador')
      .update({
        descripcion: serializeProfileExtras({
          ...extras,
          reputacion,
          total_resenas: totalResenas,
        }),
      })
      .eq('id_perfil', idPerfil);
  }

  private async nextId(table: 'resena' | 'bitacora', pk: 'id_resena' | 'id_evento') {
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
      origen: 'api/reviews',
    };
    const { error } = await this.supabase.from('bitacora').insert(payload);
    if (!error) return;
    if (/null value in column ["']?id_evento["']?/i.test(error.message)) {
      const nextId = await this.nextId('bitacora', 'id_evento');
      await this.supabase.from('bitacora').insert({ ...payload, id_evento: nextId });
    }
  }
}
