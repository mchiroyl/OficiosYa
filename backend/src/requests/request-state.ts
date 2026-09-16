export const ESTADO_SOLICITUD_INICIAL = 'Enviada';

export const ESTADOS_SOLICITUD = [
  'Enviada',
  'Aceptada',
  'Rechazada',
  'Cancelada',
  'Finalizada',
] as const;

export const ACCIONES_SOLICITUD = ['Aceptar', 'Rechazar', 'Cancelar', 'Finalizar'] as const;

export type EstadoSolicitud = (typeof ESTADOS_SOLICITUD)[number];
export type AccionSolicitud = (typeof ACCIONES_SOLICITUD)[number];
export type RolSolicitud = 'cliente' | 'trabajador' | 'ambos';

type Transicion = {
  next: EstadoSolicitud;
  rol: RolSolicitud;
};

const TRANSICIONES: Record<string, Partial<Record<AccionSolicitud, Transicion>>> = {
  Enviada: {
    Aceptar: { next: 'Aceptada', rol: 'trabajador' },
    Rechazar: { next: 'Rechazada', rol: 'trabajador' },
    Cancelar: { next: 'Cancelada', rol: 'cliente' },
  },
  Aceptada: {
    Finalizar: { next: 'Finalizada', rol: 'ambos' },
    Cancelar: { next: 'Cancelada', rol: 'cliente' },
  },
};

export function normalizeEstado(value?: string | null): EstadoSolicitud {
  if (!value || value === 'PENDIENTE') return 'Enviada';
  if ((ESTADOS_SOLICITUD as readonly string[]).includes(value)) {
    return value as EstadoSolicitud;
  }
  return 'Enviada';
}

export function resolveTransition(estadoActual: string, accion: AccionSolicitud) {
  const actual = normalizeEstado(estadoActual);
  const transicion = TRANSICIONES[actual]?.[accion];
  if (!transicion) {
    return {
      ok: false as const,
      actual,
      mensaje: `No se puede ${accion.toLowerCase()} una solicitud en estado ${actual}.`,
    };
  }
  return { ok: true as const, actual, ...transicion };
}

export function actorPuede(rol: RolSolicitud, esCliente: boolean, esTrabajador: boolean) {
  if (rol === 'cliente') return esCliente;
  if (rol === 'trabajador') return esTrabajador;
  return esCliente || esTrabajador;
}
