import { io } from 'socket.io-client';
import { api, apiMultipart } from './client';

export function listConversations(token) {
  return api('/chat/conversations', { token });
}

export function listChatMessages(idSolicitud, token, { after, limit } = {}) {
  const params = new URLSearchParams();
  if (after) params.set('after', String(after));
  if (limit) params.set('limit', String(limit));
  const query = params.toString();
  return api(`/chat/threads/${idSolicitud}/messages${query ? `?${query}` : ''}`, { token });
}

export function pollChatMessages(idSolicitud, token, { after, timeout = 25, signal } = {}) {
  const params = new URLSearchParams();
  if (after) params.set('after', String(after));
  if (timeout) params.set('timeout', String(timeout));
  return api(`/chat/threads/${idSolicitud}/poll?${params.toString()}`, { token, signal });
}

export function sendChatText(idSolicitud, contenido, token) {
  return api(`/chat/threads/${idSolicitud}/messages`, {
    method: 'POST',
    body: { contenido },
    token,
  });
}

export function sendChatImage(idSolicitud, file, token, contenido) {
  const body = new FormData();
  body.append('file', file);
  if (contenido) body.append('contenido', contenido);
  return apiMultipart(`/chat/threads/${idSolicitud}/images`, { body, token });
}

export function chatSocketOrigin() {
  const apiUrl = import.meta.env.VITE_API_URL || '/api';
  if (apiUrl.startsWith('http')) {
    return new URL(apiUrl).origin;
  }
  return window.location.origin;
}

export function connectChatSocket(token) {
  return io(`${chatSocketOrigin()}/chat`, {
    auth: { token },
    transports: ['websocket', 'polling'],
    withCredentials: true,
  });
}
