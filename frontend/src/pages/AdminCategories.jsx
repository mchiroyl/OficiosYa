import { useEffect, useState } from 'react';
import AppHeader from '../components/AppHeader';
import BackLink from '../components/BackLink';
import { useAuth } from '../auth/AuthContext';
import { isAdminUser } from '../lib/admin';
import {
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory,
} from '../api/admin';
import styles from './Admin.module.css';

export default function AdminCategories() {
  const { session, user } = useAuth();
  const token = session?.accessToken;
  const [items, setItems] = useState([]);
  const [nombre, setNombre] = useState('');
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState('');
  const [error, setError] = useState('');

  const load = () =>
    listCategories(token)
      .then(setItems)
      .catch((err) => setError(err.message || 'No se pudieron cargar categorías.'));

  useEffect(() => {
    if (token && isAdminUser(user)) load();
  }, [token, user]);

  const create = async (event) => {
    event.preventDefault();
    if (!nombre.trim()) return;
    setError('');
    try {
      await createCategory({ nombre: nombre.trim(), estado: 'ACTIVA' }, token);
      setNombre('');
      await load();
    } catch (err) {
      setError(err.message || 'No se pudo crear la categoría.');
    }
  };

  const save = async (id) => {
    try {
      await updateCategory(id, { nombre: editName.trim() }, token);
      setEditId(null);
      await load();
    } catch (err) {
      setError(err.message || 'No se pudo actualizar.');
    }
  };

  const remove = async (id) => {
    try {
      await deleteCategory(id, token);
      await load();
    } catch (err) {
      setError(err.message || 'No se pudo eliminar.');
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
            <h1>Categorías de oficios</h1>
          </div>
        </header>
        {error && <p className={styles.error}>{error}</p>}
        <form className={styles.form} onSubmit={create}>
          <div className={styles.row}>
            <input
              placeholder="Nueva categoría (ej. Plomería)"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
            <button type="submit" className={styles.btn}>Añadir</button>
          </div>
        </form>
        <div className={styles.tableWrap}>
          <table>
            <thead>
              <tr><th>ID</th><th>Nombre</th><th>Acciones</th></tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id_categoria}>
                  <td>{row.id_categoria}</td>
                  <td>
                    {editId === row.id_categoria ? (
                      <input value={editName} onChange={(e) => setEditName(e.target.value)} />
                    ) : (
                      row.nombre
                    )}
                  </td>
                  <td>
                    <div className={styles.actions}>
                      {editId === row.id_categoria ? (
                        <button type="button" className={styles.btn} onClick={() => save(row.id_categoria)}>
                          Guardar
                        </button>
                      ) : (
                        <button
                          type="button"
                          className={styles.ghost}
                          onClick={() => {
                            setEditId(row.id_categoria);
                            setEditName(row.nombre || '');
                          }}
                        >
                          Editar
                        </button>
                      )}
                      <button type="button" className={styles.danger} onClick={() => remove(row.id_categoria)}>
                        Eliminar
                      </button>
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
