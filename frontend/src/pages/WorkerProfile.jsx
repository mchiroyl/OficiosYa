import { useEffect, useState } from 'react';
import BackLink from '../components/BackLink';
import Button from '../components/ui/Button';
import Checkbox from '../components/ui/Checkbox';
import { useAuth } from '../auth/AuthContext';
import { getWorkerProfile, listZonas, updateWorkerAvailability, updateWorkerProfile } from '../api/worker';
import styles from './WorkerProfile.module.css';

const TIPOS_TARIFA = [
  { value: 'por_hora', label: 'Por hora' },
  { value: 'por_servicio', label: 'Por servicio' },
  { value: 'a_convenir', label: 'A convenir' },
];

const DIAS = [
  { value: 'lunes', label: 'Lunes' },
  { value: 'martes', label: 'Martes' },
  { value: 'miercoles', label: 'Miércoles' },
  { value: 'jueves', label: 'Jueves' },
  { value: 'viernes', label: 'Viernes' },
  { value: 'sabado', label: 'Sábado' },
  { value: 'domingo', label: 'Domingo' },
];

const EMPTY_HORARIO = { dia: 'lunes', desde: '08:00', hasta: '17:00' };

const EMPTY_TARIFAS = {
  tipo: 'por_hora',
  monto_desde: '',
  monto_hasta: '',
  moneda: 'GTQ',
  notas: '',
};

