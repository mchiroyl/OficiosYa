import { useEffect, useMemo, useRef, useState } from 'react';
import BackLink from '../components/BackLink';
import Button from '../components/ui/Button';
import { useAuth } from '../auth/AuthContext';
import {
  connectChatSocket,
  listChatMessages,
  listConversations,
  pollChatMessages,
  sendChatImage,
  sendChatText,
} from '../api/chat';
import { useParams } from '../router';
import styles from './Chat.module.css';

function formatTime(value) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleString('es-GT', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return '';
  }
}

function mergeMessages(current, incoming) {
  const next = [...current];
  const seen = new Set(next.map((item) => item.id_mensaje));
  for (const item of incoming) {
    if (!item?.id_mensaje || seen.has(item.id_mensaje)) continue;
    seen.add(item.id_mensaje);
    next.push(item);
  }
  next.sort((a, b) => a.id_mensaje - b.id_mensaje);
  return next;
}

export default function ChatThread() {
  const { id } = useParams('/chat/:id');
  const idSolicitud = Number(id);
  const { session, user } = useAuth();
  const token = session?.accessToken;
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [texto, setTexto] = useState('');
  const [file, setFile] = useState(null);
  const [transport, setTransport] = useState('conectando');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const scroller = useRef(null);
  const afterRef = useRef(0);
  const liveRef = useRef(false);

  const subtitle = useMemo(() => {
    if (!conversation) return `Solicitud #${idSolicitud}`;
    return `${conversation.contraparte?.nombre || 'Usuario'} · Solicitud #${idSolicitud} · ${conversation.estado}`;
  }, [conversation, idSolicitud]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

  useEffect(() => {
    if (!token || !Number.isFinite(idSolicitud)) return undefined;

    let cancelled = false;
    let socket;
    let pollAbort;

    const append = (incoming) => {
      const batch = Array.isArray(incoming) ? incoming : [incoming];
      setMessages((current) => {
        const merged = mergeMessages(current, batch);
        afterRef.current = merged.at(-1)?.id_mensaje || afterRef.current;
        return merged;
      });
    };

    const startPoll = () => {
      if (cancelled || liveRef.current || pollAbort) return;
      setTransport('polling');
      pollAbort = new AbortController();

      const loop = async () => {
        while (!cancelled && !liveRef.current) {
          try {
            const data = await pollChatMessages(idSolicitud, token, {
              after: afterRef.current,
              timeout: 25,
              signal: pollAbort.signal,
            });
            if (data.messages?.length) append(data.messages);
          } catch (err) {
            if (cancelled || err.name === 'AbortError') return;
            await new Promise((resolve) => setTimeout(resolve, 2000));
          }
        }
      };

      loop();
    };

    const boot = async () => {
      setLoading(true);
      setError('');
      try {
        const [history, conversations] = await Promise.all([
          listChatMessages(idSolicitud, token, { limit: 100 }),
          listConversations(token).catch(() => []),
        ]);
        if (cancelled) return;
        const thread = Array.isArray(history) ? history : [];
        setMessages(thread);
        afterRef.current = thread.at(-1)?.id_mensaje || 0;
        setConversation(
          (Array.isArray(conversations) ? conversations : []).find(
            (item) => Number(item.id_solicitud) === idSolicitud,
          ) || null,
        );
      } catch (err) {
        if (!cancelled) setError(err.message || 'No se pudo abrir el chat.');
      } finally {
        if (!cancelled) setLoading(false);
      }

      socket = connectChatSocket(token);

      socket.on('ready', () => {
        socket.emit('join', { id_solicitud: idSolicitud }, (ack) => {
          if (cancelled || ack?.ok === false) {
            startPoll();
            return;
          }
          liveRef.current = true;
          setTransport('websocket');
          pollAbort?.abort();
          pollAbort = null;
        });
      });

      socket.on('message', (message) => {
        if (Number(message?.id_solicitud) === idSolicitud) append(message);
      });

      socket.on('connect_error', () => {
        liveRef.current = false;
        startPoll();
      });

      socket.on('disconnect', () => {
        liveRef.current = false;
        if (!cancelled) startPoll();
      });

      window.setTimeout(() => {
        if (!liveRef.current && !cancelled) startPoll();
      }, 2500);
    };

    boot();

    return () => {
      cancelled = true;
      liveRef.current = false;
      pollAbort?.abort();
      socket?.disconnect();
    };
  }, [idSolicitud, token]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!token || sending) return;
    const caption = texto.trim();
    if (!caption && !file) return;

    setSending(true);
    setError('');
    try {
      const saved = file
        ? await sendChatImage(idSolicitud, file, token, caption)
        : await sendChatText(idSolicitud, caption, token);
      setMessages((current) => mergeMessages(current, [saved]));
      afterRef.current = Math.max(afterRef.current, saved.id_mensaje || 0);
      setTexto('');
      setFile(null);
    } catch (err) {
      setError(err.message || 'No se pudo enviar el mensaje.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={`${styles.inner} ${styles.threadInner}`}>
        <BackLink to="/chat">Volver a mensajes</BackLink>
        <header className={styles.header}>
          <h1 className={styles.title}>Chat</h1>
          <p className={styles.subtitle}>{subtitle}</p>
          <p className={styles.transport} role="status">
            {transport === 'websocket'
              ? 'En vivo · WebSocket'
              : transport === 'polling'
                ? 'En vivo · long-polling'
                : 'Conectando…'}
          </p>
        </header>

        <div className={styles.threadCard}>
          {loading ? (
            <p className={styles.status}>Cargando mensajes…</p>
          ) : (
            <div ref={scroller} className={styles.scroller}>
              {messages.length === 0 ? (
                <p className={styles.empty}>No hay mensajes. Saluda para iniciar la conversación.</p>
              ) : (
                messages.map((message) => {
                  const mine = message.mio || message.id_emisor === user?.id_usuario;
                  return (
                    <article
                      key={message.id_mensaje}
                      className={`${styles.bubble} ${mine ? styles.mine : styles.theirs}`}
                    >
                      <p className={styles.bubbleMeta}>
                        {mine ? 'Tú' : message.emisor_nombre} · {formatTime(message.fecha_envio)}
                      </p>
                      {message.adjunto_url ? (
                        <a href={message.adjunto_url} target="_blank" rel="noreferrer">
                          <img
                            src={message.adjunto_thumb_url || message.adjunto_url}
                            alt={message.contenido && message.contenido !== '[imagen]' ? message.contenido : 'Imagen del chat'}
                            className={styles.image}
                          />
                        </a>
                      ) : null}
                      {message.contenido && message.contenido !== '[imagen]' ? (
                        <p className={styles.bubbleText}>{message.contenido}</p>
                      ) : null}
                    </article>
                  );
                })
              )}
            </div>
          )}

          {error ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : null}

          <form className={styles.composer} onSubmit={handleSubmit}>
            <label className={styles.fileBtn}>
              Imagen
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                disabled={sending}
                onChange={(event) => setFile(event.target.files?.[0] || null)}
              />
            </label>
            <input
              className={styles.textInput}
              type="text"
              maxLength={4000}
              placeholder={file ? 'Pie de foto (opcional)' : 'Escribe un mensaje'}
              value={texto}
              disabled={sending}
              onChange={(event) => setTexto(event.target.value)}
            />
            <Button
              type="submit"
              className={styles.sendBtn}
              loading={sending}
              disabled={sending || (!texto.trim() && !file)}
            >
              Enviar
            </Button>
          </form>
          {file ? <p className={styles.fileName}>Imagen lista: {file.name}</p> : null}
        </div>
      </div>
    </div>
  );
}
