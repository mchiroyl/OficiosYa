import { useEffect, useRef, useState } from 'react';
import AppHeader from '../components/AppHeader';
import BackLink from '../components/BackLink';
import { useAuth } from '../auth/AuthContext';
import { listMessages, sendMessage } from '../api/admin';
import { getRequest } from '../api/requests';
import { matchPath, usePath } from '../router';
import styles from './Chat.module.css';

export default function RequestChat() {
  const path = usePath();
  const params = matchPath('/solicitudes/:id/chat', path) || {};
  const requestId = Number(params.id);
  const { session, user } = useAuth();
  const token = session?.accessToken;
  const [request, setRequest] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [image, setImage] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef(null);

  const load = async () => {
    if (!token || !requestId) return;
    try {
      const [req, msgs] = await Promise.all([
        getRequest(requestId, token),
        listMessages(requestId, token),
      ]);
      setRequest(req);
      setMessages(msgs);
    } catch (err) {
      setError(err.message || 'No se pudo cargar el chat.');
    }
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, 4000);
    return () => clearInterval(timer);
  }, [token, requestId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const submit = async (event) => {
    event.preventDefault();
    const body = text.trim();
    if (!body && !image) return;
    setBusy(true);
    setError('');
    try {
      let contenido = body;
      if (image) {
        const dataUrl = await fileToDataUrl(image);
        contenido = body
          ? `${body}\n[imagen]${dataUrl}`
          : `[imagen]${dataUrl}`;
      }
      await sendMessage(
        {
          id_solicitud: requestId,
          id_emisor: user.id_usuario,
          contenido,
          tipo: image ? 'imagen' : 'texto',
        },
        token,
      );
      setText('');
      setImage(null);
      await load();
    } catch (err) {
      setError(err.message || 'No se pudo enviar el mensaje.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.page}>
      <AppHeader />
      <main className={styles.main}>
        <BackLink to="/mis-solicitudes">Volver a mis solicitudes</BackLink>
        <header className={styles.header}>
          <h1>Chat · Solicitud #{requestId}</h1>
          <p>{request?.descripcion?.slice(0, 120) || 'Mensajería asociada a la solicitud activa'}</p>
        </header>

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        <div className={styles.thread} aria-live="polite">
          {messages.length === 0 ? (
            <p className={styles.empty}>Aún no hay mensajes. Escribe el primero.</p>
          ) : (
            messages.map((msg) => {
              const mine = Number(msg.id_emisor) === Number(user.id_usuario);
              const { text: plain, imageUrl } = parseContent(msg.contenido);
              return (
                <article
                  key={msg.id_mensaje || `${msg.id_emisor}-${msg.fecha_envio}`}
                  className={mine ? styles.mine : styles.theirs}
                >
                  {plain && <p>{plain}</p>}
                  {imageUrl && (
                    <img src={imageUrl} alt="Adjunto del chat" className={styles.image} />
                  )}
                  <time>
                    {msg.fecha_envio
                      ? new Date(msg.fecha_envio).toLocaleString('es-GT')
                      : ''}
                  </time>
                </article>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        <form className={styles.composer} onSubmit={submit}>
          <label className={styles.file}>
            📷
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setImage(e.target.files?.[0] || null)}
            />
          </label>
          <input
            type="text"
            maxLength={4000}
            placeholder="Escribe un mensaje…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={busy}
          />
          <button type="submit" disabled={busy || (!text.trim() && !image)}>
            Enviar
          </button>
        </form>
        {image && <p className={styles.attachHint}>Imagen lista: {image.name}</p>}
      </main>
    </div>
  );
}

function parseContent(contenido = '') {
  const marker = '[imagen]';
  const index = contenido.indexOf(marker);
  if (index === -1) return { text: contenido, imageUrl: null };
  return {
    text: contenido.slice(0, index).trim(),
    imageUrl: contenido.slice(index + marker.length),
  };
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
