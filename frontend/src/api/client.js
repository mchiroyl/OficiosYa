const API_URL = import.meta.env.VITE_API_URL || '/api';

export class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

export async function api(path, { method = 'GET', body, token, signal } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    signal,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      data.message ||
      (Array.isArray(data.message) ? data.message[0] : null) ||
      'No se pudo completar la solicitud.';
    throw new ApiError(
      Array.isArray(message) ? message[0] : message,
      response.status,
      data,
    );
  }

  return data;
}

export async function apiMultipart(path, { method = 'POST', body, token } = {}) {
  const headers = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      data.message ||
      (Array.isArray(data.message) ? data.message[0] : null) ||
      'No se pudo completar la solicitud.';
    throw new ApiError(
      Array.isArray(message) ? message[0] : message,
      response.status,
      data,
    );
  }

  return data;
}
