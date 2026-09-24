import { api } from './client';

export function createReview(payload, token) {
  return api('/reviews/create', { method: 'POST', body: payload, token });
}
