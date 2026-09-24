import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { UsuarioRow } from '../common/usuario.util';
import { SupabaseService } from '../supabase/supabase.service';
import { UpdateAvailabilityDto } from './dto/update-availability.dto';
import { UpdateWorkerProfileDto } from './dto/update-worker-profile.dto';
import {
  normalizeDisponibilidad,
  parseProfileExtras,
  serializeProfileExtras,
  toggleDisponibilidad,
} from './worker-profile.codec';

type PerfilRow = {
  id_perfil: number;
  id_usuario: number;
  oficio_principal: string;
  descripcion: string | null;
  experiencia: string | null;
  disponibilidad: string | null;
  contacto_visible: boolean;
  verificado: boolean;
  reputacion_promedio?: number | null;
  total_resenas?: number | null;
};

type ZonaRow = {
  id_zona: number;
  nombre: string;
  tipo: string;
  estado: string;
};

@Injectable()
export class WorkerService {
  constructor(private readonly supabase: SupabaseService) {}

  async getProfile(usuario: UsuarioRow) {
    const perfil = await this.findPerfil(usuario.id_usuario);
    if (!perfil) {
      return this.presentDraft(usuario);
    }
    return this.present(perfil);
  }

  async updateProfile(usuario: UsuarioRow, dto: UpdateWorkerProfileDto) {
    const existing = await this.findPerfil(usuario.id_usuario);
    const extras = parseProfileExtras(existing?.descripcion);
    const nextBio = dto.descripcion !== undefined ? dto.descripcion : extras.bio;
    const nextTarifas = dto.tarifas !== undefined ? dto.tarifas : extras.tarifas;
    const nextHorarios = dto.horarios !== undefined ? dto.horarios : extras.horarios;

    if (dto.tarifas && dto.tarifas.monto_hasta != null && dto.tarifas.monto_desde != null) {
      if (dto.tarifas.monto_hasta < dto.tarifas.monto_desde) {
        throw new BadRequestException('El monto hasta no puede ser menor que el monto desde.');
      }
    }

    if (nextHorarios?.length) {
      const invalid = nextHorarios.find((slot) => slot.hasta <= slot.desde);
      if (invalid) {
        throw new BadRequestException(
          `El horario de ${invalid.dia} debe terminar después de iniciar.`,
        );
      }
    }

    const payload = {
      id_usuario: usuario.id_usuario,
      oficio_principal:
        dto.oficio_principal?.trim() || existing?.oficio_principal || '',
      descripcion: serializeProfileExtras({
        bio: nextBio,
        tarifas: nextTarifas,
        horarios: nextHorarios,
        reputacion: extras.reputacion,
        total_resenas: extras.total_resenas,
      }),
      experiencia: dto.experiencia !== undefined ? dto.experiencia : existing?.experiencia || null,
      disponibilidad: normalizeDisponibilidad(existing?.disponibilidad),
      contacto_visible:
        dto.contacto_visible !== undefined
          ? dto.contacto_visible
          : existing?.contacto_visible ?? true,
      verificado: existing?.verificado ?? false,
    };

    if (!payload.oficio_principal) {
      payload.oficio_principal = existing?.oficio_principal || usuario.nombre || 'Servicios generales';
    }

    const saved = existing
      ? await this.updatePerfil(existing.id_perfil, payload)
      : await this.insertPerfil(payload);

    if (dto.cobertura) {
      await this.replaceCobertura(saved.id_perfil, dto.cobertura);
    }

    await this.registrarBitacora(usuario.id_usuario, 'UPDATE_WORKER_PROFILE', 'perfil_trabajador');
    return this.present(saved);
  }

  async updateAvailability(usuario: UsuarioRow, dto: UpdateAvailabilityDto = {}) {
    const perfil = await this.findPerfil(usuario.id_usuario);
    if (!perfil) {
      throw new NotFoundException('Aún no tienes un perfil de trabajador.');
    }

    const next = dto?.disponibilidad || toggleDisponibilidad(perfil.disponibilidad);
    const saved = await this.updatePerfil(perfil.id_perfil, { disponibilidad: next });
    await this.registrarBitacora(usuario.id_usuario, 'TOGGLE_AVAILABILITY', 'perfil_trabajador');
    return this.present(saved);
  }

  private presentDraft(usuario: UsuarioRow) {
    return {
      id_perfil: null,
      id_usuario: usuario.id_usuario,
      oficio_principal: '',
      descripcion: '',
      experiencia: null,
      contacto_visible: true,
      verificado: false,
      disponibilidad: 'Disponible',
      estado_publico: 'Disponible',
      reputacion: 0,
      total_resenas: 0,
      tarifas: null,
      horarios: [],
      cobertura: [],
      existe: false,
    };
  }

  private async present(perfil: PerfilRow) {
    const extras = parseProfileExtras(perfil.descripcion);
    const cobertura = await this.listCobertura(perfil.id_perfil);
    const disponibilidad = normalizeDisponibilidad(perfil.disponibilidad);
    const reputacion = await this.loadReputacion(perfil);

    return {
      id_perfil: perfil.id_perfil,
      id_usuario: perfil.id_usuario,
      oficio_principal: perfil.oficio_principal,
      descripcion: extras.bio,
      experiencia: perfil.experiencia,
      contacto_visible: perfil.contacto_visible,
      verificado: perfil.verificado,
      disponibilidad,
      estado_publico: disponibilidad,
      reputacion: reputacion.reputacion,
      total_resenas: reputacion.total_resenas,
      tarifas: extras.tarifas,
      horarios: extras.horarios,
      cobertura,
      existe: true,
    };
  }

