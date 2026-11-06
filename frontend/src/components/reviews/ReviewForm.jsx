import { useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { createReview } from '../../api/reviews';
import styles from './ReviewForm.module.css';

export default function ReviewForm({ request, onClose, onDone }) {
  const { session } = useAuth();
  const [stars, setStars] = useState(5);
  const [hover, setHover] = useState(0);
  const [comentario, setComentario] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (request?.estado !== 'Finalizada') {
      setError('Solo puedes calificar cuando el servicio esté Finalizada.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await createReview(
        {
          id_solicitud: Number(request.id_solicitud),
          calificacion: stars,
          comentario: comentario.trim() || undefined,
        },
        session.accessToken,
      );
      onDone?.();
    } catch (err) {
      setError(err.message || 'No se pudo guardar la reseña.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.backdrop} role="presentation" onClick={onClose}>
      <form
        className={styles.panel}
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-title"
      >
        <header className={styles.header}>
          <h2 id="review-title">Calificar servicio</h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </header>
        <p className={styles.hint}>Solicitud #{request.id_solicitud}. Elige de 1 a 5 estrellas.</p>
        <div className={styles.stars} role="radiogroup" aria-label="Calificación">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              className={styles.star}
              aria-checked={stars === value}
              role="radio"
              aria-label={`${value} ${value === 1 ? 'estrella' : 'estrellas'}`}
              onMouseEnter={() => setHover(value)}
              onMouseLeave={() => setHover(0)}
              onClick={() => setStars(value)}
            >
              {(hover || stars) >= value ? '★' : '☆'}
            </button>
          ))}
        </div>
        <label className={styles.field}>
          Reseña escrita
          <textarea
            rows={4}
            maxLength={2000}
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            placeholder="Cuéntanos cómo fue el servicio…"
          />
        </label>
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        <div className={styles.actions}>
          <button type="button" className={styles.ghost} onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button type="submit" className={styles.primary} disabled={busy}>
            {busy ? 'Enviando…' : 'Publicar reseña'}
          </button>
        </div>
      </form>
    </div>
  );
}
