import Logo from './Logo';
import ModeToggle from './ModeToggle';
import { useAuth } from '../auth/AuthContext';
import { Link } from '../router';
import styles from './TopBar.module.css';

export default function TopBar({ mode, onModeChange }) {
  const { isAuthenticated, logout } = useAuth();

  return (
    <header className={styles.bar}>
      <div className={styles.inner}>
        <Link to="/" className={styles.brand} aria-label="Ir al inicio">
          <Logo variant="compact" />
          <span className={styles.brandName}>
            Oficios<span className={styles.brandAccent}>YA</span>
          </span>
        </Link>
        <div className={styles.toggleWrap}>
          <ModeToggle value={mode} onChange={onModeChange} />
          {isAuthenticated ? (
            <nav className={styles.nav} aria-label="Navegación principal">
              <Link to="/" className={styles.navLink}>
                Inicio
              </Link>
              <Link to="/worker/profile" className={styles.navLink}>
                Mi perfil
              </Link>
              <button type="button" className={styles.navButton} onClick={() => logout()}>
                Cerrar sesión
              </button>
            </nav>
          ) : null}
        </div>
      </div>
    </header>
  );
}
