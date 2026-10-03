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

export function updateWorkerAvailability(payload, token) {
  return api('/worker/availability', {
    method: 'PUT',
    body: payload || {},
    token,
  });
}

/** Alias usado por el panel de modo trabajador. */
export function updateAvailability(payload, token) {
  return updateWorkerAvailability(payload, token);
}

export function listZonas() {
  return api('/zonas');
}

export function getPublicProfile(id, token) {
  return api(`/perfiles-trabajador/${id}`, { token });
}
