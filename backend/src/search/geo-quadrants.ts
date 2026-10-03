import { boundsFromCenter, centerOfBounds, GeoBounds, LatLng } from './geo.util';

export type QuadrantTipo = 'CUADRANTE' | 'ZONA' | 'MUNICIPIO';

export type GeoQuadrant = {
  clave: string;
  nombre: string;
  tipo: QuadrantTipo;
  bounds: GeoBounds;
  centro: LatLng;
  vecinos?: string[];
};

function quadrant(
  clave: string,
  nombre: string,
  bounds: GeoBounds,
  vecinos: string[] = [],
): GeoQuadrant {
  return {
    clave,
    nombre,
    tipo: 'CUADRANTE',
    bounds,
    centro: centerOfBounds(bounds),
    vecinos,
  };
}

function namedZone(
  clave: string,
  nombre: string,
  tipo: Exclude<QuadrantTipo, 'CUADRANTE'>,
  centro: LatLng,
  radiusKm = 2.4,
): GeoQuadrant {
  return {
    clave,
    nombre,
    tipo,
    centro,
    bounds: boundsFromCenter(centro, radiusKm),
  };
}

export const GEO_QUADRANTS: GeoQuadrant[] = [
  quadrant('gt-nw', 'Cuadrante Noroeste', { north: 14.72, south: 14.65, west: -90.6, east: -90.53 }, [
    'gt-n',
    'gt-w',
    'gt-c',
  ]),
  quadrant('gt-n', 'Cuadrante Norte', { north: 14.72, south: 14.65, west: -90.53, east: -90.48 }, [
    'gt-nw',
    'gt-ne',
    'gt-c',
  ]),
  quadrant('gt-ne', 'Cuadrante Noreste', { north: 14.72, south: 14.65, west: -90.48, east: -90.41 }, [
    'gt-n',
    'gt-e',
    'gt-c',
  ]),
  quadrant('gt-w', 'Cuadrante Oeste', { north: 14.65, south: 14.58, west: -90.6, east: -90.53 }, [
    'gt-nw',
    'gt-c',
    'gt-sw',
  ]),
  quadrant('gt-c', 'Cuadrante Centro', { north: 14.65, south: 14.58, west: -90.53, east: -90.48 }, [
    'gt-n',
    'gt-s',
    'gt-e',
    'gt-w',
  ]),
  quadrant('gt-e', 'Cuadrante Este', { north: 14.65, south: 14.58, west: -90.48, east: -90.41 }, [
    'gt-ne',
    'gt-c',
    'gt-se',
  ]),
  quadrant('gt-sw', 'Cuadrante Suroeste', { north: 14.58, south: 14.51, west: -90.6, east: -90.53 }, [
    'gt-w',
    'gt-s',
    'gt-c',
  ]),
  quadrant('gt-s', 'Cuadrante Sur', { north: 14.58, south: 14.51, west: -90.53, east: -90.48 }, [
    'gt-c',
    'gt-sw',
    'gt-se',
  ]),
  quadrant('gt-se', 'Cuadrante Sureste', { north: 14.58, south: 14.51, west: -90.48, east: -90.41 }, [
    'gt-e',
    'gt-s',
    'gt-c',
  ]),
  namedZone('zona-1', 'Zona 1', 'ZONA', { lat: 14.642, lng: -90.513 }),
  namedZone('zona-4', 'Zona 4', 'ZONA', { lat: 14.622, lng: -90.516 }),
  namedZone('zona-9', 'Zona 9', 'ZONA', { lat: 14.61, lng: -90.515 }),
  namedZone('zona-10', 'Zona 10', 'ZONA', { lat: 14.598, lng: -90.513 }),
  namedZone('zona-13', 'Zona 13', 'ZONA', { lat: 14.58, lng: -90.527 }),
  namedZone('zona-14', 'Zona 14', 'ZONA', { lat: 14.585, lng: -90.508 }),
  namedZone('zona-15', 'Zona 15', 'ZONA', { lat: 14.65, lng: -90.49 }),
  namedZone('mixco', 'Mixco', 'MUNICIPIO', { lat: 14.633, lng: -90.606 }, 4),
  namedZone('villa-nueva', 'Villa Nueva', 'MUNICIPIO', { lat: 14.526, lng: -90.587 }, 4),
  namedZone('pinula', 'Santa Catarina Pinula', 'MUNICIPIO', { lat: 14.568, lng: -90.496 }, 3),
  namedZone('chinautla', 'Chinautla', 'MUNICIPIO', { lat: 14.703, lng: -90.499 }, 3.5),
];

export function findQuadrantByClave(clave: string) {
  return GEO_QUADRANTS.find((item) => item.clave === clave) || null;
}

export function findQuadrantByNombre(nombre: string) {
  const needle = nombre.trim().toLowerCase();
  return (
    GEO_QUADRANTS.find((item) => item.nombre.toLowerCase() === needle) ||
    GEO_QUADRANTS.find((item) => item.clave === needle) ||
    null
  );
}
