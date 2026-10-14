import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ESTADO_DB_ALIASES } from '../requests/request-state';
import { SupabaseService } from '../supabase/supabase.service';

const EXITO = new Set(ESTADO_DB_ALIASES.Finalizada);

type OficioRow = {
  id_categoria: number;
  nombre: string;
  total: number;
};

type RpcPayload = {
  usuarios_activos?: number;
  oficios_mas_solicitados?: OficioRow[];
  solicitudes_cerradas_exito?: number;
  solicitudes_total?: number;
};

export type MetricasPlataforma = {
  motor: 'sql' | 'consultas';
  usuarios_activos: number;
  oficios_mas_solicitados: OficioRow[];
  solicitudes_cerradas_exito: {
    total: number;
    solicitudes: number;
    tasa: number;
  };
};

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);

  constructor(private readonly supabase: SupabaseService) {}

  async resumen(limit = 6): Promise<MetricasPlataforma> {
    const top = this.clampLimit(limit);
    const rpc = await this.resumenViaRpc(top);
    if (rpc) return rpc;
    return this.resumenViaConsultas(top);
  }

  async usuariosActivos() {
    const data = await this.resumen(1);
    return { usuarios_activos: data.usuarios_activos };
  }

  async oficiosMasSolicitados(limit = 6) {
    const data = await this.resumen(limit);
    return { oficios_mas_solicitados: data.oficios_mas_solicitados };
  }

  async solicitudesCerradasExito() {
    const data = await this.resumen(1);
    return { solicitudes_cerradas_exito: data.solicitudes_cerradas_exito };
  }

  private async resumenViaRpc(limit: number): Promise<MetricasPlataforma | null> {
    const { data, error } = await this.supabase.admin.rpc('metricas_plataforma', {
      p_limit: limit,
    });

    if (error) {
      if (this.isMissingRpc(error.message)) {
        this.logger.warn(
          'La función SQL metricas_plataforma no está aplicada. Usando consultas de respaldo. Ejecuta backend/src/metrics/sql/001_metricas_hu23.sql en Supabase.',
        );
        return null;
      }
      throw new BadRequestException(error.message);
    }

    const payload = (Array.isArray(data) ? data[0] : data) as RpcPayload | null;
    return this.present('sql', payload, limit);
  }

  private async resumenViaConsultas(limit: number): Promise<MetricasPlataforma> {
    const { count, error: userError } = await this.supabase
      .from('usuario')
      .select('id_usuario', { count: 'exact', head: true })
      .eq('estado', 'ACTIVO')
      .eq('modo_activo', true);
    if (userError) throw new BadRequestException(userError.message);

    const { data: solicitudes, error: solicitudError } = await this.supabase
      .from('solicitud_servicio')
      .select('id_solicitud, estado, id_servicio');
    if (solicitudError) throw new BadRequestException(solicitudError.message);

    const rows = solicitudes || [];
    const cerradas = rows.filter((row) => EXITO.has(String(row.estado))).length;
    const oficios = await this.oficiosDesdeSolicitudes(
      rows.map((row) => Number(row.id_servicio)).filter((id) => Number.isFinite(id)),
      limit,
    );

    return this.present(
      'consultas',
      {
        usuarios_activos: count || 0,
        oficios_mas_solicitados: oficios,
        solicitudes_cerradas_exito: cerradas,
        solicitudes_total: rows.length,
      },
      limit,
    );
  }

  private async oficiosDesdeSolicitudes(servicioIds: number[], limit: number) {
    const unique = [...new Set(servicioIds)];
    if (!unique.length) return [];

    const { data: servicios, error } = await this.supabase
      .from('servicio_ofrecido')
      .select('id_servicio, id_categoria')
      .in('id_servicio', unique);
    if (error) throw new BadRequestException(error.message);

    const categoriaPorServicio = new Map<number, number>();
    for (const row of servicios || []) {
      categoriaPorServicio.set(Number(row.id_servicio), Number(row.id_categoria));
    }

    const conteo = new Map<number, number>();
    for (const idServicio of servicioIds) {
      const idCategoria = categoriaPorServicio.get(idServicio);
      if (!idCategoria) continue;
      conteo.set(idCategoria, (conteo.get(idCategoria) || 0) + 1);
    }

    const categoriaIds = [...conteo.keys()];
    if (!categoriaIds.length) return [];

    const { data: categorias, error: categoriaError } = await this.supabase
      .from('categoria')
      .select('id_categoria, nombre')
      .in('id_categoria', categoriaIds);
    if (categoriaError) throw new BadRequestException(categoriaError.message);

    const nombres = new Map<number, string>();
    for (const row of categorias || []) {
      nombres.set(Number(row.id_categoria), String(row.nombre));
    }

    return [...conteo.entries()]
      .map(([id_categoria, total]) => ({
        id_categoria,
        nombre: nombres.get(id_categoria) || `Categoría ${id_categoria}`,
        total,
      }))
      .sort((a, b) => b.total - a.total || a.nombre.localeCompare(b.nombre, 'es'))
      .slice(0, limit);
  }

  private present(motor: MetricasPlataforma['motor'], payload: RpcPayload | null, limit: number): MetricasPlataforma {
    const oficios = Array.isArray(payload?.oficios_mas_solicitados)
      ? payload.oficios_mas_solicitados
      : [];
    const cerradas = Number(payload?.solicitudes_cerradas_exito) || 0;
    const solicitudes = Number(payload?.solicitudes_total) || 0;

    return {
      motor,
      usuarios_activos: Number(payload?.usuarios_activos) || 0,
      oficios_mas_solicitados: oficios.slice(0, limit).map((row) => ({
        id_categoria: Number(row.id_categoria),
        nombre: String(row.nombre),
        total: Number(row.total) || 0,
      })),
      solicitudes_cerradas_exito: {
        total: cerradas,
        solicitudes,
        tasa: solicitudes ? Math.round((cerradas / solicitudes) * 1000) / 10 : 0,
      },
    };
  }

  private clampLimit(limit?: number) {
    const value = Number(limit);
    if (!Number.isFinite(value)) return 6;
    return Math.max(1, Math.min(20, Math.trunc(value)));
  }

  private isMissingRpc(message?: string) {
    if (!message) return false;
    return /could not find the function|schema cache|does not exist|pgrst202/i.test(message);
  }
}
