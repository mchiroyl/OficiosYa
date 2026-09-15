import TopBar from '../TopBar';
import styles from './PageShell.module.css';

/** Shell de página completa con TopBar (perfil público, etc.). */
export default function PageShell({ mode, onModeChange, children }) {
  return (
    <div className={styles.shell}>
      <TopBar mode={mode} onModeChange={onModeChange} />
      <main className={styles.main}>{children}</main>
    </div>
  );
}
