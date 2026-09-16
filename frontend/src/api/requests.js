import { api } from './client';

export function createRequest(payload, token) {
  return api('/requests/create', { method: 'POST', body: payload, token });
}

export function updateRequestStatus(id, accion, token) {
  return api(`/requests/${id}/status`, { method: 'PUT', body: { accion }, token });
}
