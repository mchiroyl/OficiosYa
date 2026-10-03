import { api } from './client';
import { listResource } from './resources';

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
export function listClientRequests(clientId, token) {
  return listResource('solicitudes', { id_cliente: clientId, order: 'fecha_creacion:desc' }, token);
}

/** Solicitudes dirigidas al perfil del trabajador. */
export function listWorkerRequests(workerProfileId, token) {
  return listResource('solicitudes', { id_trabajador: workerProfileId, order: 'fecha_creacion:desc' }, token);
}

export function getRequest(id, token) {
  return api(`/solicitudes/${id}`, { token });
}
