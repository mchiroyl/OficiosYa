import { useEffect, useState } from 'react';
import AppHeader from '../components/AppHeader';
import StatusBadge from '../components/StatusBadge';
import RequestDetails from '../components/requests/RequestDetails';
import RequestFilters, { filterRequests } from '../components/requests/RequestFilters';
import BackLink from '../components/BackLink';
import { displayStatus } from '../lib/requestStatus';
import { useAuth } from '../auth/AuthContext';
import { listWorkerRequests, updateRequestStatus } from '../api/requests';
import { getWorkerProfile, updateAvailability } from '../api/worker';
import { Link } from '../router';
import styles from './Dashboard.module.css';

export default function WorkerInbox() {
  const { session } = useAuth();
  const token = session?.accessToken;
  const [disponibilidad, setDisponibilidad] = useState('Disponible');
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('Activas');
  const visible = filterRequests(items, filter);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [rejectId, setRejectId] = useState(null);
  const [motivo, setMotivo] = useState('');
  const [toggling, setToggling] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const profile = await getWorkerProfile(token);
      setDisponibilidad(profile.disponibilidad || 'Disponible');
      const data = await listWorkerRequests(token);
      setItems(data.map((item) => ({ ...item, estado: displayStatus(item.estado) })));
    } catch (err) {
      setError(err.message || 'No se pudo cargar la bandeja.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) load();
  }, [token]);

  const toggleAvailability = async () => {
    setToggling(true);
    setError('');
    try {
      const next = disponibilidad === 'Disponible' ? 'Ocupado' : 'Disponible';
      const data = await updateAvailability({ disponibilidad: next }, token);
      setDisponibilidad(data.disponibilidad || next);
    } catch (err) {
      setError(err.message || 'No se pudo cambiar la disponibilidad.');
    } finally {
      setToggling(false);
    }
  };

  const act = async (id, accion) => {
    setBusyId(id);
    setError('');
    try {
      await updateRequestStatus(id, { accion }, token);
      setRejectId(null);
      setMotivo('');
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
        <BackLink to="/">Volver al inicio</BackLink>
        <header className={styles.header}>
          <p className={styles.eyebrow}>PANEL DEL TRABAJADOR</p>
          <h1>Bandeja de solicitudes</h1>
          <p>Acepta, rechaza o da seguimiento a los trabajos entrantes.</p>
        </header>

        <div className={styles.switchRow}>
          <div>
            <strong>Disponibilidad inmediata</strong>
            <p className={styles.meta}>Estado visible en el directorio: {disponibilidad}</p>
          </div>
          <label className={styles.switch} title="Alternar Disponible / Ocupado">
            <input
              type="checkbox"
              checked={disponibilidad === 'Disponible'}
              disabled={toggling}
              onChange={toggleAvailability}
            />
            <span className={styles.slider} />
          </label>
        </div>

        <RequestFilters value={filter} onChange={setFilter} />

        {error && (
          <p className={styles.error} role="alert">
            {error}{' '}<button type="button" onClick={load}>Reintentar</button>
          </p>
        )}

        {loading ? (
          <div className={styles.empty}>Cargando bandeja…</div>
        ) : visible.length === 0 ? (
          <div className={styles.empty}>
            <h2>{items.length ? 'No hay peticiones en esta vista' : 'Sin solicitudes nuevas'}</h2>
            <p>Cuando un cliente te contacte, aparecerán aquí.</p>
          </div>
        ) : (
          <ul className={styles.list}>
            {visible.map((item) => {
              const estado = item.estado || 'Enviada';
              const canDecide = estado === 'Enviada';
              const canFinish = estado === 'Aceptada' || estado === 'En Proceso';
              const canChat = ['Aceptada', 'En Proceso', 'Finalizada'].includes(estado);

              return (
                <li key={item.id_solicitud} className={styles.card}>
                  <div className={styles.cardTop}>
                    <div>
                      <p className={styles.id}>#{item.id_solicitud}</p>
                      <h2>{item.descripcion || 'Solicitud de servicio'}</h2>
                    </div>
                    <StatusBadge estado={estado} />
                  </div>
                  <p className={styles.meta}>
                    {item.ubicacion_aprox ? `Ubicación: ${item.ubicacion_aprox}` : 'Sin ubicación'}
                    {item.fecha_deseada
                      ? ` · ${new Date(item.fecha_deseada).toLocaleString('es-GT')}`
                      : ''}
                  </p>

                  {rejectId === item.id_solicitud && (
                    <div className={styles.reasonBox}>
                      <p>¿Rechazar esta solicitud de servicio?</p>
                      <label htmlFor={`motivo-${item.id_solicitud}`}>Motivo del rechazo</label>
                      <textarea id={`motivo-${item.id_solicitud}`} rows={3} value={motivo}
                        onChange={(event) => setMotivo(event.target.value)}
                        placeholder="Explica brevemente por qué no puedes tomar el trabajo" />
                      <div className={styles.actions}>
                        <button type="button" className={styles.ghost} onClick={() => { setRejectId(null); setMotivo(''); }}>Cancelar</button>
                        <button type="button" className={styles.primary} disabled={busyId === item.id_solicitud || motivo.trim().length < 5}
                          onClick={() => act(item.id_solicitud, 'Rechazar')}>Confirmar rechazo</button>
                      </div>
                    </div>
                  )}
                  <RequestDetails request={item} perspective="worker" />
                  <div className={styles.actions}>
                    {canChat && <Link to={`/chat/${item.id_solicitud}`} className={styles.secondary}>Chat</Link>}
                    {canDecide && <>
                      <button type="button" className={styles.primary} disabled={busyId === item.id_solicitud}
                        onClick={() => act(item.id_solicitud, 'Aceptar')}>Aceptar</button>
                      <button type="button" className={styles.ghost} disabled={busyId === item.id_solicitud}
                        onClick={() => setRejectId(item.id_solicitud)}>Rechazar</button>
                    </>}
                    {estado === 'Aceptada' && <button type="button" className={styles.primary}
                      disabled={busyId === item.id_solicitud}
                      onClick={() => act(item.id_solicitud, 'Iniciar')}>Iniciar trabajo</button>}
                    {canFinish && <button type="button" className={styles.primary}
                      disabled={busyId === item.id_solicitud}
                      onClick={() => act(item.id_solicitud, 'Finalizar')}>Confirmar cierre</button>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
