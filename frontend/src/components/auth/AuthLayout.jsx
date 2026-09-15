import TopBar from '../TopBar';
import styles from './AuthLayout.module.css';

export default function AuthLayout({ mode, onModeChange, children }) {
  return (
    <div className={styles.shell}>
      <TopBar mode={mode} onModeChange={onModeChange} />
      <main className={styles.main}>{children}</main>
    </div>
  );
}
