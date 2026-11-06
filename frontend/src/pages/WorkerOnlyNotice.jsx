import AppHeader from '../components/AppHeader';
import { Link, useNavigate } from '../router';
import { useMode } from '../mode/ModeContext';
import styles from './Home.module.css';
import dash from './Dashboard.module.css';

export default function WorkerOnlyNotice() {
  const { setMode } = useMode();
  const navigate = useNavigate();

  return (
    <div className={styles.page}>
      <AppHeader />
      <main className={styles.main}>
        <section className={dash.empty} aria-labelledby="worker-only-title">
          <h1 id="worker-only-title">Esta sección es solo para trabajadores</h1>
          <p>
            Para publicar servicios y atender solicitudes, cambia a Modo Trabajador y completa tu
            perfil.
          </p>
          <div className={dash.actions}>
            <button
              type="button"
              className={dash.primary}
              onClick={() => {
                setMode('worker');
                navigate('/', { replace: true });
              }}
            >
              Cambiar a Modo Trabajador
            </button>
            <Link to="/" className={dash.primaryLink}>
              Volver al inicio
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