  private async loadReputacion(perfil: PerfilRow) {
    if (perfil.reputacion_promedio != null && perfil.total_resenas != null) {
      return {
        reputacion: Number(perfil.reputacion_promedio) || 0,
        total_resenas: Number(perfil.total_resenas) || 0,
      };
    }

    const extras = parseProfileExtras(perfil.descripcion);
    if (extras.reputacion != null && extras.total_resenas != null) {
      return {
        reputacion: extras.reputacion,
        total_resenas: extras.total_resenas,
      };
    }

    const { data, error } = await this.supabase
      .from('resena')
      .select('calificacion')
      .eq('id_trabajador', perfil.id_perfil);
    if (error) return { reputacion: 0, total_resenas: 0 };
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
    return { reputacion, total_resenas: total };
  }

  private async findPerfil(idUsuario: number) {
    const { data, error } = await this.supabase
      .from('perfil_trabajador')
      .select('*')
      .eq('id_usuario', idUsuario)
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    return (data as PerfilRow) || null;
  }

  private async insertPerfil(payload: Record<string, unknown>) {
    const { data, error } = await this.supabase
      .from('perfil_trabajador')
      .insert(payload)
      .select('*')
      .single();

    if (!error && data) return data as PerfilRow;

    if (/null value in column ["']?id_perfil["']?/i.test(error?.message || '')) {
      const nextId = await this.nextId('perfil_trabajador', 'id_perfil');
      const { data: retry, error: retryError } = await this.supabase
        .from('perfil_trabajador')
        .insert({ ...payload, id_perfil: nextId })
        .select('*')
        .single();
      if (retryError || !retry) {
        throw new BadRequestException(retryError?.message || 'No se pudo crear el perfil.');
      }
      return retry as PerfilRow;
    }

    throw new BadRequestException(error?.message || 'No se pudo crear el perfil.');
  }

  private async updatePerfil(idPerfil: number, payload: Record<string, unknown>) {
    const { data, error } = await this.supabase
      .from('perfil_trabajador')
      .update(payload)
      .eq('id_perfil', idPerfil)
      .select('*')
      .single();
    if (error || !data) {
      throw new BadRequestException(error?.message || 'No se pudo actualizar el perfil.');
    }
    return data as PerfilRow;
  }

  private async listCobertura(idPerfil: number) {
    const { data: links, error } = await this.supabase
      .from('perfil_zona')
      .select('id_zona')
      .eq('id_perfil', idPerfil);
    if (error) throw new BadRequestException(error.message);

    const ids = (links || []).map((row: { id_zona: number }) => row.id_zona);
    if (!ids.length) return [];

    const { data: zonas, error: zonaError } = await this.supabase
      .from('zona')
      .select('id_zona, nombre, tipo, estado')
      .in('id_zona', ids);
    if (zonaError) throw new BadRequestException(zonaError.message);
    return (zonas || []) as ZonaRow[];
  }

  private async replaceCobertura(idPerfil: number, zonaIds: number[]) {
    const unique = [...new Set(zonaIds)];
    if (unique.length) {
      const { data: zonas, error } = await this.supabase
        .from('zona')
        .select('id_zona, estado')
        .in('id_zona', unique);
      if (error) throw new BadRequestException(error.message);
      const rows = (zonas || []) as { id_zona: number; estado: string }[];
      const found = new Set(rows.map((zona) => zona.id_zona));
      const missing = unique.filter((id) => !found.has(id));
      if (missing.length) {
        throw new BadRequestException(`Las zonas no existen: ${missing.join(', ')}.`);
      }
      const inactivas = rows.filter((zona) => (zona.estado || '').toUpperCase() !== 'ACTIVA');
      if (inactivas.length) {
        throw new BadRequestException(
          `Las zonas no están activas: ${inactivas.map((zona) => zona.id_zona).join(', ')}.`,
        );
      }
    }

    const { error: delError } = await this.supabase
      .from('perfil_zona')
      .delete()
      .eq('id_perfil', idPerfil);
    if (delError) throw new BadRequestException(delError.message);

    if (!unique.length) return;

    const { error: insError } = await this.supabase.from('perfil_zona').insert(
      unique.map((id_zona) => ({ id_perfil: idPerfil, id_zona })),
    );
    if (insError) throw new BadRequestException(insError.message);
  }

  private async nextId(table: 'perfil_trabajador' | 'bitacora', pk: 'id_perfil' | 'id_evento') {
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
      origen: 'api/worker',
    };
    const { error } = await this.supabase.from('bitacora').insert(payload);
    if (!error) return;
    if (/null value in column ["']?id_evento["']?/i.test(error.message)) {
      const nextId = await this.nextId('bitacora', 'id_evento');
      await this.supabase.from('bitacora').insert({ ...payload, id_evento: nextId });
    }
  }
}
