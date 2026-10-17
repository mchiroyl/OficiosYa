import { useCallback, useEffect, useState } from 'react';
import AppHeader from '../components/AppHeader';
import Button from '../components/ui/Button';
import Checkbox from '../components/ui/Checkbox';
import { useAuth } from '../auth/AuthContext';
import { getWorkerProfile, listZonas, updateWorkerAvailability, updateWorkerProfile } from '../api/worker';
import { deletePortfolioPhoto, listPortfolio, uploadPortfolioPhoto } from '../api/portfolio';
import { createService, deleteService, listCategories, listMyServices, updateService } from '../api/offerings';
import { listReviews, replyToReview } from '../api/reviews';
import { formatServiceRate, formatServiceSchedule, parseServiceContent, serializeServiceContent } from '../lib/serviceContent';
import styles from './WorkerContent.module.css';

const DAYS = [
  { value: 'lunes', label: 'Lunes' },
  { value: 'martes', label: 'Martes' },
  { value: 'miercoles', label: 'Miércoles' },
  { value: 'jueves', label: 'Jueves' },
  { value: 'viernes', label: 'Viernes' },
  { value: 'sabado', label: 'Sábado' },
  { value: 'domingo', label: 'Domingo' },
];

const EMPTY_SERVICE = {
  nombre: '',
  descripcion: '',
  id_categoria: '',
  tarifaTipo: 'por_servicio',
  montoDesde: '',
  montoHasta: '',
  dias: [],
  desde: '08:00',
  hasta: '17:00',
};

function asList(value) {
  return Array.isArray(value) ? value : value?.data || [];
}

function serviceFormValues(item) {
  const details = parseServiceContent(item.descripcion);
  return {
    ...EMPTY_SERVICE,
    nombre: item.nombre || '',
    id_categoria: String(item.id_categoria || ''),
    descripcion: details.descripcion,
    tarifaTipo: details.tarifa.tipo || 'a_convenir',
    montoDesde: details.tarifa.monto_desde ?? '',
    montoHasta: details.tarifa.monto_hasta ?? '',
    dias: details.horario?.dias || [],
    desde: details.horario?.desde || '08:00',
    hasta: details.horario?.hasta || '17:00',
  };
}

