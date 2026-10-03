import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { parseProfileExtras } from '../worker/worker-profile.codec';
import { SupabaseService } from '../supabase/supabase.service';
import { SearchProfilesDto } from './dto/search-profiles.dto';

type PerfilRow = {
  id_perfil: number;
  id_usuario: number;
  oficio_principal: string;
  descripcion: string | null;
  experiencia: string | null;
  disponibilidad: string | null;
  contacto_visible: boolean;
  verificado: boolean;
  tarifa_desde?: number | null;
  tarifa_hasta?: number | null;
  tarifa_tipo?: string | null;
};

type UsuarioRow = {
  id_usuario: number;
  nombre: string;
  estado: string;
  modo_activo: boolean;
};

type RpcRow = {
  id_perfil: number;
  id_usuario: number;
  nombre: string;
  oficio_principal: string;
  descripcion: string | null;
  experiencia: string | null;
  disponibilidad: string;
  verificado: boolean;
  contacto_visible: boolean;
  tarifa_desde: number | null;
  tarifa_hasta: number | null;
  tarifa_tipo: string | null;
  reputacion: number;
  total_resenas: number;
  rank: number;
  zonas: unknown;
  total: number;
};

@Injectable()
export class SearchIndexService {
  private readonly logger = new Logger(SearchIndexService.name);

  constructor(private readonly supabase: SupabaseService) {}

  async searchProfiles(dto: SearchProfilesDto) {
    if (dto.precio_min != null && dto.precio_max != null && dto.precio_max < dto.precio_min) {
      throw new BadRequestException('El precio máximo no puede ser menor que el mínimo.');
    }

    const rpc = await this.searchViaRpc(dto);
    if (rpc) return rpc;
    return this.searchViaIndexedQueries(dto);
  }

  private async searchViaRpc(dto: SearchProfilesDto) {
    const { data, error } = await this.supabase.admin.rpc('buscar_perfiles_indexados', {
      p_q: dto.q?.trim() || null,
      p_id_zona: dto.id_zona ?? null,
      p_zona: dto.zona?.trim() || null,
      p_disponibilidad: dto.disponibilidad || 'Disponible',
      p_precio_min: dto.precio_min ?? null,
      p_precio_max: dto.precio_max ?? null,
      p_reputacion_min: dto.reputacion_min ?? null,
      p_verificado: dto.verificado ?? null,
      p_limit: dto.limit ?? 20,
      p_offset: dto.offset ?? 0,
      p_orden: dto.orden || 'relevancia',
    });

    if (error) {
      if (this.isMissingRpc(error.message)) {
        this.logger.warn(
          'La función SQL buscar_perfiles_indexados no está aplicada. Usando consultas indexadas de respaldo. Ejecuta backend/src/search/sql/001_motor_busqueda_indexada.sql en Supabase.',
        );
        return null;
      }
      throw new BadRequestException(error.message);
    }

    const rows = (data || []) as RpcRow[];
    const total = rows[0]?.total ?? 0;
    return {
      motor: 'sql-indexado',
      consulta: this.consulta(dto),
      total,
      perfiles: rows.map((row) => this.presentRpc(row)),
    };
  }

