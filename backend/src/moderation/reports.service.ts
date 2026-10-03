import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UsuarioRow } from '../common/usuario.util';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateReportDto } from './dto/create-report.dto';
import { ListReportsDto } from './dto/list-reports.dto';
import { UpdateReportDto } from './dto/update-report.dto';

type ReporteRow = {
  id_reporte: number;
  id_usuario_reporta: number;
  tipo_recurso: string;
  id_recurso: number;
  motivo: string;
  estado: string;
  fecha: string;
};

@Injectable()
export class ReportsService {
  constructor(private readonly supabase: SupabaseService) {}

  async create(usuario: UsuarioRow, dto: CreateReportDto) {
    const motivo = `${dto.categoria ? `[${dto.categoria}] ` : ''}${dto.motivo.trim()}`;
    const denunciado = await this.resolveDenunciado(dto.tipo_recurso, dto.id_recurso);
    if (denunciado && denunciado.id_usuario === usuario.id_usuario) {
      throw new ForbiddenException('No puedes denunciarte a ti mismo.');
    }

    const duplicado = await this.findPendingDuplicate(
      usuario.id_usuario,
      dto.tipo_recurso,
      dto.id_recurso,
    );
    if (duplicado) {
      throw new ConflictException('Ya tienes un reporte pendiente sobre este recurso.');
    }

    const saved = await this.insertReporte({
      id_usuario_reporta: usuario.id_usuario,
      tipo_recurso: dto.tipo_recurso,
      id_recurso: dto.id_recurso,
      motivo,
      estado: 'PENDIENTE',
      fecha: new Date().toISOString(),
    });
    await this.registrarBitacora(usuario.id_usuario, 'CREATE_REPORT', 'reporte');
    return this.present(saved);
  }

  async list(query: ListReportsDto) {
    let builder = this.supabase
      .from('reporte')
      .select('*')
      .order('fecha', { ascending: false })
      .limit(200);

    if (query.estado && query.estado !== 'todos') {
      builder = builder.eq('estado', query.estado);
    }
    if (query.tipo_recurso) {
      builder = builder.eq('tipo_recurso', query.tipo_recurso);
    }

    const { data, error } = await builder;
    if (error) throw new BadRequestException(error.message);
    return Promise.all(((data || []) as ReporteRow[]).map((row) => this.present(row)));
  }

  async getOne(idReporte: number) {
    const row = await this.findReporte(idReporte);
    if (!row) throw new NotFoundException('El reporte no existe.');
    return this.present(row);
  }

  async update(admin: UsuarioRow, idReporte: number, dto: UpdateReportDto) {
    const row = await this.findReporte(idReporte);
    if (!row) throw new NotFoundException('El reporte no existe.');
    if (row.estado !== 'PENDIENTE') {
      throw new BadRequestException(`Este reporte ya está ${row.estado}.`);
    }

    const { data, error } = await this.supabase
      .from('reporte')
      .update({ estado: dto.estado })
      .eq('id_reporte', idReporte)
      .eq('estado', 'PENDIENTE')
      .select('*')
      .single();
    if (error || !data) {
      throw new BadRequestException(error?.message || 'No se pudo actualizar el reporte.');
    }

    let cuenta: UsuarioRow | null = null;
    if (dto.accion_cuenta) {
      const denunciado = await this.resolveDenunciado(row.tipo_recurso, row.id_recurso);
      if (!denunciado) {
        throw new BadRequestException('No se pudo identificar la cuenta denunciada para aplicar la acción.');
      }
      cuenta = await this.patchUsuario(denunciado.id_usuario, {
        estado: dto.accion_cuenta,
        modo_activo: dto.accion_cuenta === 'ACTIVO',
      });
    }

    await this.registrarBitacora(admin.id_usuario, `REPORT_${dto.estado}`, 'reporte');
    return {
      ...(await this.present(data as ReporteRow)),
      accion_cuenta_aplicada: cuenta
        ? { id_usuario: cuenta.id_usuario, estado: cuenta.estado }
        : null,
    };
  }

  private async present(row: ReporteRow) {
    const [denunciante, denunciado] = await Promise.all([
      this.findUsuario(row.id_usuario_reporta),
      this.resolveDenunciado(row.tipo_recurso, row.id_recurso),
    ]);

    return {
      id_reporte: row.id_reporte,
      tipo_recurso: row.tipo_recurso,
      id_recurso: row.id_recurso,
      motivo: row.motivo,
      estado: row.estado,
      fecha: row.fecha,
      denunciante: denunciante
        ? { id_usuario: denunciante.id_usuario, nombre: denunciante.nombre, correo: denunciante.correo }
        : null,
      cuenta_denunciada: denunciado
        ? {
            id_usuario: denunciado.id_usuario,
            nombre: denunciado.nombre,
            correo: denunciado.correo,
            estado: denunciado.estado,
          }
        : null,
    };
  }

