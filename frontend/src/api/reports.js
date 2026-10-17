import { api } from './client';

export function createReport(payload, token) {
  return api('/reports/create', {
    method: 'POST',
    body: payload,
    token,
  });
}

export function listAdminReports(token, { estado, tipo_recurso } = {}) {
  const params = new URLSearchParams();
  if (estado) params.set('estado', estado);
  if (tipo_recurso) params.set('tipo_recurso', tipo_recurso);
  const query = params.toString();
  return api(`/admin/reports${query ? `?${query}` : ''}`, { token });
}

export function updateAdminReport(id, payload, token) {
  return api(`/admin/reports/${id}`, {
    method: 'PATCH',
    body: payload,
    token,
  });
}
