export const ROL_CLIENTE = 'CLIENTE';
export const ROL_TRABAJADOR = 'TRABAJADOR';
export const ROL_ADMINISTRADOR = 'ADMINISTRADOR';

export type RolUsuario = typeof ROL_CLIENTE | typeof ROL_TRABAJADOR | typeof ROL_ADMINISTRADOR;

export function normalizeRol(value?: string | null): RolUsuario | null {
  const rol = String(value || '')
    .trim()
    .toUpperCase();
  if (rol === ROL_ADMINISTRADOR || rol === 'ADMIN' || rol === 'ADMINISTRADOR') {
    return ROL_ADMINISTRADOR;
  }
  if (rol === ROL_TRABAJADOR || rol === 'TRABAJADOR') return ROL_TRABAJADOR;
  if (rol === ROL_CLIENTE || rol === 'CLIENTE') return ROL_CLIENTE;
  return null;
}

export function rolDesdeModo(modo?: string | null): RolUsuario {
  return String(modo || '').toLowerCase() === 'trabajador' ? ROL_TRABAJADOR : ROL_CLIENTE;
}
