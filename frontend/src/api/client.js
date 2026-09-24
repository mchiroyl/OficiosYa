import { readSession, sessionUsesRemember, writeSession } from '../auth/storage';

const API_URL = import.meta.env.VITE_API_URL || '/api';
const NO_REFRESH = new Set([
  '/auth/login',
  '/auth/register',
  '/auth/refresh-token',
  '/auth/forgot-password',
  '/auth/reset-password',
]);

export class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

function readMessage(data) {
  const message =
    data.message ||
    (Array.isArray(data.message) ? data.message[0] : null) ||
    'No se pudo completar la solicitud.';
  return Array.isArray(message) ? message[0] : message;
}

async function refreshAccessToken() {
  const current = readSession();
  if (!current?.refreshToken) return null;
  const response = await fetch(`${API_URL}/auth/refresh-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: current.refreshToken }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) return null;
  const next = {
    ...current,
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    expiresAt: data.expiresAt,
  };
  writeSession(next, current.rememberMe ?? sessionUsesRemember());
  return next.accessToken;
}

export async function api(path, { method = 'GET', body, token, signal, _retry } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const accessToken = token || readSession()?.accessToken;
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    signal,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));

  if (response.status === 401 && !_retry && !NO_REFRESH.has(path)) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return api(path, { method, body, token: refreshed, signal, _retry: true });
    }
  }

  if (!response.ok) {
    throw new ApiError(readMessage(data), response.status, data);
  }

  return data;
}

export async function apiMultipart(path, { method = 'POST', body, token } = {}) {
  const headers = {};
  const accessToken = token || readSession()?.accessToken;
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiError(readMessage(data), response.status, data);
  }

  return data;
}