  private async searchViaIndexedQueries(dto: SearchProfilesDto) {
    const limit = dto.limit ?? 20;
    const offset = dto.offset ?? 0;
    const q = this.sanitizeTerm(dto.q);
    const disponibilidad = dto.disponibilidad || 'Disponible';

    const zoneIds = await this.resolveZoneIds(dto.id_zona, dto.zona);
    let perfilIds: number[] | null = null;
    if (zoneIds) {
      const { data: links, error } = await this.supabase
        .from('perfil_zona')
        .select('id_perfil')
        .in('id_zona', zoneIds);
      if (error) throw new BadRequestException(error.message);
      perfilIds = [...new Set((links || []).map((row: { id_perfil: number }) => row.id_perfil))];
      if (!perfilIds.length) {
        return { motor: 'consultas-indexadas', consulta: this.consulta(dto), total: 0, perfiles: [] };
      }
    }

    let query = this.supabase.from('perfil_trabajador').select('*');
    if (perfilIds) query = query.in('id_perfil', perfilIds);
    if (disponibilidad !== 'todos') {
      if (disponibilidad === 'Ocupado') {
        query = query.eq('disponibilidad', 'Ocupado');
      } else {
        query = query.or('disponibilidad.eq.Disponible,disponibilidad.is.null');
      }
    }
    if (dto.verificado != null) query = query.eq('verificado', dto.verificado);
    if (q) {
      query = query.or(
        `oficio_principal.ilike.%${q}%,experiencia.ilike.%${q}%,descripcion.ilike.%${q}%`,
      );
    }

    const { data: perfiles, error: perfilError } = await query;
    if (perfilError) throw new BadRequestException(perfilError.message);

    const rows = (perfiles || []) as PerfilRow[];
    const usuarios = await this.loadUsuarios(rows.map((row) => row.id_usuario));
    const reputacion = await this.loadReputacion(rows.map((row) => row.id_perfil));
    const cobertura = await this.loadCobertura(rows.map((row) => row.id_perfil));

    const scored = rows
      .map((perfil) => {
        const usuario = usuarios.get(perfil.id_usuario);
        if (!usuario || !usuario.modo_activo || usuario.estado !== 'ACTIVO') return null;
        const extras = parseProfileExtras(perfil.descripcion);
        const desde = extras.tarifas?.monto_desde ?? null;
        const hasta = extras.tarifas?.monto_hasta ?? null;
        const stats = reputacion.get(perfil.id_perfil) || { reputacion: 0, total_resenas: 0 };
        if (dto.precio_min != null && (hasta ?? desde) != null && (hasta ?? desde)! < dto.precio_min) {
          return null;
        }
        if (dto.precio_max != null && (desde ?? hasta) != null && (desde ?? hasta)! > dto.precio_max) {
          return null;
        }
        if (dto.precio_min != null && dto.precio_max != null && desde == null && hasta == null) {
          return null;
        }
        if (dto.reputacion_min != null && stats.reputacion < dto.reputacion_min) return null;

        const hay = q
          ? Number(perfil.oficio_principal.toLowerCase().includes(q)) * 3 +
            Number((extras.bio || '').toLowerCase().includes(q)) +
            Number((perfil.experiencia || '').toLowerCase().includes(q))
          : 1;
        const rank =
          hay + stats.reputacion / 5 + (perfil.verificado ? 0.2 : 0);

        return {
          id_perfil: perfil.id_perfil,
          id_usuario: perfil.id_usuario,
          nombre: usuario.nombre,
          oficio_principal: perfil.oficio_principal,
          descripcion: extras.bio,
          experiencia: perfil.experiencia,
          disponibilidad: perfil.disponibilidad === 'Ocupado' ? 'Ocupado' : 'Disponible',
          verificado: perfil.verificado,
          tarifas: extras.tarifas,
          reputacion: stats.reputacion,
          total_resenas: stats.total_resenas,
          rank: Number(rank.toFixed(3)),
          cobertura: cobertura.get(perfil.id_perfil) || [],
        };
      })
      .filter(Boolean) as Array<{
      id_perfil: number;
      reputacion: number;
      tarifas: { monto_desde?: number } | null;
      rank: number;
      verificado: boolean;
      [key: string]: unknown;
    }>;

    scored.sort((a, b) => {
      const orden = dto.orden || 'relevancia';
      if (orden === 'reputacion') return b.reputacion - a.reputacion;
      if (orden === 'precio_asc') return (a.tarifas?.monto_desde ?? 1e9) - (b.tarifas?.monto_desde ?? 1e9);
      if (orden === 'precio_desc') return (b.tarifas?.monto_desde ?? -1) - (a.tarifas?.monto_desde ?? -1);
      if (b.rank !== a.rank) return b.rank - a.rank;
      if (a.verificado !== b.verificado) return a.verificado ? -1 : 1;
      return b.reputacion - a.reputacion;
    });

    const total = scored.length;
    return {
      motor: 'consultas-indexadas',
      consulta: this.consulta(dto),
      total,
      perfiles: scored.slice(offset, offset + limit),
    };
  }

  private presentRpc(row: RpcRow) {
    return {
      id_perfil: row.id_perfil,
      id_usuario: row.id_usuario,
      nombre: row.nombre,
      oficio_principal: row.oficio_principal,
      descripcion: row.descripcion,
      experiencia: row.experiencia,
      disponibilidad: row.disponibilidad,
      verificado: row.verificado,
      tarifas:
        row.tarifa_desde != null || row.tarifa_hasta != null || row.tarifa_tipo
          ? {
              tipo: row.tarifa_tipo,
              monto_desde: row.tarifa_desde,
              monto_hasta: row.tarifa_hasta,
            }
          : null,
      reputacion: Number(row.reputacion || 0),
      total_resenas: row.total_resenas || 0,
      rank: Number(row.rank || 0),
      cobertura: Array.isArray(row.zonas) ? row.zonas : [],
    };
  }