  private async resolveDenunciado(tipo: string, idRecurso: number) {
    if (tipo === 'usuario') {
      return this.findUsuario(idRecurso);
    }
    if (tipo === 'perfil') {
      const { data } = await this.supabase
        .from('perfil_trabajador')
        .select('id_usuario')
        .eq('id_perfil', idRecurso)
        .maybeSingle();
      const idUsuario = (data as { id_usuario?: number } | null)?.id_usuario;
      return idUsuario ? this.findUsuario(idUsuario) : null;
    }
    if (tipo === 'solicitud') {
      const { data } = await this.supabase
        .from('solicitud_servicio')
        .select('id_cliente, id_trabajador')
        .eq('id_solicitud', idRecurso)
        .maybeSingle();
      const idTrabajador = (data as { id_trabajador?: number } | null)?.id_trabajador;
      if (!idTrabajador) return null;
      const { data: perfil } = await this.supabase
        .from('perfil_trabajador')
        .select('id_usuario')
        .eq('id_perfil', idTrabajador)
        .maybeSingle();
      const idUsuario = (perfil as { id_usuario?: number } | null)?.id_usuario;
      return idUsuario ? this.findUsuario(idUsuario) : null;
    }
    return null;
  }

  private async findPendingDuplicate(idUsuario: number, tipo: string, idRecurso: number) {
    const { data, error } = await this.supabase
      .from('reporte')
      .select('id_reporte')
      .eq('id_usuario_reporta', idUsuario)
      .eq('tipo_recurso', tipo)
      .eq('id_recurso', idRecurso)
      .eq('estado', 'PENDIENTE')
      .limit(1);
    if (error) throw new BadRequestException(error.message);
    return data?.[0] || null;
  }

  private async findReporte(idReporte: number) {
    const { data, error } = await this.supabase
      .from('reporte')
      .select('*')
      .eq('id_reporte', idReporte)
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    return (data as ReporteRow) || null;
  }

  private async findUsuario(idUsuario: number) {
    const { data } = await this.supabase
      .from('usuario')
      .select('id_usuario, nombre, correo, estado, modo_activo')
      .eq('id_usuario', idUsuario)
      .maybeSingle();
    return (data as UsuarioRow) || null;
  }

  private async patchUsuario(idUsuario: number, payload: Record<string, unknown>) {
    const { data, error } = await this.supabase
      .from('usuario')
      .update(payload)
      .eq('id_usuario', idUsuario)
      .select('id_usuario, nombre, correo, estado, modo_activo')
      .single();
    if (error || !data) {
      throw new BadRequestException(error?.message || 'No se pudo actualizar la cuenta denunciada.');
    }
    return data as UsuarioRow;
  }

  private async insertReporte(payload: Record<string, unknown>) {
    const { data, error } = await this.supabase.from('reporte').insert(payload).select('*').single();
    if (!error && data) return data as ReporteRow;

    if (/null value in column ["']?id_reporte["']?/i.test(error?.message || '')) {
      const { data: last } = await this.supabase
        .from('reporte')
        .select('id_reporte')
        .order('id_reporte', { ascending: false })
        .limit(1);
      const nextId = (Number((last?.[0] as { id_reporte?: number } | undefined)?.id_reporte) || 0) + 1;
      const { data: retry, error: retryError } = await this.supabase
        .from('reporte')
        .insert({ ...payload, id_reporte: nextId })
        .select('*')
        .single();
      if (retryError || !retry) {
        throw new BadRequestException(retryError?.message || 'No se pudo crear el reporte.');
      }
      return retry as ReporteRow;
    }

    throw new BadRequestException(error?.message || 'No se pudo crear el reporte.');
  }

  private async registrarBitacora(idActor: number, accion: string, recurso: string) {
    const payload = { id_actor: idActor, accion, recurso, origen: 'api/admin/reports' };
    const { error } = await this.supabase.from('bitacora').insert(payload);
    if (!error) return;
    if (/null value in column ["']?id_evento["']?/i.test(error.message)) {
      const { data } = await this.supabase
        .from('bitacora')
        .select('id_evento')
        .order('id_evento', { ascending: false })
        .limit(1);
      const nextId = (Number((data?.[0] as { id_evento?: number } | undefined)?.id_evento) || 0) + 1;
      await this.supabase.from('bitacora').insert({ ...payload, id_evento: nextId });
    }
  }
}
