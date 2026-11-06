import { StarIcon } from '../icons/Icons';
import styles from './Rating.module.css';

export default function Rating({ value, reviewCount, size = 'md' }) {
  const label =
    reviewCount != null
      ? `Calificación ${value} de 5, ${reviewCount} reseñas`
      : `Calificación ${value} de 5`;

  return (
    <div
      className={[styles.rating, styles[size]].join(' ')}
      role="img"
      aria-label={label}
    >
      <span className={styles.star} aria-hidden="true">
        <StarIcon filled />
      </span>
      <span className={styles.value}>{Number(value).toFixed(1)}</span>
      {reviewCount != null && (
        <span className={styles.count}>· {reviewCount} reseñas</span>
      )}
    </div>
  );
}
