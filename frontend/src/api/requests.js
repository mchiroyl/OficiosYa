import { api } from './client';

export function listWorkerServices(workerId, { signal } = {}) {
  const query = new URLSearchParams({ id_perfil: String(workerId), activo: 'true' });
  return api(`/servicios?${query}`, { signal });
}

export function createRequest(payload, token) {
  return api('/requests/create', { method: 'POST', body: payload, token });
}

export function updateRequestStatus(id, accion, token) {
  return api(`/requests/${id}/status`, { method: 'PUT', body: { accion }, token });
}
