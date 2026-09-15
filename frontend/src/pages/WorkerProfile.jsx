import { useEffect, useState } from 'react';
import Button from '../components/ui/Button';
import Checkbox from '../components/ui/Checkbox';
import { useAuth } from '../auth/AuthContext';
import { getWorkerProfile, listZonas, updateWorkerProfile } from '../api/worker';
import styles from './WorkerProfile.module.css';

const TIPOS_TARIFA = [
  { value: 'por_hora', label: 'Por hora' },
  { value: 'por_servicio', label: 'Por servicio' },
  { value: 'a_convenir', label: 'A convenir' },
];

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
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'No se pudo cargar el perfil.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (token) load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const toggleZona = (idZona) => {
    setCobertura((prev) =>
      prev.includes(idZona) ? prev.filter((id) => id !== idZona) : [...prev, idZona],
    );
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

    setSaving(true);
    try {
      const payload = {
        tarifas: {
          tipo: tarifas.tipo,
          moneda: tarifas.moneda || 'GTQ',
          notas: tarifas.notas.trim() || undefined,
        },
        cobertura,
      };

      if (showMontos) {
        payload.tarifas.monto_desde = parseNumber(tarifas.monto_desde);
        payload.tarifas.monto_hasta = parseNumber(tarifas.monto_hasta);
      }

      await updateWorkerProfile(payload, token);
      setSuccess('Tarifas y zonas de cobertura actualizadas correctamente.');
    } catch (err) {
      setError(err.message || 'No se pudo guardar los cambios.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loading}>Cargando perfil...</div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <header className={styles.header}>
          <h1 className={styles.title}>Tarifas y cobertura</h1>
          <p className={styles.subtitle}>
            Configura tus tarifas y las zonas donde ofreces tus servicios.
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
