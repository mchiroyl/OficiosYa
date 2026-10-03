import { api } from './client';

export function listWorkerServices(workerId, { signal } = {}) {
  const query = new URLSearchParams({ id_perfil: String(workerId), activo: 'true' });
  return api(`/servicios?${query}`, { signal });
}

export function createRequest(payload, token) {
  return api('/requests/create', { method: 'POST', body: payload, token });
}

export function updateRequestStatus(id, accionOrPayload, token) {
  const accion =
    typeof accionOrPayload === 'string' ? accionOrPayload : accionOrPayload?.accion;
  return api(`/requests/${id}/status`, {
    method: 'PUT',
    body: { accion },
    token,
  });
}

/** Solicitudes del cliente autenticado. */
export function listClientRequests(token) {
  return api('/requests/client', { token });
}

/** Solicitudes dirigidas al perfil del trabajador. */
export function listWorkerRequests(token) {
  return api('/requests/worker', { token });
}

export function getRequest(id, token) {
  return api(`/solicitudes/${id}`, { token });
}
