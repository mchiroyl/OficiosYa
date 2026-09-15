import styles from './Logo.module.css';

export default function Logo({ variant = 'default' }) {
  const className = [
    styles.logo,
    variant === 'compact' ? styles.compact : styles.default,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={className} aria-label="Logo del proyecto" role="img">
      <div className={styles.mark}>
        <span className={styles.dot} />
        <span className={styles.bar} />
      </div>
    </div>
  );
}
