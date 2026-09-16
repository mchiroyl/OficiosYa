import Logo from './Logo';
import ModeToggle from './ModeToggle';
import { Link } from '../router';
import { useAuth } from '../auth/AuthContext';
import styles from './TopBar.module.css';

export default function TopBar({ mode, onModeChange }) {
  const { isAuthenticated, logout } = useAuth();

  return (
    <header className={styles.bar}>
      <div className={styles.inner}>
        <Link to="/" className={styles.homeLink} aria-label="Ir al inicio">
          <Logo variant="compact" />
        </Link>
        <div className={styles.toggleWrap}>
          <ModeToggle value={mode} onChange={onModeChange} />
          {isAuthenticated && (
            <button type="button" className={styles.logout} onClick={() => logout()}>
              Cerrar sesión
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
