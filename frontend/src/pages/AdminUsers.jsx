import { useEffect, useState } from 'react';
import AppHeader from '../components/AppHeader';
import BackLink from '../components/BackLink';
import { useAuth } from '../auth/AuthContext';
import { isAdminUser } from '../lib/admin';
import { listUsers, updateUserEstado } from '../api/admin';
import styles from './Admin.module.css';

export default function AdminUsers() {
  const { session, user } = useAuth();
  const token = session?.accessToken;
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null);

  const load = () =>
    listUsers(token)
      .then(setItems)
      .catch((err) => setError(err.message || 'No se pudieron cargar usuarios.'));

  useEffect(() => {
    if (token && isAdminUser(user)) load();
  }, [token, user]);

  const setEstado = async (id, estado) => {
    setBusy(id);
    setError('');
    try {
      await updateUserEstado(id, estado, token);
      await load();
    } catch (err) {
      setError(err.message || 'No se pudo actualizar el estado.');
    } finally {
      setBusy(null);
    }
  };

  if (!isAdminUser(user)) {
    return (
      <div className={styles.page}>
        <AppHeader />
        <main className={styles.main}><div className={styles.empty}>Sin permisos.</div></main>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <AppHeader />
      <main className={styles.main}>
        <BackLink to="/admin">Volver al dashboard</BackLink>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>ADMIN</p>
            <h1>Gestión de cuentas</h1>
            <p>Lista tabular de usuarios. Suspende o reactiva cuentas.</p>
          </div>
        </header>
        {error && <p className={styles.error}>{error}</p>}
        <div className={styles.tableWrap}>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Nombre</th>
                <th>Correo</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id_usuario}>
                  <td>{row.id_usuario}</td>
                  <td>{row.nombre}</td>
                  <td>{row.correo}</td>
                  <td>{row.estado}</td>
                  <td>
                    <div className={styles.actions}>
                      {row.estado === 'SUSPENDIDO' ? (
                        <button
                          type="button"
                          className={styles.btn}
                          disabled={busy === row.id_usuario}
                          onClick={() => setEstado(row.id_usuario, 'ACTIVO')}
                        >
                          Reactivar
                        </button>
                      ) : (
                        <button
                          type="button"
                          className={styles.danger}
                          disabled={busy === row.id_usuario}
                          onClick={() => setEstado(row.id_usuario, 'SUSPENDIDO')}
                        >
                          Banear
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
