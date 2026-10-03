import { api, apiMultipart } from './client';

export function listPortfolio(token) {
  return api('/portfolio', { token });
}

export function uploadPortfolioPhoto({ file, titulo, descripcion, token }) {
  const body = new FormData();
  body.append('file', file);
  if (titulo) body.append('titulo', titulo);
  if (descripcion) body.append('descripcion', descripcion);
  return apiMultipart('/portfolio/upload', { body, token });
}
