import styles from './Divider.module.css';

export default function Divider({ text }) {
  return (
    <div className={styles.divider} role="separator">
      <span className={styles.line} />
      <span className={styles.text}>{text}</span>
      <span className={styles.line} />
    </div>
  );
}
