import { useEffect, useState } from 'react';
import AdminHeader from '../components/AdminHeader';
import BackLink from '../components/BackLink';
import { Link, useSearch } from '../router';
import { useAuth } from '../auth/AuthContext';
import { isAdminUser, rolLabel } from '../lib/admin';
import { approveUser, listUsers, rejectUser, updateUserEstado } from '../api/admin';
import styles from './Admin.module.css';

export default function AdminUsers() {
  const { session, user } = useAuth();
  const token = session?.accessToken;
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null);
  const search = useSearch();
  const role = new URLSearchParams(search).get('rol');
  const visible = items.filter((row) => !isAdminUser(row) && (!role || String(row.rol || '').toUpperCase() === role));

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

  const aprobar = async (id) => {
    setBusy(id);
    setError('');
    try {
      await approveUser(id, token);
      await load();
    } catch (err) {
      setError(err.message || 'No se pudo aprobar la cuenta.');
    } finally {
      setBusy(null);
    }
  };

  const rechazar = async (id) => {
    setBusy(id);
    setError('');
    try {
      await rejectUser(id, token);
      await load();
    } catch (err) {
      setError(err.message || 'No se pudo rechazar la cuenta.');
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
            <p className={styles.eyebrow}>PERSONAS / CUENTAS</p>
            <h1>{role === 'CLIENTE' ? 'Clientes' : role === 'TRABAJADOR' ? 'Trabajadores' : 'Gestión de cuentas'}</h1>
            <p>Consulta cada rol y aprueba las cuentas pendientes desde un solo lugar.</p>
          </div>
        </header>
        <nav className={styles.adminNav} aria-label="Filtrar usuarios por rol">
          <Link to="/admin/usuarios">Todos</Link>
          <Link to="/admin/usuarios?rol=CLIENTE">Clientes</Link>
          <Link to="/admin/usuarios?rol=TRABAJADOR">Trabajadores</Link>
        </nav>
        {error && <p className={styles.error}>{error}</p>}
        <div className={styles.tableWrap}>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Nombre</th>
                <th>Correo</th>
                <th>Rol</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={row.id_usuario}>
                  <td>{row.id_usuario}</td>
                  <td>{row.nombre}</td>
                  <td>{row.correo}</td>
                  <td>{rolLabel(row)}</td>
                  <td>{row.estado}</td>
                  <td>
                    <div className={styles.actions}>
                      {row.estado === 'PENDIENTE' || row.estado === 'INACTIVO' ? (
                        <>
                          <button
                            type="button"
                            className={styles.btn}
                            disabled={busy === row.id_usuario}
                            onClick={() => aprobar(row.id_usuario)}
                          >
                            Aprobar
                          </button>
                          <button
                            type="button"
                            className={styles.danger}
                            disabled={busy === row.id_usuario}
                            onClick={() => rechazar(row.id_usuario)}
                          >
                            Rechazar
                          </button>
                        </>
                      ) : row.estado === 'SUSPENDIDO' ? (
                        <button
                          type="button"
                          className={styles.btn}
                          disabled={busy === row.id_usuario}
                          onClick={() => setEstado(row.id_usuario, 'ACTIVO')}
                        >
                          Reactivar
                        </button>
                      ) : isAdminUser(row) ? (
                        'Administrador'
                      ) : (
                        <button
                          type="button"
                          className={styles.danger}
                          disabled={busy === row.id_usuario}
                          onClick={() => setEstado(row.id_usuario, 'SUSPENDIDO')}
                        >
                          Suspender
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!visible.length && <tr><td colSpan={6}>No hay cuentas en esta vista.</td></tr>}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
