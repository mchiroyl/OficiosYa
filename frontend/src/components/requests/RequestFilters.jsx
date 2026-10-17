import styles from '../../pages/Dashboard.module.css';
import { displayStatus } from '../../lib/requestStatus';

export function filterRequests(items, filter) {
  return items.filter((item) => {
    const finished = ['Finalizada', 'Rechazada', 'Cancelada'].includes(displayStatus(item.estado));
    return filter === 'Todas' || (filter === 'Finalizadas' ? finished : !finished);
  });
}

export default function RequestFilters({ value, onChange }) {
  return (
    <div className={styles.filters} role="group" aria-label="Filtrar solicitudes">
      {['Activas', 'Finalizadas', 'Todas'].map((filter) => (
        <button key={filter} type="button" aria-pressed={value === filter}
          className={value === filter ? styles.primary : styles.ghost}
          onClick={() => onChange(filter)}>{filter}</button>
      ))}
    </div>
  );
}
