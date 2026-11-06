import { api } from './client';

function toList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

export async function listResource(path, query = {}, token) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value == null || value === '') continue;
    params.set(key, String(value));
  }
  const suffix = params.toString() ? `?${params}` : '';
  const data = await api(`/${path}${suffix}`, { token });
  return toList(data);
}

export function getResource(path, id, token) {
  return api(`/${path}/${id}`, { token });
}

export function createResource(path, body, token) {
  return api(`/${path}`, { method: 'POST', body, token });
}

export function updateResource(path, id, body, token) {
  return api(`/${path}/${id}`, { method: 'PATCH', body, token });
}

export function deleteResource(path, id, token) {
  return api(`/${path}/${id}`, { method: 'DELETE', token });
}
