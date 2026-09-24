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

/** Valores que acepta el CHECK actual de Supabase, en orden de preferencia HU → schema. */
export const ESTADO_DB_ALIASES: Record<EstadoSolicitud, readonly string[]> = {
  Enviada: ['Enviada', 'PENDIENTE'],
  Aceptada: ['Aceptada', 'ACEPTADA', 'EN_PROCESO'],
  Rechazada: ['Rechazada', 'RECHAZADA'],
  Cancelada: ['Cancelada', 'CANCELADA'],
  Finalizada: ['Finalizada', 'FINALIZADA', 'COMPLETADA'],
};

export function normalizeEstado(value?: string | null): EstadoSolicitud {
  const actual = (value || '').trim();
  if (!actual || /^(enviada|pendiente)$/i.test(actual)) return 'Enviada';
  if (/^(aceptada|en_proceso)$/i.test(actual)) return 'Aceptada';
  if (/^rechazada$/i.test(actual)) return 'Rechazada';
  if (/^cancelada$/i.test(actual)) return 'Cancelada';
  if (/^(finalizada|completada)$/i.test(actual)) return 'Finalizada';
  if ((ESTADOS_SOLICITUD as readonly string[]).includes(actual)) {
    return actual as EstadoSolicitud;
  }
  return 'Enviada';
}

export function writeCandidates(estado: EstadoSolicitud): string[] {
  const aliases = [...ESTADO_DB_ALIASES[estado]];
  if (estado === 'Rechazada') aliases.push('CANCELADA');
  return aliases;
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
