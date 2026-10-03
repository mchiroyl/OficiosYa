import { listResource, createResource, updateResource } from './resources';
import { api } from './client';

export function listMessages(requestId, token) {
  return listResource(
    'mensajes',
    { id_solicitud: requestId, order: 'fecha_envio:asc' },
    token,
  );
}

export function sendMessage(payload, token) {
  return createResource('mensajes', payload, token);
}

export function listReports(token) {
  return listResource('reportes', { order: 'fecha_creacion:desc' }, token);
}

export function createReport(payload, token) {
  return createResource('reportes', payload, token);
}

export function updateReport(id, body, token) {
  return updateResource('reportes', id, body, token);
}

export function listUsers(token) {
  return listResource('usuarios', { order: 'id_usuario:asc' }, token);
}

export function updateUserEstado(id, estado, token) {
  return api(`/admin/usuarios/${id}/estado`, {
    method: 'PATCH',
    body: { estado },
    token,
  });
}

export function listCategories(token) {
  return listResource('categorias', { order: 'nombre:asc' }, token);
}

export function createCategory(body, token) {
  return createResource('categorias', body, token);
}

export function updateCategory(id, body, token) {
  return updateResource('categorias', id, body, token);
}

export function deleteCategory(id, token) {
  return api(`/categorias/${id}`, { method: 'DELETE', token });
}

export function listZonesAdmin(token) {
  return listResource('zonas', { order: 'nombre:asc' }, token);
}

export function createZone(body, token) {
  return createResource('zonas', body, token);
}

export function updateZone(id, body, token) {
  return updateResource('zonas', id, body, token);
}

export function deleteZone(id, token) {
  return api(`/zonas/${id}`, { method: 'DELETE', token });
}

export function listWorkerProfiles(token) {
  return listResource('perfiles-trabajador', { order: 'id_perfil:asc' }, token);
}

export function updateWorkerVerification(id, verificado, token) {
  return updateResource('perfiles-trabajador', id, { verificado }, token);
}

export function listReviews(query, token) {
  return listResource('resenas', query, token);
}

export function replyToReview(id, respuesta, token) {
  return updateResource('resenas', id, { respuesta_trabajador: respuesta }, token);
}
