import { createResource, deleteResource, listResource, updateResource } from './resources';

export const listMyServices = (profileId, token) =>
  listResource('servicios', { id_perfil: profileId, order: 'id_servicio:asc' }, token);
export const listCategories = () => listResource('categorias', { estado: 'ACTIVA', order: 'nombre:asc' });
export const createService = (body, token) => createResource('servicios', body, token);
export const updateService = (id, body, token) => updateResource('servicios', id, body, token);
export const deleteService = (id, token) => deleteResource('servicios', id, token);
