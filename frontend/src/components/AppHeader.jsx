import Logo from './Logo';
import ModeToggle from './ModeToggle';
import { Link, useNavigate, usePath } from '../router';
import { useAuth } from '../auth/AuthContext';
import { useMode } from '../mode/ModeContext';
import { isAdminUser } from '../lib/admin';
import styles from './AppHeader.module.css';

export default function AppHeader() {
  const { logout, user, session, isAdmin } = useAuth();
  const { mode, setMode, isClient, isWorker } = useMode();
  const path = usePath();
  const navigate = useNavigate();
  const admin = isAdminUser(user);
  const hasWorkerProfile = Boolean(
    session?.tienePerfilTrabajador || session?.perfilTrabajador,
  );

  const linkClass = (to) => {
    if (to === '/') return path === '/' ? styles.active : undefined;
    return path === to || path.startsWith(`${to}/`) ? styles.active : undefined;
  };

  const onModeChange = (next) => {
    setMode(next);
    navigate('/', { replace: true });
  };

  return (
    <header className={styles.bar}>
      <div className={styles.inner}>
        <Link to="/" className={styles.brand}>
          <Logo variant="compact" />
          <span>
            Oficios<span className={styles.accent}>YA</span>
          </span>
        </Link>

        <div className={styles.modeWrap}>
          <ModeToggle value={mode} onChange={onModeChange} />
        </div>

        <nav className={styles.nav} aria-label="Principal">
          {isClient && (
            <>
              <Link to="/" className={linkClass('/')}>
                Inicio
              </Link>
              <Link to="/buscar" className={linkClass('/buscar')}>
                Directorio
              </Link>
              <Link to="/mis-solicitudes" className={linkClass('/mis-solicitudes')}>
                Mis solicitudes
              </Link>
              <Link to="/chat" className={linkClass('/chat')}>
                Chat
              </Link>
            </>
          )}
          {isWorker && (
            <>
              <Link to="/" className={linkClass('/')}>
                Panel
              </Link>
              <Link to="/trabajador/bandeja" className={linkClass('/trabajador/bandeja')}>
                Bandeja
              </Link>
              <Link to="/chat" className={linkClass('/chat')}>
                Chat
              </Link>
              <Link to="/worker/profile" className={linkClass('/worker/profile')}>
                Mi oferta
              </Link>
              {!hasWorkerProfile && (
                <Link to="/worker/profile" className={styles.hint}>
                  Completar perfil
                </Link>
              )}
            </>
          )}
          {(admin || isAdmin) && (
            <Link to="/admin/reports" className={linkClass('/admin')}>
              Admin
            </Link>
          )}
          <button type="button" className={styles.logout} onClick={() => logout()}>
            Cerrar sesión
          </button>
        </nav>
      </div>
    </header>
  );
}
