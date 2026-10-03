import { api, apiMultipart } from './client';

export function getMyDpi(token) {
  return api('/identity/dpi', { token });
}

export function submitDpi({ frente, reverso, numero_dpi }, token) {
  const body = new FormData();
  body.append('frente', frente);
  body.append('reverso', reverso);
  if (numero_dpi) body.append('numero_dpi', numero_dpi);
  return apiMultipart('/identity/dpi', { body, token });
}

export function listPendingDpi(token) {
  return api('/admin/identity', { token });
}

export function getAdminDpi(idUsuario, token) {
  return api(`/admin/identity/${idUsuario}`, { token });
}

export function reviewDpi(idUsuario, payload, token) {
  return api(`/admin/identity/${idUsuario}`, {
    method: 'PATCH',
    body: payload,
    token,
  });
}
