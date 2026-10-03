import styles from './ModeToggle.module.css';

const MODES = [
  { value: 'client', label: 'Modo Cliente' },
  { value: 'worker', label: 'Modo Trabajador' },
];

export default function ModeToggle({ value = 'client', onChange }) {
  return (
    <div
      className={styles.toggle}
      role="group"
      aria-label="Selector de modo de acceso"
    >
      {MODES.map((mode) => {
        const isActive = value === mode.value;

        return (
          <button
            key={mode.value}
            type="button"
            className={`${styles.option} ${isActive ? styles.active : ''}`}
            aria-pressed={isActive}
            onClick={() => {
              if (!isActive) onChange?.(mode.value);
            }}
          >
            <span className={styles.label}>{mode.label}</span>
          </button>
        );
      })}
    </div>
  );
}
