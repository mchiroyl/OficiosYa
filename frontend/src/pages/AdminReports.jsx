import { useEffect, useState } from 'react';
import AdminHeader from '../components/AdminHeader';
import BackLink from '../components/BackLink';
import { useAuth } from '../auth/AuthContext';
import { getAdminDpi, listPendingDpi, reviewDpi } from '../api/identity';
import { listAdminReports, updateAdminReport } from '../api/reports';
import styles from './AdminReports.module.css';

export default function AdminReports({ initialTab = 'reportes' }) {
  const { session, isAdmin } = useAuth();
  const token = session?.accessToken;
  const [tab, setTab] = useState(initialTab);
  const [reports, setReports] = useState([]);
  const [pendingDpi, setPendingDpi] = useState([]);
  const [selectedDpi, setSelectedDpi] = useState(null);
  const [estado, setEstado] = useState('PENDIENTE');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const [reportResult, dpiResult] = await Promise.allSettled([
        listAdminReports(token, { estado }),
        listPendingDpi(token),
      ]);
      if (reportResult.status === 'fulfilled') setReports(Array.isArray(reportResult.value) ? reportResult.value : []);
      if (dpiResult.status === 'fulfilled') setPendingDpi(Array.isArray(dpiResult.value) ? dpiResult.value : []);
      if (reportResult.status === 'rejected' || dpiResult.status === 'rejected') {
        setError('No se pudieron cargar todos los datos de moderación. Revisa la conexión y vuelve a intentar.');
      }
    } catch (err) {
      setError(err.message || 'No se pudo cargar la moderación.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, estado]);

  const resolveReport = async (id, nextEstado, accion_cuenta) => {
    setError('');
    setSuccess('');
    try {
      await updateAdminReport(id, { estado: nextEstado, accion_cuenta }, token);
      setSuccess(`Reporte #${id} marcado como ${nextEstado}.`);
      await load();
    } catch (err) {
      setError(err.message || 'No se pudo actualizar el reporte.');
    }
  };

  const openDpi = async (idUsuario) => {
    setError('');
    try {
      setSelectedDpi(await getAdminDpi(idUsuario, token));
    } catch (err) {
      setError(err.message || 'No se pudieron abrir los documentos.');
    }
  };

  const decideDpi = async (decision) => {
    if (!selectedDpi) return;
    const motivo =
      decision === 'rechazar'
        ? window.prompt('Motivo del rechazo (obligatorio):')
        : undefined;
    if (decision === 'rechazar' && !motivo?.trim()) return;
    setError('');
    setSuccess('');
    try {
      const saved = await reviewDpi(selectedDpi.id_usuario, { decision, motivo }, token);
      setSelectedDpi(saved);
      setSuccess(decision === 'aprobar' ? 'DPI aprobado. El perfil quedó verificado.' : 'DPI rechazado.');
      await load();
    } catch (err) {
      setError(err.message || 'No se pudo resolver la verificación.');
    }
  };

  if (!isAdmin) {
    return (
      <div className={styles.page}>
        <div className={styles.inner}>
          <BackLink to="/admin">Volver al panel</BackLink>
          <p className={styles.error} role="alert">
            Esta sección es solo para el equipo de moderación.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <AdminHeader />
      <div className={styles.inner}>
        <BackLink to="/admin">Volver al panel</BackLink>
        <header className={styles.header}>
          <h1 className={styles.title}>Moderación</h1>
          <p className={styles.subtitle}>Revisa denuncias y documentos de identidad desde una misma bandeja.</p>
        </header>

        <div className={styles.tabs}>
          <button type="button" className={tab === 'reportes' ? styles.tabOn : styles.tab} onClick={() => setTab('reportes')}>
            Denuncias
          </button>
          <button type="button" className={tab === 'dpi' ? styles.tabOn : styles.tab} onClick={() => setTab('dpi')}>
            Verificaciones DPI
          </button>
        </div>

        {error ? <p className={styles.error} role="alert">{error}</p> : null}
        {success ? <p className={styles.success} role="status">{success}</p> : null}

        {tab === 'reportes' ? (
          <section>
            <label className={styles.filter}>
              Estado
              <select value={estado} onChange={(e) => setEstado(e.target.value)}>
                <option value="PENDIENTE">Pendiente</option>
                <option value="RESUELTO">Resuelto</option>
                <option value="RECHAZADO">Rechazado</option>
                <option value="todos">Todos</option>
              </select>
            </label>
            {loading ? (
              <p className={styles.status}>Cargando denuncias…</p>
            ) : reports.length === 0 ? (
              <div className={styles.empty}><strong>Sin denuncias en esta vista.</strong><span>Los reportes nuevos aparecerán aquí cuando un usuario los envíe.</span></div>
            ) : (
              <ul className={styles.list}>
                {reports.map((item) => (
                  <li key={item.id_reporte} className={styles.card}>
                    <p className={styles.meta}>
                      #{item.id_reporte} · {item.estado} · {item.tipo_recurso} #{item.id_recurso}
                    </p>
                    <p>{item.motivo}</p>
                    <p className={styles.meta}>
                      Denuncia {item.denunciante?.nombre || 'Usuario'} →{' '}
                      {item.cuenta_denunciada
                        ? `${item.cuenta_denunciada.nombre} (${item.cuenta_denunciada.estado})`
                        : 'cuenta no resuelta'}
                    </p>
                    {item.estado === 'PENDIENTE' ? (
                      <div className={styles.actions}>
                        <button className={styles.primary} type="button" onClick={() => resolveReport(item.id_reporte, 'RESUELTO')}>
                          Resolver
                        </button>
                        <button className={styles.secondary} type="button" onClick={() => resolveReport(item.id_reporte, 'RESUELTO', 'SUSPENDIDO')}>
                          Resolver y suspender
                        </button>
                        <button className={styles.secondary} type="button" onClick={() => resolveReport(item.id_reporte, 'RECHAZADO')}>
                          Rechazar
                        </button>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : (
          <section>
            {loading ? (
              <p className={styles.status}>Cargando verificaciones…</p>
            ) : pendingDpi.length === 0 ? (
              <div className={styles.empty}><strong>Sin DPI pendientes.</strong><span>Los documentos enviados por trabajadores aparecerán aquí para revisión.</span></div>
            ) : (
              <ul className={styles.list}>
                {pendingDpi.map((item) => (
                  <li key={item.id_usuario} className={styles.card}>
                    <strong>{item.nombre}</strong>
                    <p className={styles.meta}>
                      Usuario #{item.id_usuario} · {item.oficio_principal} · {item.dpi?.numero_enmascarado || 'sin número'}
                    </p>
                    <button className={styles.secondary} type="button" onClick={() => openDpi(item.id_usuario)}>
                      Revisar documentos
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {selectedDpi?.dpi ? (
              <div className={styles.preview}>
                <h2>{selectedDpi.nombre}</h2>
                <p className={styles.meta}>
                  {selectedDpi.dpi.numero_enmascarado || 'DPI sin número'} · {selectedDpi.dpi.estado}
                </p>
                <div className={styles.docs}>
                  {selectedDpi.dpi.frente_url ? (
                    <a href={selectedDpi.dpi.frente_url} target="_blank" rel="noreferrer">
                      <img src={selectedDpi.dpi.frente_url} alt="Frente del DPI" />
                    </a>
                  ) : null}
                  {selectedDpi.dpi.reverso_url ? (
                    <a href={selectedDpi.dpi.reverso_url} target="_blank" rel="noreferrer">
                      <img src={selectedDpi.dpi.reverso_url} alt="Reverso del DPI" />
                    </a>
                  ) : null}
                </div>
                <div className={styles.actions}>
                  <button className={styles.primary} type="button" onClick={() => decideDpi('aprobar')}>
                    Aprobar y verificar
                  </button>
                  <button className={styles.secondary} type="button" onClick={() => decideDpi('rechazar')}>
                    Rechazar
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        )}
      </div>
    </div>
  );
}
