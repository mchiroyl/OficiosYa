import { useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { createReport } from '../../api/reports';
import styles from '../reviews/ReviewForm.module.css';

const REASONS = [
  'Abuso o acoso',
  'Lenguaje inapropiado',
  'Incumplimiento del servicio',
  'Perfil falso o engañoso',
  'Otro',
];

export default function ReportModal({ context, onClose }) {
  const { session } = useAuth();
  const [motivo, setMotivo] = useState(REASONS[0]);
  const [detalle, setDetalle] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (detalle.trim().length < 10) {
      setError('Describe el problema con al menos 10 caracteres.');
      return;
    }
    const idRecurso = Number(context?.id_referencia || context?.id_reportado || 0);
    if (!idRecurso) {
      setError('No se pudo identificar el recurso a reportar.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await createReport(
        {
          tipo_recurso: context?.tipo || 'usuario',
          id_recurso: idRecurso,
          motivo: `${motivo}: ${detalle.trim()}`.slice(0, 2000),
          categoria: motivo.slice(0, 80),
        },
        session.accessToken,
      );
      setDone(true);
    } catch (err) {
      setError(err.message || 'No se pudo enviar el reporte.');
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
        aria-labelledby="report-title"
      >
        <header className={styles.header}>
          <h2 id="report-title">Enviar reporte</h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </header>

        {done ? (
          <>
            <p className={styles.hint}>
              Tu reporte fue enviado a los administradores. Gracias por ayudar a mantener la
              comunidad segura.
            </p>
            <div className={styles.actions}>
              <button type="button" className={styles.primary} onClick={onClose}>
                Cerrar
              </button>
            </div>
          </>
        ) : (
          <>
            <label className={styles.field}>
              Motivo
              <select value={motivo} onChange={(e) => setMotivo(e.target.value)}>
                {REASONS.map((reason) => (
                  <option key={reason} value={reason}>
                    {reason}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              Detalle
              <textarea
                rows={4}
                maxLength={2000}
                value={detalle}
                onChange={(e) => setDetalle(e.target.value)}
                placeholder="Explica qué ocurrió…"
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
                {busy ? 'Enviando…' : 'Enviar reporte'}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
