import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { normalizeDisponibilidad, parseProfileExtras } from '../worker/worker-profile.codec';
import { SupabaseService } from '../supabase/supabase.service';
import { SearchWorkersDto } from './dto/search-workers.dto';
import {
  findQuadrantByNombre,
  GEO_QUADRANTS,
  GeoQuadrant,
} from './geo-quadrants';
import { haversineKm, LatLng, pointInBounds } from './geo.util';

type ZonaRow = {
  id_zona: number;
  nombre: string;
  tipo: string;
  estado: string;
};

type PerfilRow = {
  id_perfil: number;
  id_usuario: number;
  oficio_principal: string;
  descripcion: string | null;
  experiencia: string | null;
  disponibilidad: string | null;
  contacto_visible: boolean;
  verificado: boolean;
};

type UsuarioPublico = {
  id_usuario: number;
  nombre: string;
  correo: string;
  telefono: string | null;
  estado: string;
  modo_activo: boolean;
};

type ResolvedZone = {
  id_zona: number;
  nombre: string;
  tipo: string;
  clave?: string;
  coincide: boolean;
  distancia_km: number | null;
};

@Injectable()
export class SearchService implements OnModuleInit {
  private readonly logger = new Logger(SearchService.name);
  private zonasByNombre = new Map<string, ZonaRow>();

  constructor(private readonly supabase: SupabaseService) {}