export default function WorkerContent() {
  const { session } = useAuth();
  const token = session?.accessToken;
  const [profile, setProfile] = useState(null);
  const [services, setServices] = useState([]);
  const [categories, setCategories] = useState([]);
  const [zones, setZones] = useState([]);
  const [coverage, setCoverage] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [service, setService] = useState(EMPTY_SERVICE);
  const [editingServiceId, setEditingServiceId] = useState(null);
  const [availability, setAvailability] = useState('Disponible');
  const [file, setFile] = useState(null);
  const [photoTitle, setPhotoTitle] = useState('');
  const [photoDescription, setPhotoDescription] = useState('');
  const [reply, setReply] = useState({});
  const [busy, setBusy] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setError('');
    try {
      const [current, categoryRows, zoneRows, photoRows] = await Promise.all([
        getWorkerProfile(token),
        listCategories(),
        listZonas(),
        listPortfolio(token),
      ]);
      const [serviceRows, reviewRows] = current.id_perfil
        ? await Promise.all([
          listMyServices(current.id_perfil, token),
          listReviews({ id_trabajador: current.id_perfil, order: 'fecha:desc' }, token),
        ])
        : [[], []];
      setProfile(current);
      setCategories(asList(categoryRows));
      setZones(asList(zoneRows).filter((zone) => (zone.estado || '').toUpperCase() === 'ACTIVA'));
      setCoverage((current.cobertura || []).map((zone) => Number(zone.id_zona)));
      setAvailability(current.disponibilidad === 'Ocupado' ? 'Ocupado' : 'Disponible');
      setPhotos(asList(photoRows));
      setReviews(asList(reviewRows));
      setServices(serviceRows);
    } catch (err) {
      setError(err.message || 'No se pudo cargar tu oferta y contenido.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const run = async (key, action, message) => {
    setBusy(key); setError(''); setSuccess('');
    try {
      await action();
      setSuccess(message);
      await load();
    } catch (err) {
      setError(err.message || 'No se pudo completar la operación.');
    } finally {
      setBusy('');
    }
  };

  const saveService = (event) => {
    event.preventDefault();
    const desde = service.montoDesde === '' ? null : Number(service.montoDesde);
    const hasta = service.montoHasta === '' ? null : Number(service.montoHasta);
    if (!service.nombre.trim() || !service.id_categoria) {
      setError('Escribe el nombre del servicio y selecciona una categoría.');
      return;
    }
    if (service.tarifaTipo !== 'a_convenir' && desde == null) {
      setError('Indica la tarifa de este servicio o selecciona “A convenir”.');
      return;
    }
    if ((desde != null && desde < 0) || (hasta != null && hasta < 0) || (desde != null && hasta != null && hasta < desde)) {
      setError('Revisa la tarifa: los montos deben ser positivos y el máximo no puede ser menor que el mínimo.');
      return;
    }
    if (service.dias.length && service.hasta <= service.desde) {
      setError('La hora de fin debe ser posterior a la hora de inicio.');
      return;
    }

    run(editingServiceId ? `service-${editingServiceId}` : 'service-new', async () => {
      let profileId = profile?.id_perfil;
      if (!profileId) {
        const createdProfile = await updateWorkerProfile({}, token);
        profileId = createdProfile.id_perfil;
        setProfile(createdProfile);
      }
      const body = {
        id_perfil: profileId,
        id_categoria: Number(service.id_categoria),
        nombre: service.nombre.trim(),
        descripcion: serializeServiceContent({
          descripcion: service.descripcion,
          tarifa: { tipo: service.tarifaTipo, monto_desde: desde, monto_hasta: hasta, moneda: 'GTQ' },
          horario: { dias: service.dias, desde: service.desde, hasta: service.hasta },
        }),
        activo: editingServiceId
          ? services.find((item) => item.id_servicio === editingServiceId)?.activo !== false
          : true,
      };
      if (editingServiceId) await updateService(editingServiceId, body, token);
      else await createService(body, token);
      setService(EMPTY_SERVICE);
      setEditingServiceId(null);
    }, editingServiceId ? 'Servicio actualizado.' : 'Servicio agregado a tu oferta.');
  };

  const editService = (item) => {
    setEditingServiceId(item.id_servicio);
    setService(serviceFormValues(item));
    setError('');
    setSuccess('');
    document.getElementById('service-form-title')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const saveCoverage = () => run('coverage', async () => {
    await updateWorkerProfile({ cobertura: coverage }, token);
  }, 'Zonas de cobertura guardadas.');

  const toggleAvailability = () => run('availability', async () => {
    const next = availability === 'Disponible' ? 'Ocupado' : 'Disponible';
    const updated = await updateWorkerAvailability({ disponibilidad: next }, token);
    setAvailability(updated.disponibilidad === 'Ocupado' ? 'Ocupado' : 'Disponible');
  }, availability === 'Disponible' ? 'Ahora figuras como ocupado.' : 'Ahora figuras como disponible.');

  const upload = (event) => {
    event.preventDefault();
    if (!file) { setError('Selecciona una imagen.'); return; }
    run('photo-new', async () => {
      await uploadPortfolioPhoto({ file, titulo: photoTitle.trim(), descripcion: photoDescription.trim(), token });
      setFile(null); setPhotoTitle(''); setPhotoDescription('');
      event.target.reset();
    }, 'Foto agregada al portafolio.');
  };

  return (
    <div className={styles.page}>
      <AppHeader />
      <main className={styles.main}>
        <header className={styles.pageHeader}>
          <p className={styles.eyebrow}>MODO TRABAJADOR</p>
          <h1>Mi oferta y contenido</h1>
          <p>Administra tus servicios, define una tarifa y un horario para cada uno, y actualiza tu portafolio.</p>
        </header>
        {error && <p className={styles.error} role="alert">{error}</p>}
        {success && <p className={styles.success} role="status">{success}</p>}
        {loading ? <p className={styles.loading}>Cargando tu oferta…</p> : <>
          <section className={styles.card} aria-labelledby="offered-services-title">
            <div className={styles.sectionHead}>
              <div><h2 id="offered-services-title">Servicios que ofrezco</h2><p>Agrega cada servicio con su precio y horario de atención.</p></div>
              <span className={availability === 'Disponible' ? styles.available : styles.occupied}>{availability}</span>
            </div>

            <form className={styles.form} onSubmit={saveService}>
              <h3 id="service-form-title" className={styles.formTitle}>{editingServiceId ? 'Editar servicio' : 'Agregar un servicio'}</h3>
              <div className={styles.fields}>
                <label>Nombre del servicio
                  <input required minLength={2} maxLength={150} placeholder="Ej. Instalación eléctrica" value={service.nombre} onChange={(e) => setService((prev) => ({ ...prev, nombre: e.target.value }))} />
                </label>
                <label>Categoría
                  <select required value={service.id_categoria} onChange={(e) => setService((prev) => ({ ...prev, id_categoria: e.target.value }))}>
                    <option value="">Selecciona una categoría</option>
                    {categories.map((item) => <option key={item.id_categoria} value={item.id_categoria}>{item.nombre}</option>)}
                  </select>
                </label>
                <label className={styles.fullWidth}>Descripción del servicio
                  <textarea maxLength={2000} placeholder="Describe qué incluye el servicio" value={service.descripcion} onChange={(e) => setService((prev) => ({ ...prev, descripcion: e.target.value }))} />
                </label>
              </div>

              <fieldset className={styles.fieldset}>
                <legend>Tarifa de este servicio</legend>
                <div className={styles.fields}>
                  <label>Cómo cobro
                    <select value={service.tarifaTipo} onChange={(e) => setService((prev) => ({ ...prev, tarifaTipo: e.target.value }))}>
                      <option value="por_servicio">Por servicio</option>
                      <option value="por_hora">Por hora</option>
                      <option value="a_convenir">A convenir</option>
                    </select>
                  </label>
                  {service.tarifaTipo !== 'a_convenir' && <>
                    <label>Precio desde (Q)
                      <input type="number" min="0" step="0.01" placeholder="150" value={service.montoDesde} onChange={(e) => setService((prev) => ({ ...prev, montoDesde: e.target.value }))} />
                    </label>
                    <label>Precio hasta (opcional, Q)
                      <input type="number" min="0" step="0.01" placeholder="500" value={service.montoHasta} onChange={(e) => setService((prev) => ({ ...prev, montoHasta: e.target.value }))} />
                    </label>
                  </>}
                </div>
              </fieldset>

              <fieldset className={styles.fieldset}>
                <legend>Horario para este servicio</legend>
                <p className={styles.hint}>Selecciona los días y el horario. Si varía, puedes agregar otro servicio con un horario diferente.</p>
                <div className={styles.days}>
                  {DAYS.map((day) => <Checkbox key={day.value} id={`service-day-${day.value}`} label={day.label} checked={service.dias.includes(day.value)} onChange={() => setService((prev) => ({ ...prev, dias: prev.dias.includes(day.value) ? prev.dias.filter((item) => item !== day.value) : [...prev.dias, day.value] }))} />)}
                </div>
                <div className={styles.fields}>
                  <label>Desde
                    <input type="time" value={service.desde} onChange={(e) => setService((prev) => ({ ...prev, desde: e.target.value }))} />
                  </label>
                  <label>Hasta
                    <input type="time" value={service.hasta} onChange={(e) => setService((prev) => ({ ...prev, hasta: e.target.value }))} />
                  </label>
                </div>
              </fieldset>
              <div className={styles.formActions}>
                {editingServiceId && <Button type="button" variant="outline" onClick={() => { setEditingServiceId(null); setService(EMPTY_SERVICE); }}>Cancelar edición</Button>}
                <Button type="submit" loading={busy === 'service-new' || busy === `service-${editingServiceId}`} disabled={Boolean(busy)}>{editingServiceId ? 'Guardar servicio' : 'Agregar servicio'}</Button>
              </div>
            </form>

            {services.length ? <ul className={styles.list}>{services.map((item) => {
              const details = parseServiceContent(item.descripcion);
              return <li key={item.id_servicio} className={styles.serviceItem}>
                <div className={styles.serviceDetails}>
                  <div className={styles.serviceTitle}><strong>{item.nombre}</strong><span className={item.activo ? styles.activeBadge : styles.pausedBadge}>{item.activo ? 'Activo' : 'Pausado'}</span></div>
                  <p>{details.descripcion || 'Sin descripción'}</p>
                  <p className={styles.serviceMeta}>{details.configurado ? <><strong>{formatServiceRate(details.tarifa)}</strong><span>{formatServiceSchedule(details.horario)}</span></> : <span>Falta configurar su tarifa y horario.</span>}</p>
                </div>
                <div className={styles.actions}>
                  <button type="button" disabled={Boolean(busy)} onClick={() => editService(item)}>Editar</button>
                  <button type="button" disabled={Boolean(busy)} onClick={() => run(`service-${item.id_servicio}`, () => updateService(item.id_servicio, { activo: !item.activo }, token), item.activo ? 'Servicio pausado.' : 'Servicio reactivado.')}>{item.activo ? 'Pausar' : 'Reactivar'}</button>
                  <button type="button" className={styles.danger} disabled={Boolean(busy)} onClick={() => run(`service-${item.id_servicio}`, () => deleteService(item.id_servicio, token), 'Servicio eliminado.')}>Eliminar</button>
                </div>
              </li>;
            })}</ul> : <p className={styles.empty}>Todavía no agregas servicios. Completa el formulario para publicar el primero.</p>}
          </section>

          <section className={styles.card}>
            <div className={styles.sectionHead}><div><h2>Zonas y disponibilidad</h2><p>Indica dónde atiendes y si puedes recibir solicitudes.</p></div>
              <Button type="button" variant="outline" loading={busy === 'availability'} disabled={Boolean(busy)} onClick={toggleAvailability}>{availability === 'Disponible' ? 'Marcar ocupado' : 'Marcar disponible'}</Button>
            </div>
            {zones.length ? <div className={styles.zoneList}>{zones.map((zone) => <Checkbox key={zone.id_zona} id={`coverage-${zone.id_zona}`} label={`${zone.nombre}${zone.tipo ? ` · ${zone.tipo}` : ''}`} checked={coverage.includes(Number(zone.id_zona))} onChange={() => setCoverage((prev) => prev.includes(Number(zone.id_zona)) ? prev.filter((id) => id !== Number(zone.id_zona)) : [...prev, Number(zone.id_zona)])} disabled={Boolean(busy)} />)}</div> : <p className={styles.empty}>No hay zonas activas disponibles.</p>}
            <Button type="button" loading={busy === 'coverage'} disabled={Boolean(busy)} onClick={saveCoverage}>Guardar zonas</Button>
          </section>

          <section className={styles.card}>
            <h2>Portafolio</h2>
            <p className={styles.sectionDescription}>Muestra fotos de trabajos que ya realizaste.</p>
            <form className={styles.form} onSubmit={upload}>
              <div className={styles.fields}>
                <label>Fotografía<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(e) => setFile(e.target.files?.[0] || null)} /></label>
                <label>Título del trabajo<input value={photoTitle} onChange={(e) => setPhotoTitle(e.target.value)} /></label>
                <label className={styles.fullWidth}>Descripción<textarea value={photoDescription} onChange={(e) => setPhotoDescription(e.target.value)} /></label>
              </div>
              <Button type="submit" loading={busy === 'photo-new'} disabled={Boolean(busy)}>Subir fotografía</Button>
            </form>
            <div className={styles.gallery}>{photos.map((item) => <article key={item.id_elemento}>
              <img src={item.imagen_thumb_url || item.imagen_url} alt={item.titulo || 'Trabajo realizado'} loading="lazy" />
              <strong>{item.titulo}</strong><p>{item.descripcion}</p>
              <button type="button" className={styles.danger} onClick={() => run(`photo-${item.id_elemento}`, () => deletePortfolioPhoto(item.id_elemento, token), 'Foto eliminada.')}>Eliminar</button>
            </article>)}</div>
          </section>

          <section className={styles.card}>
            <h2>Reseñas recibidas</h2>
            {reviews.length ? <ul className={styles.list}>{reviews.map((item) => {
              const answered = item.respuesta_trabajador || item.respuesta;
              return <li key={item.id_resena} className={styles.reviewItem}><div><strong className={styles.stars}>{'★'.repeat(Number(item.calificacion) || 0)}</strong><p>{item.comentario || 'Sin comentario'}</p>{answered && <p><b>Tu respuesta:</b> {answered}</p>}</div>
                {!answered && <form className={styles.reply} onSubmit={(e) => { e.preventDefault(); run(`review-${item.id_resena}`, () => replyToReview(item.id_resena, reply[item.id_resena] || '', token), 'Respuesta publicada.'); }}>
                  <input minLength="2" maxLength="1000" required placeholder="Responder públicamente" value={reply[item.id_resena] || ''} onChange={(e) => setReply((prev) => ({ ...prev, [item.id_resena]: e.target.value }))} />
                  <button disabled={Boolean(busy)}>Responder</button>
                </form>}
              </li>;
            })}</ul> : <p className={styles.empty}>Cuando recibas reseñas, aparecerán aquí.</p>}
          </section>
        </>}
      </main>
    </div>
  );
}
