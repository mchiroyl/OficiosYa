import { useEffect, useState } from 'react';
import AppHeader from '../components/AppHeader';
import BackLink from '../components/BackLink';
import { useAuth } from '../auth/AuthContext';
import { isAdminUser } from '../lib/admin';
import { createZone, deleteZone, listZonesAdmin, updateZone } from '../api/admin';
import styles from './Admin.module.css';

export default function AdminZones() {
  const { session, user } = useAuth();
  const token = session?.accessToken;
  const [items, setItems] = useState([]);
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState('cuadrante');
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState('');
  const [error, setError] = useState('');

  const load = () =>
    listZonesAdmin(token)
      .then(setItems)
      .catch((err) => setError(err.message || 'No se pudieron cargar zonas.'));

  useEffect(() => {
    if (token && isAdminUser(user)) load();
  }, [token, user]);

  const create = async (event) => {
    event.preventDefault();
    if (!nombre.trim()) return;
    try {
      await createZone({ nombre: nombre.trim(), tipo, estado: 'ACTIVA' }, token);
      setNombre('');
      await load();
    } catch (err) {
      setError(err.message || 'No se pudo crear la zona.');
    }
  };

  const save = async (id) => {
    try {
      await updateZone(id, { nombre: editName.trim() }, token);
      setEditId(null);
      await load();
    } catch (err) {
      setError(err.message || 'No se pudo actualizar.');
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
            <p className={styles.eyebrow}>ADMIN · EL ASINTAL</p>
            <h1>Zonas de cobertura</h1>
            <p>Actualiza los nombres de cuadrantes y zonas del municipio.</p>
          </div>
        </header>
        {error && <p className={styles.error}>{error}</p>}
        <form className={styles.form} onSubmit={create}>
          <div className={styles.row}>
            <input placeholder="Nombre de zona/cuadrante" value={nombre} onChange={(e) => setNombre(e.target.value)} />
            <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
              <option value="cuadrante">Cuadrante</option>
              <option value="colonia">Colonia</option>
              <option value="zona">Zona</option>
            </select>
            <button type="submit" className={styles.btn}>Añadir</button>
          </div>
        </form>
        <div className={styles.tableWrap}>
          <table>
            <thead>
              <tr><th>ID</th><th>Nombre</th><th>Tipo</th><th>Estado</th><th>Acciones</th></tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id_zona}>
                  <td>{row.id_zona}</td>
                  <td>
                    {editId === row.id_zona ? (
                      <input value={editName} onChange={(e) => setEditName(e.target.value)} />
                    ) : row.nombre}
                  </td>
                  <td>{row.tipo || '—'}</td>
                  <td>{row.estado}</td>
                  <td>
                    <div className={styles.actions}>
                      {editId === row.id_zona ? (
                        <button type="button" className={styles.btn} onClick={() => save(row.id_zona)}>Guardar</button>
                      ) : (
                        <button
                          type="button"
                          className={styles.ghost}
                          onClick={() => { setEditId(row.id_zona); setEditName(row.nombre || ''); }}
                        >
                          Editar
                        </button>
                      )}
                      <button
                        type="button"
                        className={styles.danger}
                        onClick={() => deleteZone(row.id_zona, token).then(load).catch((e) => setError(e.message))}
                      >
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
