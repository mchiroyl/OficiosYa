import { useEffect, useState } from 'react';
import AppHeader from '../components/AppHeader';
import { useAuth } from '../auth/AuthContext';
import { getWorkerProfile, updateAvailability } from '../api/worker';
import { listWorkerRequests } from '../api/requests';
import { useNavigate } from '../router';
import styles from './Home.module.css';
import dash from './Dashboard.module.css';
import menu from './ClientHome.module.css';

export default function WorkerHome() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const token = session?.accessToken;
  const [disponibilidad, setDisponibilidad] = useState('Disponible');
  const [pending, setPending] = useState(0);
  const [error, setError] = useState('');
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const profile = await getWorkerProfile(token);
        if (cancelled) return;
        setDisponibilidad(profile.disponibilidad || 'Disponible');
        const requests = await listWorkerRequests(profile.id_perfil, token);
        if (cancelled) return;
        setPending(requests.filter((r) => r.estado === 'Enviada').length);
      } catch (err) {
        if (!cancelled) setError(err.message || 'No se pudo cargar el panel.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const toggleAvailability = async () => {
    setToggling(true);
    setError('');
    try {
      const next = disponibilidad === 'Disponible' ? 'Ocupado' : 'Disponible';
      const data = await updateAvailability({ disponibilidad: next }, token);
      setDisponibilidad(data.disponibilidad || next);
    } catch (err) {
      setError(err.message || 'No se pudo cambiar la disponibilidad.');
    } finally {
      setToggling(false);
    }
  };

  return (
    <div className={styles.page}>
      <AppHeader />
      <main className={styles.main}>
        <section className={styles.hero} aria-labelledby="worker-home-title">
          <p className={styles.eyebrow}>MODO TRABAJADOR · EL ASINTAL</p>
          <h1 id="worker-home-title">
            Tu panel de
            <br />
            trabajo
          </h1>
          <p>Gestiona solicitudes, tu oferta pública y tu disponibilidad.</p>
        </section>

        {error && (
          <p className={dash.error} role="alert">
            {error}
          </p>
        )}

        <div className={dash.switchRow}>
          <div>
            <strong>Disponibilidad inmediata</strong>
            <p className={dash.meta}>Estado en el directorio: {disponibilidad}</p>
          </div>
          <label className={dash.switch}>
            <input
              type="checkbox"
              checked={disponibilidad === 'Disponible'}
              disabled={toggling}
              onChange={toggleAvailability}
            />
            <span className={dash.slider} />
          </label>
        </div>

        <section className={menu.section}>
          <div className={menu.sectionHead}>
            <h2>Accesos rápidos</h2>
            <p>Herramientas del modo trabajador.</p>
          </div>
          <div className={menu.grid}>
            <button
              type="button"
              className={menu.tile}
              onClick={() => navigate('/trabajador/bandeja')}
            >
              <span className={menu.tileIcon}>B</span>
              <span className={menu.tileBody}>
                <strong>Bandeja de solicitudes</strong>
                <small>
                  {pending > 0 ? `${pending} nueva(s)` : 'Aceptar o rechazar trabajos'}
                </small>
              </span>
            </button>
            <button
              type="button"
              className={menu.tile}
              onClick={() => navigate('/worker/profile')}
            >
              <span className={menu.tileIcon}>O</span>
              <span className={menu.tileBody}>
                <strong>Mi oferta</strong>
                <small>Tarifas, zonas, horarios y portafolio</small>
              </span>
            </button>
            <button
              type="button"
              className={menu.tile}
              onClick={() => navigate('/mis-solicitudes')}
            >
              <span className={menu.tileIcon}>C</span>
              <span className={menu.tileBody}>
                <strong>Vista cliente</strong>
                <small>También puedes contratar como cliente</small>
              </span>
            </button>
            <button
              type="button"
              className={menu.tile}
              onClick={() => navigate('/worker/profile')}
            >
              <span className={menu.tileIcon}>V</span>
              <span className={menu.tileBody}>
                <strong>Verificación DPI</strong>
                <small>Sube tu documento para el distintivo</small>
              </span>
            </button>
          </div>
        </section>
      </main>
      <footer className={styles.footer}>OficiosYA · Modo Trabajador</footer>
    </div>
  );
}
