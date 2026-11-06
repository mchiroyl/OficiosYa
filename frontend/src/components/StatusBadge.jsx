import { displayStatus, STATUS_COLORS } from '../lib/requestStatus';
import styles from './StatusBadge.module.css';

export default function StatusBadge({ estado }) {
  const label = displayStatus(estado);
  const palette = STATUS_COLORS[label] || STATUS_COLORS.Enviada;
  return (
    <span
      className={styles.badge}
      style={{
        background: palette.bg,
        color: palette.color,
        borderColor: palette.border,
      }}
    >
      {label}
    </span>
  );
}
