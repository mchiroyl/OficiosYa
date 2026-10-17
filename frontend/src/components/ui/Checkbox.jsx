import styles from './Checkbox.module.css';

export default function Checkbox({ id, label, checked, onChange, disabled }) {
  return (
    <label htmlFor={id} className={`${styles.label} ${disabled ? styles.disabled : ''}`}>
      <input
        id={id}
        type="checkbox"
        className={styles.input}
        checked={checked}
        onChange={onChange}
        disabled={disabled}
      />
      <span className={styles.box} aria-hidden="true">
        <svg viewBox="0 0 12 10" className={styles.check}>
          <path
            d="M1 5l3.5 3.5L11 1"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span className={styles.text}>{label}</span>
    </label>
  );
}
