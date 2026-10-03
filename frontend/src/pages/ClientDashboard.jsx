import { useEffect, useState } from 'react';
import AppHeader from '../components/AppHeader';
import StatusBadge from '../components/StatusBadge';
import ReviewForm from '../components/reviews/ReviewForm';
import ReportModal from '../components/reports/ReportModal';
import { useAuth } from '../auth/AuthContext';
import { listClientRequests, updateRequestStatus } from '../api/requests';
import { Link } from '../router';
import styles from './Dashboard.module.css';

export default function ClientDashboard() {
  const { session, user } = useAuth();
  const token = session?.accessToken;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [reviewFor, setReviewFor] = useState(null);
  const [reportFor, setReportFor] = useState(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await listClientRequests(user.id_usuario, token);
      setItems(data);
    } catch (err) {
      setError(err.message || 'No se pudieron cargar tus solicitudes.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token && user?.id_usuario) load();
  }, [token, user?.id_usuario]);

  const act = async (id, accion) => {
    setBusyId(id);
    setError('');
    try {
      await updateRequestStatus(id, { accion }, token);
      await load();
    } catch (err) {
      setError(err.message || 'No se pudo actualizar la solicitud.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className={styles.page}>
      <AppHeader />
      <main className={styles.main}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>DASHBOARD DEL CLIENTE</p>
            <h1>Mis solicitudes</h1>
            <p>Da seguimiento a tus trabajos y finaliza cuando el servicio esté listo.</p>
          </div>
        </header>

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        {loading ? (
          <div className={styles.empty}>Cargando solicitudes…</div>
        ) : items.length === 0 ? (
          <div className={styles.empty}>
            <h2>Aún no tienes solicitudes</h2>
            <p>Busca un profesional y envía tu primera solicitud de servicio.</p>
            <Link to="/" className={styles.primaryLink}>
              Ir a buscar
            </Link>
          </div>
        ) : (
          <ul className={styles.list}>
            {items.map((item) => {
              const estado = item.estado || 'Enviada';
              const canCancel = estado === 'Enviada' || estado === 'Aceptada' || estado === 'En Proceso';
              const canFinish = estado === 'Aceptada' || estado === 'En Proceso';
              const canReview = estado === 'Finalizada';
              const canChat = ['Aceptada', 'En Proceso', 'Finalizada'].includes(estado);

              return (
                <li key={item.id_solicitud} className={styles.card}>
                  <div className={styles.cardTop}>
                    <div>
                      <p className={styles.id}>Solicitud #{item.id_solicitud}</p>
                      <h2>{item.descripcion?.slice(0, 80) || 'Solicitud de servicio'}</h2>
                    </div>
                    <StatusBadge estado={estado} />
                  </div>
                  <p className={styles.meta}>
                    {item.fecha_deseada
                      ? `Fecha deseada: ${new Date(item.fecha_deseada).toLocaleString('es-GT')}`
                      : 'Sin fecha programada'}
                    {item.urgente ? ' · Urgente' : ''}
                  </p>
                  <div className={styles.actions}>
                    {canChat && (
                      <Link to={`/chat/${item.id_solicitud}`} className={styles.secondary}>
                        Abrir chat
                      </Link>
                    )}
                    {canCancel && (
                      <button
                        type="button"
                        className={styles.ghost}
                        disabled={busyId === item.id_solicitud}
                        onClick={() => act(item.id_solicitud, 'Cancelar')}
                      >
                        Cancelar
                      </button>
                    )}
                    {canFinish && (
                      <button
                        type="button"
                        className={styles.primary}
                        disabled={busyId === item.id_solicitud}
                        onClick={() => act(item.id_solicitud, 'Finalizar')}
                      >
                        Finalizar servicio
                      </button>
                    )}
                    {canReview && (
                      <button
                        type="button"
                        className={styles.primary}
                        onClick={() => setReviewFor(item)}
                      >
                        Calificar
                      </button>
                    )}
                    <button
                      type="button"
                      className={styles.ghost}
                      onClick={() => setReportFor(item)}
                    >
                      Reportar
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>

      {reviewFor && (
        <ReviewForm
          request={reviewFor}
          onClose={() => setReviewFor(null)}
          onDone={() => {
            setReviewFor(null);
            load();
          }}
        />
      )}
      {reportFor && (
        <ReportModal
          context={{
            tipo: 'solicitud',
            id_referencia: reportFor.id_solicitud,
            id_reportado: reportFor.id_trabajador,
          }}
          onClose={() => setReportFor(null)}
        />
      )}
    </div>
  );
}
