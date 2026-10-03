import { api } from './client';
import { listResource, updateResource } from './resources';

export function createReview(payload, token) {
  return api('/reviews/create', { method: 'POST', body: payload, token });
}

export function listReviews(query = {}, token) {
  return listResource('resenas', query, token);
}

export function replyToReview(id, respuesta, token) {
  return updateResource('resenas', id, { respuesta_trabajador: respuesta }, token);
}
