import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { createRequest, listWorkerServices } from '../../api/requests';
import ui from '../search/Search.module.css';
import styles from './ServiceRequestModal.module.css';

export default function ServiceRequestModal({ worker, onClose }) {
  const { session } = useAuth();
  const dialog = useRef(null);
  const sending = useRef(false);
  const [services, setServices] = useState(null);
  const [servicesError, setServicesError] = useState('');
  const [retry, setRetry] = useState(0);
  const [form, setForm] = useState({ id_servicio: '', descripcion: '', ubicacion_aprox: '', fecha_deseada: '', urgente: false });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(null);
  const [uncertain, setUncertain] = useState(false);

  useEffect(() => {
    const element = dialog.current;
    const trigger = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    element.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      element.close();
      document.body.style.overflow = previousOverflow;
      trigger?.focus();
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setServices(null);
    setServicesError('');
    listWorkerServices(worker.id_perfil, { signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted) return;
        const active = data.filter((item) => Number(item.id_perfil) === Number(worker.id_perfil) && item.activo === true);
        setServices(active);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setServicesError(err.status ? err.message : 'No se pudieron cargar los servicios. Revisa tu conexión.');
        setServices([]);
      });
    return () => controller.abort();
  }, [worker.id_perfil, retry]);

  const close = () => { if (!sending.current) onClose(); };
  const keepFocusInDialog = (event) => {
    if (event.key !== 'Tab') return;
    const controls = [...dialog.current.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]')];
    const first = controls[0];
    const last = controls.at(-1);
    if (!first) { event.preventDefault(); dialog.current.focus(); return; }
    if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault(); first.focus();
    }
  };
  const change = (event) => {
    const { name, value, checked, type } = event.target;
    setForm((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }));
    setError('');
  };
  const submit = async (event) => {
    event.preventDefault();
    if (sending.current || saved || uncertain) return;
    if (!session?.accessToken) { setError('Inicia sesión para enviar una solicitud.'); return; }
    if (!services?.some((item) => Number(item.id_servicio) === Number(form.id_servicio))) {
      setError('Selecciona un servicio activo de este trabajador.'); return;
    }
    const description = form.descripcion.trim();
    if (description.length < 10 || description.length > 4000) {
      setError('Describe el trabajo con entre 10 y 4000 caracteres, sin contar espacios al inicio o al final.'); return;
    }
    if (form.fecha_deseada && (!Number.isFinite(new Date(form.fecha_deseada).getTime()) || new Date(form.fecha_deseada).getTime() <= Date.now())) {
      setError('Selecciona una fecha y hora futura.'); return;
    }
    sending.current = true;
    setBusy(true);
    setError('');
    try {
      const data = await createRequest({
        id_trabajador: Number(worker.id_perfil),
        id_servicio: Number(form.id_servicio),
        descripcion: description,
        ubicacion_aprox: form.ubicacion_aprox.trim() || undefined,
        fecha_deseada: form.fecha_deseada ? new Date(form.fecha_deseada).toISOString() : undefined,
        urgente: form.urgente,
      }, session.accessToken);
      if (!data.id_solicitud || !data.estado) throw new Error('Respuesta incompleta');
      setSaved(data);
    } catch (err) {
      if (!err.status || err.status >= 500) {
        setUncertain(true);
        setError('No recibimos confirmación del servidor. La solicitud podría haberse registrado. Consulta con el equipo antes de volver a enviarla para evitar duplicados.');
      } else {
        setError(err.status === 401 ? 'Tu sesión expiró. Conserva los datos del formulario e inicia sesión de nuevo antes de enviarlo.' : err.message);
      }
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };

  return (
    <dialog ref={dialog} tabIndex={-1} className={styles.dialog} aria-labelledby="request-title" aria-describedby="request-context" onKeyDown={keepFocusInDialog} onCancel={(event) => { event.preventDefault(); close(); }}>
      <header className={styles.header}>
        <div><p className={styles.eyebrow}>NUEVA SOLICITUD</p><h2 id="request-title">{saved ? 'Solicitud enviada' : 'Cuéntanos qué necesitas'}</h2></div>
        <button type="button" className={styles.close} aria-label="Cerrar solicitud" disabled={busy} onClick={close}>×</button>
      </header>
      <p id="request-context" className={styles.context}>Para <strong>{worker.nombre}</strong> · {worker.oficio_principal}</p>
      {saved ? <section className={styles.success} role="status">
        <div className={styles.successMark} aria-hidden="true">✓</div>
        <h3>Tu solicitud quedó registrada</h3>
        <p>Número de solicitud: <strong>#{saved.id_solicitud}</strong></p>
        <p>Estado: <strong>{saved.estado}</strong></p>
        <p>{saved.servicio?.nombre || services?.find((item) => Number(item.id_servicio) === Number(form.id_servicio))?.nombre}</p>
        <p className={ui.hint}>Este registro aún no confirma una contratación ni una fecha de atención.</p>
        <button type="button" className={ui.primary} onClick={close}>Volver a los resultados</button>
      </section> : <form onSubmit={submit} className={styles.form}>
        <p className={ui.hint}>Los campos con * son obligatorios.</p>
        {worker.disponibilidad === 'Ocupado' && <p className={ui.hint}>Este trabajador figura como ocupado; su disponibilidad debe confirmarse.</p>}
        {servicesError ? <div className={ui.error} role="alert">{servicesError} <button type="button" className={ui.textButton} onClick={() => setRetry((n) => n + 1)}>Reintentar servicios</button></div> : services === null ? <p role="status">Cargando servicios…</p> : !services.length ? <p role="status" className={ui.hint}>Este trabajador no tiene servicios activos para solicitar.</p> : null}
        <fieldset disabled={busy || uncertain} className={styles.fields}>
          <label className={ui.field}>Servicio *
            <select name="id_servicio" required value={form.id_servicio} onChange={change} disabled={!services?.length}>
              <option value="">Selecciona un servicio</option>
              {services?.map((item) => <option key={item.id_servicio} value={item.id_servicio}>{item.nombre}</option>)}
            </select>
          </label>
          <label className={ui.field}>Descripción del trabajo *
            <textarea name="descripcion" required minLength={10} maxLength={4000} rows={4} value={form.descripcion} onChange={change} placeholder="Ej. Hay una fuga de agua debajo del lavaplatos y necesito repararla." aria-describedby="description-help" />
          </label>
          <p id="description-help" className={ui.hint}>Entre 10 y 4000 caracteres. {form.descripcion.length}/4000</p>
          <label className={ui.field}>Ubicación aproximada
            <input name="ubicacion_aprox" maxLength={255} value={form.ubicacion_aprox} onChange={change} placeholder="Ej. Zona 10, cerca del centro comercial" />
          </label>
          <label className={ui.field}>Fecha y hora deseadas
            <input type="datetime-local" name="fecha_deseada" value={form.fecha_deseada} onChange={change} aria-describedby="date-help" />
          </label>
          <p id="date-help" className={ui.hint}>Se usa la hora local de tu dispositivo. La fecha queda sujeta a confirmación.</p>
          <label className={ui.check}><input type="checkbox" name="urgente" checked={form.urgente} onChange={change} />Necesito atención urgente</label>
        </fieldset>
        {error && <p className={ui.error} role="alert">{error}</p>}
        <div className={styles.actions}>
          <button type="button" className={ui.secondary} disabled={busy} onClick={close}>Cancelar</button>
          <button type="submit" className={ui.primary} disabled={busy || uncertain || !services?.length || Boolean(servicesError)}>{busy ? 'Enviando…' : 'Enviar solicitud'}</button>
        </div>
        <p className={ui.hint} role="status">{busy ? 'Estamos registrando tu solicitud. Espera la confirmación.' : 'No se realizará ningún cobro al enviar esta solicitud.'}</p>
      </form>}
    </dialog>
  );
}
