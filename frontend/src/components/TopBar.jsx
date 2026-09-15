import Logo from './Logo';
import ModeToggle from './ModeToggle';
import styles from './TopBar.module.css';

export default function TopBar({ mode, onModeChange }) {
  return (
    <header className={styles.bar}>
      <div className={styles.inner}>
        <Logo variant="compact" />
        <div className={styles.toggleWrap}>
          <ModeToggle value={mode} onChange={onModeChange} />
        </div>
      </div>
    </header>
  );
}
