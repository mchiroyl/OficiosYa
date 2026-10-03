export type LatLng = { lat: number; lng: number };

export type GeoBounds = {
  north: number;
  south: number;
  east: number;
  west: number;
};

export function toRad(value: number) {
  return (value * Math.PI) / 180;
}

export function haversineKm(a: LatLng, b: LatLng) {
  const earthKm = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * earthKm * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function pointInBounds(point: LatLng, bounds: GeoBounds) {
  return (
    point.lat >= bounds.south &&
    point.lat <= bounds.north &&
    point.lng >= bounds.west &&
    point.lng <= bounds.east
  );
}

export function boundsFromCenter(center: LatLng, radiusKm: number): GeoBounds {
  const latDelta = radiusKm / 111;
  const lngDelta = radiusKm / (111 * Math.cos(toRad(center.lat)) || 1);
  return {
    north: center.lat + latDelta,
    south: center.lat - latDelta,
    east: center.lng + lngDelta,
    west: center.lng - lngDelta,
  };
}

export function centerOfBounds(bounds: GeoBounds): LatLng {
  return {
    lat: (bounds.north + bounds.south) / 2,
    lng: (bounds.east + bounds.west) / 2,
  };
}
