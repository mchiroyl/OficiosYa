import { useEffect, useState } from 'react';
import AppHeader from '../components/AppHeader';
import BackLink from '../components/BackLink';
import { useAuth } from '../auth/AuthContext';
import { isAdminUser } from '../lib/admin';
import { listWorkerProfiles, updateWorkerVerification } from '../api/admin';
import styles from './Admin.module.css';

export default function AdminDpi() {
  const { session, user } = useAuth();
  const token = session?.accessToken;
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null);

  const load = () =>
    listWorkerProfiles(token)
      .then((rows) => setItems(rows.filter((row) => row.dpi_url || row.documento_dpi || !row.verificado)))
      .catch((err) => setError(err.message || 'No se pudo cargar la bandeja DPI.'));

  useEffect(() => {
    if (token && isAdminUser(user)) load();
  }, [token, user]);

  const decide = async (id, verificado) => {
    setBusy(id);
    setError('');
    try {
      await updateWorkerVerification(id, verificado, token);
      await load();
    } catch (err) {
      setError(err.message || 'No se pudo actualizar la verificación.');
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
            <p className={styles.eyebrow}>AUDITORÍA DE IDENTIDAD</p>
            <h1>Documentos DPI</h1>
            <p>Aprueba el distintivo de Perfil Verificado o rechaza documentos ilegibles.</p>
          </div>
        </header>
        {error && <p className={styles.error}>{error}</p>}
        <div className={styles.tableWrap}>
          <table>
            <thead>
              <tr>
                <th>Perfil</th>
                <th>Oficio</th>
                <th>Documento</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={5}>No hay solicitudes de verificación pendientes.</td></tr>
              ) : items.map((row) => {
                const doc = row.dpi_url || row.documento_dpi;
                return (
                  <tr key={row.id_perfil}>
                    <td>#{row.id_perfil} · usuario {row.id_usuario}</td>
                    <td>{row.oficio_principal || '—'}</td>
                    <td>
                      {doc ? (
                        <a href={doc} target="_blank" rel="noreferrer">
                          <img src={doc} alt="DPI" className={styles.preview} />
                        </a>
                      ) : (
                        'Sin imagen (pendiente de carga)'
                      )}
                    </td>
                    <td>{row.verificado ? 'Verificado ✓' : 'Pendiente'}</td>
                    <td>
                      <div className={styles.actions}>
                        <button
                          type="button"
                          className={styles.btn}
                          disabled={busy === row.id_perfil || row.verificado}
                          onClick={() => decide(row.id_perfil, true)}
                        >
                          Aprobar
                        </button>
                        <button
                          type="button"
                          className={styles.danger}
                          disabled={busy === row.id_perfil}
                          onClick={() => decide(row.id_perfil, false)}
                        >
                          Rechazar
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
