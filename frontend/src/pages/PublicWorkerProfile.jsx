import { useEffect, useState } from 'react';
import BackLink from '../components/BackLink';
import Button from '../components/ui/Button';
import Rating from '../components/worker/Rating';
import WorkerGallery from '../components/worker/WorkerGallery';
import CoverageMap from '../components/worker/CoverageMap';
import ServiceRequestModal from '../components/requests/ServiceRequestModal';
import ReportModal from '../components/reports/ReportModal';
import { BriefcaseIcon, CheckIcon, MapPinIcon } from '../components/icons/Icons';
import { api } from '../api/client';
import { listWorkerServices } from '../api/requests';
import { listReviews } from '../api/reviews';
import { useAuth } from '../auth/AuthContext';
import styles from './PublicWorkerProfile.module.css';

const money = (amount) =>
  new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' }).format(amount);

const RATE_LABELS = {
  por_hora: 'Por hora',
  por_servicio: 'Por servicio',
  a_convenir: 'A convenir',
};

export default function PublicWorkerProfile({ workerId }) {
  const { isAuthenticated, session } = useAuth();
  const [worker, setWorker] = useState(null);
  const [services, setServices] = useState([]);
  const [gallery, setGallery] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [requestOpen, setRequestOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const profile = await api(`/perfiles-trabajador/${workerId}`, {
          token: session?.accessToken,
        });
        if (cancelled) return;
        setWorker(profile);

        const [svcs, photos, resenas] = await Promise.all([
          listWorkerServices(workerId).catch(() => []),
          api(`/portafolio?id_perfil=${workerId}`).catch(() => []),
          listReviews({ id_trabajador: workerId }).catch(() => []),
        ]);
        if (cancelled) return;
        setServices(Array.isArray(svcs) ? svcs.filter((s) => s.activo !== false) : []);
        const photoList = Array.isArray(photos) ? photos : photos?.data || [];
        setGallery(
          photoList
            .filter((p) => !(p.titulo || '').includes('DPI'))
            .map((p, index) => ({
              id: p.id_elemento || index,
              src: p.url || p.ruta || p.imagen_url,
              alt: p.titulo || `Trabajo ${index + 1}`,
            }))
            .filter((p) => p.src),
        );
        setReviews(Array.isArray(resenas) ? resenas : []);
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'No se pudo cargar el perfil.');
          setWorker(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (workerId) load();
    return () => {
      cancelled = true;
    };
  }, [workerId, session?.accessToken]);

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.notFound}>
          <BackLink to="/">Volver</BackLink>
          <p>Cargando perfil…</p>
        </div>
      </div>
    );
  }

  if (!worker) {
    return (
      <div className={styles.page}>
        <div className={styles.notFound}>
          <BackLink to="/">Volver al menú principal</BackLink>
          <h1 className={styles.notFoundTitle}>Trabajador no encontrado</h1>
          <p className={styles.notFoundText}>{error || 'El perfil no está disponible.'}</p>
        </div>
      </div>
    );
  }

  const name = worker.nombre || worker.oficio_principal || `Perfil #${worker.id_perfil}`;
  const rating = Number(worker.promedio_calificacion || worker.reputacion || 0);
  const reviewCount = reviews.length || Number(worker.total_resenas || 0);
  const tarifas = worker.tarifas || {};
  const coberturaAreas = (worker.cobertura || []).map((z) => z.nombre || z).filter(Boolean);
  const horarios = worker.horarios || [];
  const available = (worker.disponibilidad || '').toLowerCase() === 'disponible';

  const coverage = {
    centerLabel: coberturaAreas[0] || 'El Asintal',
    radiusKm: 3,
    description:
      'Zonas de cobertura sombreadas. La residencia exacta del trabajador no se revela.',
    areas: coberturaAreas,
    center: { lat: 14.6, lng: -91.7 },
  };

  const cardWorker = {
    id_perfil: worker.id_perfil,
    id_usuario: worker.id_usuario,
    nombre: name,
    oficio_principal: worker.oficio_principal,
    disponibilidad: worker.disponibilidad || 'Disponible',
  };

  return (
    <div className={styles.page}>
      <article className={styles.layout}>
        <BackLink to="/">Volver al menú principal</BackLink>
        <header className={styles.heroCard}>
          <div className={styles.heroTop}>
            <div className={styles.avatarWrap}>
              <div className={styles.avatar} style={{ display: 'grid', placeItems: 'center', background: '#e1f1ec', fontSize: 36, fontWeight: 700 }}>
                {String(name).trim().charAt(0) || 'O'}
              </div>
              {available && <span className={styles.availableDot} title="Disponible" />}
            </div>
            <div className={styles.heroInfo}>
              <h1 className={styles.name}>
                {name}
                {worker.verificado ? ' ✓' : ''}
              </h1>
              <p className={styles.profession}>{worker.oficio_principal}</p>
              <div className={styles.metaRow}>
                <Rating value={rating || 0} reviewCount={reviewCount} />
              </div>
              <p className={styles.location}>
                <MapPinIcon />
                <span>{coberturaAreas.join(', ') || 'El Asintal'}</span>
              </p>
              <p className={[styles.availability, available ? styles.availabilityOn : ''].join(' ')}>
                {worker.disponibilidad || 'Disponibilidad por confirmar'}
              </p>
            </div>
          </div>

          <p className={styles.shortBio}>
            {worker.descripcion || 'Profesional independiente en El Asintal.'}
          </p>

          <div className={styles.ctaWrap}>
            {isAuthenticated ? (
              <Button variant="primary" onClick={() => setRequestOpen(true)}>
                Solicitar servicio
              </Button>
            ) : (
              <Button variant="primary" onClick={() => (window.location.href = '/login')}>
                Inicia sesión para solicitar
              </Button>
            )}
            <Button variant="outline" onClick={() => setReportOpen(true)}>
              Reportar
            </Button>
          </div>
        </header>

        <div className={styles.content}>
          <section className={styles.card} aria-labelledby="about-heading">
            <h2 id="about-heading" className={styles.sectionTitle}>Acerca de</h2>
            <p className={styles.bodyText}>{worker.descripcion || 'Sin descripción.'}</p>
            {worker.experiencia && (
              <div className={styles.experience}>
                <BriefcaseIcon />
                <span>{worker.experiencia} de experiencia</span>
              </div>
            )}
          </section>

          <section className={styles.card} aria-labelledby="services-heading">
            <h2 id="services-heading" className={styles.sectionTitle}>Oficios y tarifas</h2>
            <ul className={styles.serviceList}>
              {(services.length ? services : [{ id_servicio: 0, nombre: worker.oficio_principal }]).map(
                (service) => (
                  <li key={service.id_servicio || service.nombre} className={styles.serviceItem}>
                    <span className={styles.serviceIcon} aria-hidden="true"><CheckIcon /></span>
                    <span>{service.nombre}</span>
                  </li>
                ),
              )}
            </ul>
            <p className={styles.bodyText} style={{ marginTop: 12 }}>
              {tarifas.monto_desde != null
                ? `Tarifa base desde ${money(tarifas.monto_desde)} (${RATE_LABELS[tarifas.tipo] || tarifas.tipo || 'referencia'})`
                : 'Tarifa por consultar'}
              {tarifas.notas ? ` · ${tarifas.notas}` : ''}
            </p>
          </section>

          <section className={styles.card}>
            <h2 className={styles.sectionTitle}>Horarios disponibles</h2>
            {horarios.length === 0 ? (
              <p className={styles.bodyText}>Horario por coordinar.</p>
            ) : (
              <ul className={styles.serviceList}>
                {horarios.map((h, i) => (
                  <li key={`${h.dia}-${i}`} className={styles.serviceItem}>
                    <span className={styles.serviceIcon} aria-hidden="true"><CheckIcon /></span>
                    <span>
                      {h.dia}: {h.desde} – {h.hasta}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={styles.card} aria-labelledby="rating-heading">
            <h2 id="rating-heading" className={styles.sectionTitle}>Calificación</h2>
            <div className={styles.ratingBlock}>
              <p className={styles.ratingBig}>{(rating || 0).toFixed(1)}</p>
              <div>
                <Rating value={rating || 0} size="lg" />
                <p className={styles.ratingSub}>Basado en {reviewCount} reseñas</p>
              </div>
            </div>
            <ul className={styles.serviceList} style={{ marginTop: 16 }}>
              {reviews.slice(0, 5).map((r) => (
                <li key={r.id_resena} className={styles.serviceItem}>
                  <span>{'★'.repeat(Number(r.calificacion) || 0)}</span>
                  <span>
                    {r.comentario || 'Sin comentario'}
                    {r.respuesta_trabajador ? ` · Respuesta: ${r.respuesta_trabajador}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {gallery.length > 0 && (
            <div className={styles.card}>
              <WorkerGallery images={gallery} />
            </div>
          )}

          <div className={styles.card}>
            <CoverageMap coverage={coverage} />
          </div>
        </div>
      </article>

      {requestOpen && (
        <ServiceRequestModal worker={cardWorker} onClose={() => setRequestOpen(false)} />
      )}
      {reportOpen && (
        <ReportModal
          context={{
            tipo: 'perfil',
            id_referencia: worker.id_perfil,
            id_reportado: worker.id_usuario,
          }}
          onClose={() => setReportOpen(false)}
        />
      )}
    </div>
  );
}
