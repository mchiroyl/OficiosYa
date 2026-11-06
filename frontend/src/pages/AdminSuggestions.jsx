import { useEffect, useState } from 'react';
import AdminHeader from '../components/AdminHeader';
import BackLink from '../components/BackLink';
import { useAuth } from '../auth/AuthContext';
import { isAdminUser } from '../lib/admin';
import { listOficioSuggestions, reviewOficioSuggestion } from '../api/admin';
import styles from './Admin.module.css';

export default function AdminSuggestions() {
  const { session, user } = useAuth();
  const token = session?.accessToken;
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null);
  const [filtro, setFiltro] = useState('PENDIENTE');

  const load = () =>
    listOficioSuggestions(token, filtro)
      .then(setItems)
      .catch((err) => setError(err.message || 'No se pudieron cargar las sugerencias.'));

  useEffect(() => {
    if (token && isAdminUser(user)) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user, filtro]);

  const decide = async (id, accion) => {
    setBusy(id);
    setError('');
    try {
      await reviewOficioSuggestion(id, accion, token);
      await load();
    } catch (err) {
      setError(err.message || 'No se pudo actualizar la sugerencia.');
    } finally {
      setBusy(null);
    }
  };

  if (!isAdminUser(user)) {
    return (
      <div className={styles.page}>
        <AdminHeader />
        <main className={styles.main}><div className={styles.empty}>Sin permisos.</div></main>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <AdminHeader />
      <main className={styles.main}>
        <BackLink to="/admin">Volver al dashboard</BackLink>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>ADMIN</p>
            <h1>Sugerencias de oficios</h1>
            <p>Aprueba categorías nuevas propuestas por clientes o trabajadores. Al aprobarlas se agregan al catálogo.</p>
          </div>
        </header>
        {error && <p className={styles.error}>{error}</p>}
        <div className={styles.actions} style={{ marginBottom: 16 }}>
          {['PENDIENTE', 'APROBADA', 'RECHAZADA', 'todos'].map((value) => (
            <button
              key={value}
              type="button"
              className={filtro === value ? styles.btn : styles.ghost}
              onClick={() => setFiltro(value)}
            >
              {value === 'todos' ? 'Todas' : value.charAt(0) + value.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
        <div className={styles.tableWrap}>
          <table>
            <thead>
              <tr>
                <th>Oficio</th>
                <th>Descripción</th>
                <th>Solicitado por</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.length ? items.map((row) => (
                <tr key={row.id_sugerencia}>
                  <td>{row.nombre}</td>
                  <td>{row.descripcion || '—'}</td>
                  <td>
                    {row.autor?.nombre || 'Usuario'}
                    <div style={{ color: '#979797', fontSize: 12 }}>{row.autor?.correo}</div>
                  </td>
                  <td>{row.estado}</td>
                  <td>
                    {row.estado === 'PENDIENTE' ? (
                      <div className={styles.actions}>
                        <button
                          type="button"
                          className={styles.btn}
                          disabled={busy === row.id_sugerencia}
                          onClick={() => decide(row.id_sugerencia, 'aprobar')}
                        >
                          Aprobar
                        </button>
                        <button
                          type="button"
                          className={styles.danger}
                          disabled={busy === row.id_sugerencia}
                          onClick={() => decide(row.id_sugerencia, 'rechazar')}
                        >
                          Rechazar
                        </button>
                      </div>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5}>No hay sugerencias en este filtro. Las propuestas enviadas por trabajadores aparecerán aquí.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
