/** Estados visuales del ciclo de contratación (módulo cliente/trabajador). */
export const REQUEST_STATUSES = [
  'Enviada',
  'Aceptada',
  'Rechazada',
  'En Proceso',
  'Cancelada',
  'Finalizada',
];

/** Normaliza estados históricos de ambas ramas. */
export function displayStatus(estado) {
  const aliases = { PENDIENTE: 'Enviada', ENVIADA: 'Enviada', ACEPTADA: 'Aceptada',
    EN_PROCESO: 'En Proceso', 'EN PROCESO': 'En Proceso', RECHAZADA: 'Rechazada',
    CANCELADA: 'Cancelada', FINALIZADA: 'Finalizada', COMPLETADA: 'Finalizada' };
  return aliases[String(estado || 'PENDIENTE').trim().toUpperCase()] || estado;
}

export const STATUS_COLORS = {
  Enviada: { bg: '#e8f0fe', color: '#1a56db', border: '#bfdbfe' },
  Aceptada: { bg: '#ecfdf5', color: '#047857', border: '#a7f3d0' },
  'En Proceso': { bg: '#fff7ed', color: '#c2410c', border: '#fed7aa' },
  Rechazada: { bg: '#fef2f2', color: '#b91c1c', border: '#fecaca' },
  Cancelada: { bg: '#f3f4f6', color: '#4b5563', border: '#e5e7eb' },
  Finalizada: { bg: '#f0fdfa', color: '#0f766e', border: '#99f6e4' },
};