  private consulta(dto: SearchProfilesDto) {
    return {
      q: dto.q?.trim() || null,
      id_zona: dto.id_zona ?? null,
      zona: dto.zona?.trim() || null,
      disponibilidad: dto.disponibilidad || 'Disponible',
      precio_min: dto.precio_min ?? null,
      precio_max: dto.precio_max ?? null,
      reputacion_min: dto.reputacion_min ?? null,
      verificado: dto.verificado ?? null,
      orden: dto.orden || 'relevancia',
      limit: dto.limit ?? 20,
      offset: dto.offset ?? 0,
    };
  }

  private async resolveZoneIds(idZona?: number, nombre?: string) {
    if (!idZona && !nombre?.trim()) return null;
    let query = this.supabase.from('zona').select('id_zona, nombre, estado').eq('estado', 'ACTIVA');
    if (idZona) query = query.eq('id_zona', idZona);
    if (nombre?.trim()) query = query.ilike('nombre', nombre.trim());
    const { data, error } = await query;
    if (error) throw new BadRequestException(error.message);
    const ids = (data || []).map((zona: { id_zona: number }) => zona.id_zona);
    if (idZona && !ids.includes(idZona)) {
      throw new BadRequestException('La zona indicada no existe o no está activa.');
    }
    if (nombre?.trim() && !ids.length) {
      throw new BadRequestException(`No se encontró la zona "${nombre}".`);
    }
    return ids;
  }

  private async loadUsuarios(ids: number[]) {
    const unique = [...new Set(ids)];
    const map = new Map<number, UsuarioRow>();
    if (!unique.length) return map;
    const { data, error } = await this.supabase
      .from('usuario')
      .select('id_usuario, nombre, estado, modo_activo')
      .in('id_usuario', unique);
    if (error) throw new BadRequestException(error.message);
    for (const row of (data || []) as UsuarioRow[]) map.set(row.id_usuario, row);
    return map;
  }

  private async loadReputacion(ids: number[]) {
    const unique = [...new Set(ids)];
    const map = new Map<number, { reputacion: number; total_resenas: number }>();
    if (!unique.length) return map;
    const { data, error } = await this.supabase
      .from('resena')
      .select('id_trabajador, calificacion')
      .in('id_trabajador', unique);
    if (error) throw new BadRequestException(error.message);
    const acc = new Map<number, { sum: number; n: number }>();
    for (const row of data || []) {
      const current = acc.get(row.id_trabajador) || { sum: 0, n: 0 };
      current.sum += Number(row.calificacion) || 0;
      current.n += 1;
      acc.set(row.id_trabajador, current);
    }
    for (const [id, value] of acc) {
      map.set(id, {
        reputacion: Number((value.sum / value.n).toFixed(2)),
        total_resenas: value.n,
      });
    }
    return map;
  }

  private async loadCobertura(ids: number[]) {
    const unique = [...new Set(ids)];
    const map = new Map<number, Array<{ id_zona: number; nombre: string; tipo: string }>>();
    if (!unique.length) return map;
    const { data: links, error } = await this.supabase
      .from('perfil_zona')
      .select('id_perfil, id_zona')
      .in('id_perfil', unique);
    if (error) throw new BadRequestException(error.message);
    const zonaIds = [...new Set((links || []).map((row: { id_zona: number }) => row.id_zona))];
    if (!zonaIds.length) return map;
    const { data: zonas, error: zonaError } = await this.supabase
      .from('zona')
      .select('id_zona, nombre, tipo, estado')
      .in('id_zona', zonaIds)
      .eq('estado', 'ACTIVA');
    if (zonaError) throw new BadRequestException(zonaError.message);
    const zonaMap = new Map(
      ((zonas || []) as Array<{ id_zona: number; nombre: string; tipo: string }>).map((zona) => [
        zona.id_zona,
        zona,
      ]),
    );
    for (const link of links || []) {
      const zona = zonaMap.get(link.id_zona);
      if (!zona) continue;
      const list = map.get(link.id_perfil) || [];
      list.push({ id_zona: zona.id_zona, nombre: zona.nombre, tipo: zona.tipo });
      map.set(link.id_perfil, list);
    }
    return map;
  }

  private sanitizeTerm(value?: string) {
    return (value || '').trim().toLowerCase().replace(/[%_,()]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  private isMissingRpc(message?: string) {
    if (!message) return false;
    return /could not find the function|schema cache|does not exist|pgrst202/i.test(message);
  }
}
