export const ROL_CLIENTE = 'CLIENTE';
export const ROL_TRABAJADOR = 'TRABAJADOR';
export const ROL_ADMINISTRADOR = 'ADMINISTRADOR';

export function userRol(user) {
  const rol = String(user?.rol || '').trim().toUpperCase();
  if (rol === ROL_ADMINISTRADOR || rol === 'ADMIN') return ROL_ADMINISTRADOR;
  if (rol === ROL_TRABAJADOR) return ROL_TRABAJADOR;
  if (rol === ROL_CLIENTE) return ROL_CLIENTE;
  if (user?.es_admin === true) return ROL_ADMINISTRADOR;
  return ROL_CLIENTE;
}

export function isAdminUser(user) {
  return userRol(user) === ROL_ADMINISTRADOR;
}

export function rolLabel(user) {
  const rol = userRol(user);
  if (rol === ROL_ADMINISTRADOR) return 'Administrador';
  if (rol === ROL_TRABAJADOR) return 'Trabajador';
  return 'Cliente';
}
