import styles from './Logo.module.css';

export default function Logo({ variant = 'default' }) {
  const className = [
    styles.logo,
    variant === 'compact' ? styles.compact : styles.default,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={className} aria-label="OficiosYA" role="img">
      <div className={styles.mark}>
        <span className={styles.dot} />
        <span className={styles.bar} />
      </div>
      {variant !== 'compact' && <span className={styles.wordmark}>Oficios<span>YA</span></span>}
    </div>
  );
}
