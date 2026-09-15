import { api } from './client';

export function getWorkerProfile(token) {
  return api('/worker/profile', { token });
}

export function updateWorkerProfile(payload, token) {
  return api('/worker/profile', {
    method: 'PUT',
    body: payload,
    token,
  });
}

export function listZonas() {
  return api('/zonas');
}