  async onModuleInit() {
    try {
      await this.ensureZonas();
    } catch (error) {
      this.logger.error(
        `No se pudieron preparar las zonas geográficas: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  async listQuadrants(lat?: number, lng?: number) {
    await this.ensureZonas();
    const point = this.optionalPoint(lat, lng);
    return GEO_QUADRANTS.map((item) => {
      const zona = this.zonasByNombre.get(item.nombre.toLowerCase());
      const distancia = point ? Number(haversineKm(point, item.centro).toFixed(2)) : null;
      return {
        clave: item.clave,
        nombre: item.nombre,
        tipo: item.tipo,
        id_zona: zona?.id_zona || null,
        centro: item.centro,
        bounds: item.bounds,
        coincide: point ? pointInBounds(point, item.bounds) : false,
        distancia_km: distancia,
      };
    }).sort((a, b) => {
      if (a.coincide !== b.coincide) return a.coincide ? -1 : 1;
      return (a.distancia_km ?? 999) - (b.distancia_km ?? 999);
    });
  }

  async searchWorkers(dto: SearchWorkersDto) {
    await this.ensureZonas();
    const point = this.requireSearchInput(dto);
    const radioKm = dto.radio_km ?? 8;
    const incluirCercanos = dto.incluir_cercanos !== false;
    const limit = dto.limit ?? 20;

    const zonas = this.resolveZones(dto, point, radioKm, incluirCercanos);
    if (!zonas.length) {
      return {
        consulta: this.consulta(dto, point, radioKm),
        zonas_aplicadas: [],
        total: 0,
        trabajadores: [],
        mensaje: 'No hay cuadrantes o zonas que coincidan con esa ubicación.',
      };
    }

    const zoneIds = zonas.map((zona) => zona.id_zona);
    const { data: links, error: linkError } = await this.supabase
      .from('perfil_zona')
      .select('id_perfil, id_zona')
      .in('id_zona', zoneIds);
    if (linkError) throw new BadRequestException(linkError.message);

    const perfilIds = [...new Set((links || []).map((row: { id_perfil: number }) => row.id_perfil))];
    if (!perfilIds.length) {
      return {
        consulta: this.consulta(dto, point, radioKm),
        zonas_aplicadas: zonas,
        total: 0,
        trabajadores: [],
        mensaje: 'No hay trabajadores con cobertura en esas zonas.',
      };
    }

    const { data: perfiles, error: perfilError } = await this.supabase
      .from('perfil_trabajador')
      .select('*')
      .in('id_perfil', perfilIds);
    if (perfilError) throw new BadRequestException(perfilError.message);

    const oficio = dto.oficio?.trim().toLowerCase();
    let filtered = ((perfiles || []) as PerfilRow[]).filter((perfil) => {
      const disponible = normalizeDisponibilidad(perfil.disponibilidad) === 'Disponible';
      if (!dto.incluir_ocupados && !disponible) return false;
      if (oficio && !perfil.oficio_principal.toLowerCase().includes(oficio)) return false;
      return true;
    });

    const usuarios = await this.loadUsuarios(filtered.map((perfil) => perfil.id_usuario));
    filtered = filtered.filter((perfil) => {
      const usuario = usuarios.get(perfil.id_usuario);
      return Boolean(usuario && usuario.modo_activo && usuario.estado === 'ACTIVO');
    });

    const coberturaPorPerfil = new Map<number, number[]>();
    for (const link of links || []) {
      const list = coberturaPorPerfil.get(link.id_perfil) || [];
      list.push(link.id_zona);
      coberturaPorPerfil.set(link.id_perfil, list);
    }

    const zonaNombre = new Map(zonas.map((zona) => [zona.id_zona, zona]));
    const trabajadores = filtered
      .map((perfil) => {
        const extras = parseProfileExtras(perfil.descripcion);
        const usuario = usuarios.get(perfil.id_usuario)!;
        const coincidencias = (coberturaPorPerfil.get(perfil.id_perfil) || [])
          .map((id) => zonaNombre.get(id))
          .filter(Boolean) as ResolvedZone[];
        const mejor = [...coincidencias].sort((a, b) => {
          if (a.coincide !== b.coincide) return a.coincide ? -1 : 1;
          return (a.distancia_km ?? 999) - (b.distancia_km ?? 999);
        })[0];
        const distancia = mejor?.distancia_km ?? null;
        const score =
          (mejor?.coincide ? 100 : 40) +
          (perfil.verificado ? 15 : 0) +
          Math.max(0, 30 - Math.round(distancia ?? 30));

        return {
          id_perfil: perfil.id_perfil,
          id_usuario: perfil.id_usuario,
          nombre: usuario.nombre,
          oficio_principal: perfil.oficio_principal,
          descripcion: extras.bio,
          experiencia: perfil.experiencia,
          disponibilidad: normalizeDisponibilidad(perfil.disponibilidad),
          verificado: perfil.verificado,
          tarifas: extras.tarifas,
          zona_coincidente: mejor
            ? { id_zona: mejor.id_zona, nombre: mejor.nombre, tipo: mejor.tipo }
            : null,
          distancia_km: distancia,
          score,
          cobertura: coincidencias.map((zona) => ({
            id_zona: zona.id_zona,
            nombre: zona.nombre,
            tipo: zona.tipo,
          })),
          contacto: perfil.contacto_visible
            ? { correo: usuario.correo, telefono: usuario.telefono }
            : null,
        };
      })
      .sort((a, b) => b.score - a.score || (a.distancia_km ?? 999) - (b.distancia_km ?? 999))
      .slice(0, limit);

    return {
      consulta: this.consulta(dto, point, radioKm),
      zonas_aplicadas: zonas,
      total: trabajadores.length,
      trabajadores,
    };
  }

  private requireSearchInput(dto: SearchWorkersDto): LatLng | null {
    const hasCoords = dto.lat != null || dto.lng != null;
    if (hasCoords && (dto.lat == null || dto.lng == null)) {
      throw new BadRequestException('Debes enviar lat y lng juntas.');
    }
    if (!hasCoords && dto.id_zona == null && !dto.cuadrante?.trim()) {
      throw new BadRequestException(
        'Indica un cuadrante, un id_zona o coordenadas aproximadas (lat y lng).',
      );
    }
    return hasCoords ? { lat: Number(dto.lat), lng: Number(dto.lng) } : null;
  }

  private optionalPoint(lat?: number, lng?: number): LatLng | null {
    if (lat == null || lng == null) return null;
    return { lat, lng };
  }

  private resolveZones(
    dto: SearchWorkersDto,
    point: LatLng | null,
    radioKm: number,
    incluirCercanos: boolean,
  ): ResolvedZone[] {
    const selected = new Map<number, ResolvedZone>();
    const add = (zona: ZonaRow, geo: GeoQuadrant | null, coincide: boolean) => {
      const distancia = point && geo ? Number(haversineKm(point, geo.centro).toFixed(2)) : null;
      const current = selected.get(zona.id_zona);
      if (current && current.coincide) return;
      selected.set(zona.id_zona, {
        id_zona: zona.id_zona,
        nombre: zona.nombre,
        tipo: zona.tipo,
        clave: geo?.clave,
        coincide,
        distancia_km: distancia,
      });
    };

    if (dto.id_zona) {
      const zona = [...this.zonasByNombre.values()].find((row) => row.id_zona === dto.id_zona);
      if (!zona) throw new BadRequestException('La zona indicada no existe.');
      if ((zona.estado || '').toUpperCase() !== 'ACTIVA') {
        throw new BadRequestException('La zona indicada no está activa.');
      }
      const geo = findQuadrantByNombre(zona.nombre);
      add(zona, geo, true);
      if (incluirCercanos && geo) {
        this.addNeighbors(geo, add);
        if (point || geo.centro) {
          this.addWithinRadius(point || geo.centro, radioKm, add, geo.nombre);
        }
      }
    }

    if (dto.cuadrante?.trim()) {
      const geo = findQuadrantByNombre(dto.cuadrante);
      const zona = geo
        ? this.zonasByNombre.get(geo.nombre.toLowerCase())
        : this.zonasByNombre.get(dto.cuadrante.trim().toLowerCase());
      if (!zona) {
        throw new BadRequestException(`No se encontró el cuadrante "${dto.cuadrante}".`);
      }
      add(zona, geo, true);
      if (incluirCercanos && geo) {
        this.addNeighbors(geo, add);
        this.addWithinRadius(point || geo.centro, radioKm, add, geo.nombre);
      }
    }

    if (point) {
      for (const geo of GEO_QUADRANTS) {
        const zona = this.zonasByNombre.get(geo.nombre.toLowerCase());
        if (!zona || (zona.estado || '').toUpperCase() !== 'ACTIVA') continue;
        if (pointInBounds(point, geo.bounds)) {
          add(zona, geo, true);
        } else if (incluirCercanos && haversineKm(point, geo.centro) <= radioKm) {
          add(zona, geo, false);
        }
      }
    }

    return [...selected.values()].sort((a, b) => {
      if (a.coincide !== b.coincide) return a.coincide ? -1 : 1;
      return (a.distancia_km ?? 999) - (b.distancia_km ?? 999);
    });
  }

  private addNeighbors(
    geo: GeoQuadrant,
    add: (zona: ZonaRow, geo: GeoQuadrant | null, coincide: boolean) => void,
  ) {
    for (const clave of geo.vecinos || []) {
      const neighbor = GEO_QUADRANTS.find((item) => item.clave === clave);
      if (!neighbor) continue;
      const zona = this.zonasByNombre.get(neighbor.nombre.toLowerCase());
      if (zona) add(zona, neighbor, false);
    }
  }

  private addWithinRadius(
    point: LatLng,
    radioKm: number,
    add: (zona: ZonaRow, geo: GeoQuadrant | null, coincide: boolean) => void,
    exceptNombre?: string,
  ) {
    for (const geo of GEO_QUADRANTS) {
      if (exceptNombre && geo.nombre === exceptNombre) continue;
      if (haversineKm(point, geo.centro) > radioKm) continue;
      const zona = this.zonasByNombre.get(geo.nombre.toLowerCase());
      if (zona) add(zona, geo, false);
    }
  }

  private consulta(dto: SearchWorkersDto, point: LatLng | null, radioKm: number) {
    return {
      lat: point?.lat ?? null,
      lng: point?.lng ?? null,
      id_zona: dto.id_zona ?? null,
      cuadrante: dto.cuadrante?.trim() || null,
      oficio: dto.oficio?.trim() || null,
      radio_km: radioKm,
      incluir_cercanos: dto.incluir_cercanos !== false,
      incluir_ocupados: Boolean(dto.incluir_ocupados),
    };
  }

  private async loadUsuarios(ids: number[]) {
    const unique = [...new Set(ids)];
    const map = new Map<number, UsuarioPublico>();
    if (!unique.length) return map;

    const { data, error } = await this.supabase
      .from('usuario')
      .select('id_usuario, nombre, correo, telefono, estado, modo_activo')
      .in('id_usuario', unique);
    if (error) throw new BadRequestException(error.message);
    for (const row of (data || []) as UsuarioPublico[]) {
      map.set(row.id_usuario, row);
    }
    return map;
  }

  private async ensureZonas() {
    const { data, error } = await this.supabase.from('zona').select('id_zona, nombre, tipo, estado');
    if (error) throw new BadRequestException(error.message);

    this.zonasByNombre = new Map(
      ((data || []) as ZonaRow[]).map((zona) => [zona.nombre.toLowerCase(), zona]),
    );

    const missing = GEO_QUADRANTS.filter(
      (item) => !this.zonasByNombre.has(item.nombre.toLowerCase()),
    );
    if (!missing.length) return;

    for (const item of missing) {
      const created = await this.insertZona({
        nombre: item.nombre,
        tipo: item.tipo,
        estado: 'ACTIVA',
      });
      this.zonasByNombre.set(created.nombre.toLowerCase(), created);
    }
  }

  private async insertZona(payload: { nombre: string; tipo: string; estado: string }) {
    const { data, error } = await this.supabase.from('zona').insert(payload).select('*').single();
    if (!error && data) return data as ZonaRow;

    if (/null value in column ["']?id_zona["']?/i.test(error?.message || '')) {
      const nextId = await this.nextZonaId();
      const { data: retry, error: retryError } = await this.supabase
        .from('zona')
        .insert({ ...payload, id_zona: nextId })
        .select('*')
        .single();
      if (retryError || !retry) {
        throw new BadRequestException(retryError?.message || 'No se pudo crear la zona.');
      }
      return retry as ZonaRow;
    }

    throw new BadRequestException(error?.message || 'No se pudo crear la zona.');
  }

  private async nextZonaId() {
    const { data } = await this.supabase
      .from('zona')
      .select('id_zona')
      .order('id_zona', { ascending: false })
      .limit(1);
    return (Number(data?.[0]?.id_zona) || 0) + 1;
  }
}
