const SERVICE_DETAILS_PREFIX = 'oficiosya-service:v1:';

const DAY_LABELS = {
  lunes: 'Lun',
  martes: 'Mar',
  miercoles: 'Mié',
  jueves: 'Jue',
  viernes: 'Vie',
  sabado: 'Sáb',
  domingo: 'Dom',
};

export function parseServiceContent(value) {
  const raw = typeof value === 'string' ? value : '';
  if (!raw.startsWith(SERVICE_DETAILS_PREFIX)) {
    return { descripcion: raw, tarifa: { tipo: 'a_convenir' }, horario: null, configurado: false };
  }

  try {
    const content = JSON.parse(raw.slice(SERVICE_DETAILS_PREFIX.length));
    return {
      descripcion: typeof content.descripcion === 'string' ? content.descripcion : '',
      tarifa: content.tarifa && typeof content.tarifa === 'object'
        ? content.tarifa
        : { tipo: 'a_convenir' },
      horario: content.horario && typeof content.horario === 'object'
        ? content.horario
        : null,
      configurado: true,
    };
  } catch {
    return { descripcion: raw, tarifa: { tipo: 'a_convenir' }, horario: null, configurado: false };
  }
}

export function serializeServiceContent({ descripcion, tarifa, horario }) {
  return `${SERVICE_DETAILS_PREFIX}${JSON.stringify({
    descripcion: String(descripcion || '').trim(),
    tarifa: {
      tipo: tarifa?.tipo || 'a_convenir',
      monto_desde: tarifa?.monto_desde === '' || tarifa?.monto_desde == null
        ? null
        : Number(tarifa.monto_desde),
      monto_hasta: tarifa?.monto_hasta === '' || tarifa?.monto_hasta == null
        ? null
        : Number(tarifa.monto_hasta),
      moneda: 'GTQ',
    },
    horario: horario?.dias?.length ? {
      dias: horario.dias,
      desde: horario.desde,
      hasta: horario.hasta,
    } : null,
  })}`;
}

export function formatServiceRate(tarifa = {}) {
  if (tarifa.tipo === 'a_convenir') return 'Tarifa a convenir';
  const desde = tarifa.monto_desde;
  const hasta = tarifa.monto_hasta;
  if (desde == null && hasta == null) return 'Tarifa pendiente';
  const currency = tarifa.moneda === 'GTQ' || !tarifa.moneda ? 'Q' : tarifa.moneda;
  const amount = (value) => `${currency}${Number(value).toLocaleString('es-GT', { maximumFractionDigits: 2 })}`;
  const price = desde != null && hasta != null && Number(desde) !== Number(hasta)
    ? `${amount(desde)} – ${amount(hasta)}`
    : amount(desde ?? hasta);
  return `${price} ${tarifa.tipo === 'por_hora' ? 'por hora' : 'por servicio'}`;
}

export function formatServiceSchedule(horario) {
  if (!horario?.dias?.length || !horario.desde || !horario.hasta) return 'Horario por coordinar';
  return `${horario.dias.map((day) => DAY_LABELS[day] || day).join(', ')} · ${horario.desde}–${horario.hasta}`;
}
