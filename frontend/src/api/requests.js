import { api, apiMultipart } from './client';

export function listWorkerServices(workerId, { signal } = {}) {
  const query = new URLSearchParams({ id_perfil: String(workerId), activo: 'true' });
  return api(`/servicios?${query}`, { signal });
}

export function createRequest(payload, token) {
  return api('/requests/create', { method: 'POST', body: payload, token });
}

export function uploadRequestImages(id, files, token) {
  const body = new FormData();
  [...files].slice(0, 3).forEach((file) => body.append('files', file));
  return apiMultipart(`/requests/${id}/images`, { body, token });
}

export function updateRequestStatus(id, accionOrPayload, token) {
  const payload = typeof accionOrPayload === 'string'
    ? { accion: accionOrPayload }
    : accionOrPayload;
  return api(`/requests/${id}/status`, {
    method: 'PUT',
    body: payload,
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