function parseNumber(value) {
  if (value === '' || value == null) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toHHmm(value) {
  return String(value || '').slice(0, 5);
}

export default function WorkerProfile() {
  const { session } = useAuth();
  const token = session?.accessToken;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [zonas, setZonas] = useState([]);
  const [cobertura, setCobertura] = useState([]);
  const [tarifas, setTarifas] = useState(EMPTY_TARIFAS);
  const [horarios, setHorarios] = useState([]);
  const [disponibilidad, setDisponibilidad] = useState('Disponible');
  const [toggling, setToggling] = useState(false);

  const showMontos = tarifas.tipo !== 'a_convenir';

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError('');
      try {
        const [profile, zonasData] = await Promise.all([
          getWorkerProfile(token),
          listZonas(),
        ]);

        if (cancelled) return;

        const items = Array.isArray(zonasData) ? zonasData : zonasData?.data || [];
        setZonas(items.filter((zona) => (zona.estado || '').toUpperCase() === 'ACTIVA'));

        const current = profile.tarifas || {};
        setTarifas({
          tipo: current.tipo || 'por_hora',
          monto_desde: current.monto_desde ?? '',
          monto_hasta: current.monto_hasta ?? '',
          moneda: current.moneda || 'GTQ',
          notas: current.notas || '',
        });
        setCobertura((profile.cobertura || []).map((zona) => zona.id_zona));
        setHorarios(
          (profile.horarios || []).map((slot) => ({
            dia: slot.dia || 'lunes',
            desde: slot.desde || '08:00',
            hasta: slot.hasta || '17:00',
          })),
        );
        setDisponibilidad(profile.disponibilidad === 'Ocupado' ? 'Ocupado' : 'Disponible');

        try {
          const raw = sessionStorage.getItem('oficiosya.registerSuccess');
          if (raw) {
            sessionStorage.removeItem('oficiosya.registerSuccess');
            const created = JSON.parse(raw);
            setSuccess(created.message || 'Cuenta creada exitosamente.');
          }
        } catch {
          // ignore
        }
      } catch (err) {
        if (!cancelled) {
          if (err.status === 404) {
            setError('');
          } else {
            setError(err.message || 'No se pudo cargar el perfil.');
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (token) {
      load();
    } else {
      setLoading(false);
      setError('Debes iniciar sesión para ver tu perfil.');
    }
    return () => {
      cancelled = true;
    };
  }, [token]);

  const toggleZona = (idZona) => {
    setCobertura((prev) =>
      prev.includes(idZona) ? prev.filter((id) => id !== idZona) : [...prev, idZona],
    );
  };

  const handleAvailability = async () => {
    setError('');
    setSuccess('');
    setToggling(true);
    try {
      const next = disponibilidad === 'Disponible' ? 'Ocupado' : 'Disponible';
      const profile = await updateWorkerAvailability({ disponibilidad: next }, token);
      setDisponibilidad(profile.disponibilidad === 'Ocupado' ? 'Ocupado' : 'Disponible');
      setSuccess(
        profile.disponibilidad === 'Ocupado'
          ? 'Ahora figuras como Ocupado.'
          : 'Ahora figuras como Disponible.',
      );
    } catch (err) {
      setError(err.message || 'No se pudo cambiar la disponibilidad.');
    } finally {
      setToggling(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (showMontos) {
      const desde = parseNumber(tarifas.monto_desde);
      const hasta = parseNumber(tarifas.monto_hasta);
      if (desde != null && hasta != null && hasta < desde) {
        setError('El monto hasta no puede ser menor que el monto desde.');
        return;
      }
    }

    const horarioInvalido = horarios.find((slot) => toHHmm(slot.hasta) <= toHHmm(slot.desde));
    if (horarioInvalido) {
      setError(`El horario de ${horarioInvalido.dia} debe terminar después de iniciar.`);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        tarifas: {
          tipo: tarifas.tipo,
          moneda: tarifas.moneda || 'GTQ',
          notas: tarifas.notas.trim() || undefined,
        },
        horarios: horarios.map((slot) => ({
          dia: slot.dia,
          desde: toHHmm(slot.desde),
          hasta: toHHmm(slot.hasta),
        })),
        cobertura,
      };

      if (showMontos) {
        payload.tarifas.monto_desde = parseNumber(tarifas.monto_desde);
        payload.tarifas.monto_hasta = parseNumber(tarifas.monto_hasta);
      }

      await updateWorkerProfile(payload, token);
      setSuccess('Datos actualizados correctamente.');
    } catch (err) {
      setError(err.message || 'No se pudo guardar los cambios.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.inner}>
          <BackLink to="/">Volver al menú principal</BackLink>
          <div className={styles.loading}>Cargando perfil...</div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <BackLink to="/">Volver al menú principal</BackLink>
        <header className={styles.header}>
          <h1 className={styles.title}>Perfil y disponibilidad</h1>
          <p className={styles.subtitle}>
            Configura tarifas, horarios, cobertura y el estado público Disponible/Ocupado.
          </p>
        </header>

        <div className={styles.card}>
          <form className={styles.form} onSubmit={handleSubmit} noValidate>
            {error && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}
            {success && (
              <p className={styles.success} role="status">
                {success}
              </p>
            )}

            <section>
              <h2 className={styles.sectionTitle}>Disponibilidad pública</h2>
              <p className={styles.message}>
                Estado actual:{' '}
                <span
                  className={
                    disponibilidad === 'Disponible' ? styles.available : styles.occupied
                  }
                >
                  {disponibilidad}
                </span>
              </p>
              <Button
                type="button"
                variant="outline"
                loading={toggling}
                disabled={toggling || saving}
                onClick={handleAvailability}
              >
                {disponibilidad === 'Disponible' ? 'Marcar como Ocupado' : 'Marcar como Disponible'}
              </Button>
            </section>

            <section>
              <h2 className={styles.sectionTitle}>Tarifas</h2>
            </section>

            <div>
              <label htmlFor="tarifa-tipo" className={styles.fieldLabel}>
                Tipo de tarifa
              </label>
              <select
                id="tarifa-tipo"
                className={styles.select}
                value={tarifas.tipo}
                onChange={(e) => setTarifas((prev) => ({ ...prev, tipo: e.target.value }))}
                disabled={saving}
              >
                {TIPOS_TARIFA.map((tipo) => (
                  <option key={tipo.value} value={tipo.value}>
                    {tipo.label}
                  </option>
                ))}
              </select>
            </div>

            {showMontos && (
              <div className={styles.row}>
                <div>
                  <label htmlFor="tarifa-desde" className={styles.fieldLabel}>
                    Monto desde
                  </label>
                  <input
                    id="tarifa-desde"
                    type="number"
                    min="0"
                    step="0.01"
                    className={styles.input}
                    placeholder="50"
                    value={tarifas.monto_desde}
                    onChange={(e) =>
                      setTarifas((prev) => ({ ...prev, monto_desde: e.target.value }))
                    }
                    disabled={saving}
                  />
                </div>
                <div>
                  <label htmlFor="tarifa-hasta" className={styles.fieldLabel}>
                    Monto hasta
                  </label>
                  <input
                    id="tarifa-hasta"
                    type="number"
                    min="0"
                    step="0.01"
                    className={styles.input}
                    placeholder="120"
                    value={tarifas.monto_hasta}
                    onChange={(e) =>
                      setTarifas((prev) => ({ ...prev, monto_hasta: e.target.value }))
                    }
                    disabled={saving}
                  />
                </div>
              </div>
            )}

            <div>
              <label htmlFor="tarifa-moneda" className={styles.fieldLabel}>
                Moneda
              </label>
              <input
                id="tarifa-moneda"
                type="text"
                className={styles.input}
                value={tarifas.moneda}
                onChange={(e) => setTarifas((prev) => ({ ...prev, moneda: e.target.value }))}
                disabled={saving}
                maxLength={10}
              />
            </div>

            <div>
              <label htmlFor="tarifa-notas" className={styles.fieldLabel}>
                Notas (opcional)
              </label>
              <textarea
                id="tarifa-notas"
                className={styles.textarea}
                placeholder="Ej. Visita técnica desde Q80"
                value={tarifas.notas}
                onChange={(e) => setTarifas((prev) => ({ ...prev, notas: e.target.value }))}
                disabled={saving}
                rows={2}
              />
            </div>

            <section>
              <h2 className={styles.sectionTitle}>Horarios</h2>
              <p className={styles.hint}>Indica los turnos en los que atiendes solicitudes.</p>
              {horarios.length === 0 ? (
                <p className={styles.message}>Aún no hay horarios. Agrega al menos uno si quieres publicarlos.</p>
              ) : (
                <div className={styles.slots}>
                  {horarios.map((slot, index) => (
                    <div key={`${slot.dia}-${index}`} className={styles.slot}>
                      <select
                        aria-label={`Día ${index + 1}`}
                        className={styles.select}
                        value={slot.dia}
                        disabled={saving}
                        onChange={(e) =>
                          setHorarios((prev) =>
                            prev.map((item, i) =>
                              i === index ? { ...item, dia: e.target.value } : item,
                            ),
                          )
                        }
                      >
                        {DIAS.map((dia) => (
                          <option key={dia.value} value={dia.value}>
                            {dia.label}
                          </option>
                        ))}
                      </select>
                      <input
                        type="time"
                        aria-label={`Desde ${index + 1}`}
                        className={styles.input}
                        value={slot.desde}
                        disabled={saving}
                        onChange={(e) =>
                          setHorarios((prev) =>
                            prev.map((item, i) =>
                              i === index ? { ...item, desde: e.target.value } : item,
                            ),
                          )
                        }
                      />
                      <input
                        type="time"
                        aria-label={`Hasta ${index + 1}`}
                        className={styles.input}
                        value={slot.hasta}
                        disabled={saving}
                        onChange={(e) =>
                          setHorarios((prev) =>
                            prev.map((item, i) =>
                              i === index ? { ...item, hasta: e.target.value } : item,
                            ),
                          )
                        }
                      />
                      <button
                        type="button"
                        className={styles.removeSlot}
                        disabled={saving}
                        onClick={() =>
                          setHorarios((prev) => prev.filter((_, i) => i !== index))
                        }
                      >
                        Quitar
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <Button
                type="button"
                variant="outline"
                disabled={saving || horarios.length >= 14}
                onClick={() => setHorarios((prev) => [...prev, { ...EMPTY_HORARIO }])}
              >
                Agregar horario
              </Button>
            </section>

            <section>
              <h2 className={styles.sectionTitle}>Zonas de cobertura</h2>
            </section>

            {zonas.length === 0 ? (
              <p className={styles.message}>No hay zonas disponibles en este momento.</p>
            ) : (
              <div className={styles.zones}>
                {zonas.map((zona) => (
                  <div key={zona.id_zona} className={styles.zoneItem}>
                    <Checkbox
                      id={`zona-${zona.id_zona}`}
                      label={`${zona.nombre}${zona.tipo ? ` · ${zona.tipo}` : ''}`}
                      checked={cobertura.includes(zona.id_zona)}
                      onChange={() => toggleZona(zona.id_zona)}
                      disabled={saving}
                    />
                  </div>
                ))}
              </div>
            )}

            <Button type="submit" loading={saving} disabled={saving}>
              Guardar cambios
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
