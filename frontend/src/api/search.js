import { api } from './client';

export function listQuadrants({ lat, lng } = {}) {
  const query = new URLSearchParams();
  if (lat != null) query.set('lat', String(lat));
  if (lng != null) query.set('lng', String(lng));
  const suffix = query.toString() ? `?${query}` : '';
  return api(`/search/quadrants${suffix}`);
}

export function searchWorkers(filters = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value == null || value === '') continue;
    query.set(key, String(value));
  }
  const suffix = query.toString() ? `?${query}` : '';
  return api(`/search/workers${suffix}`);
}

export function searchProfiles(filters = {}, { signal } = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value == null || value === '') continue;
    query.set(key, String(value));
  }
  const suffix = query.toString() ? `?${query}` : '';
  return api(`/search/profiles${suffix}`, { signal });
}
