import { useEffect, useState } from 'react';
import BackLink from '../components/BackLink';
import { useAuth } from '../auth/AuthContext';
import { listConversations } from '../api/chat';
import { Link } from '../router';
import styles from './Chat.module.css';

function preview(conversation) {
  const last = conversation.ultimo_mensaje;
  if (!last) return 'Aún no hay mensajes. Escribe el primero.';
  if (last.tipo === 'imagen') {
    return last.contenido && last.contenido !== '[imagen]' ? last.contenido : 'Imagen';
  }
  return last.contenido;
}

function when(conversation) {
  const stamp = conversation.ultimo_mensaje?.fecha_envio;
  if (!stamp) return '';
  try {
    return new Date(stamp).toLocaleString('es-GT', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  } catch {
    return '';
  }
}

export default function ChatInbox() {
  const { session } = useAuth();
  const token = session?.accessToken;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    if (!token) {
      setLoading(false);
      setError('Debes iniciar sesión para ver tus mensajes.');
      return undefined;
    }

    setLoading(true);
    listConversations(token)
      .then((data) => {
        if (!cancelled) setItems(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'No se pudieron cargar las conversaciones.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <BackLink to="/">Volver al inicio</BackLink>
        <header className={styles.header}>
          <h1 className={styles.title}>Mensajes</h1>
          <p className={styles.subtitle}>
            Chatea en tiempo real con el cliente o el trabajador de cada solicitud.
          </p>
        </header>

        {loading ? (
          <p className={styles.status}>Cargando conversaciones…</p>
        ) : error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : items.length === 0 ? (
          <p className={styles.empty}>
            Todavía no hay conversaciones. Cuando envíes o recibas una solicitud, el chat
            aparecerá aquí.
          </p>
        ) : (
          <ul className={styles.list}>
            {items.map((item) => (
              <li key={item.id_solicitud}>
                <Link to={`/chat/${item.id_solicitud}`} className={styles.row}>
                  <span className={styles.avatar} aria-hidden="true">
                    {item.contraparte?.nombre?.trim().charAt(0) || 'C'}
                  </span>
                  <span className={styles.rowBody}>
                    <span className={styles.rowTop}>
                      <strong>{item.contraparte?.nombre || 'Usuario'}</strong>
                      <time>{when(item)}</time>
                    </span>
                    <span className={styles.meta}>
                      Solicitud #{item.id_solicitud} · {item.rol === 'cliente' ? 'Tú contratas' : 'Tú atiendes'} ·{' '}
                      {item.estado}
                    </span>
                    <span className={styles.preview}>{preview(item)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
