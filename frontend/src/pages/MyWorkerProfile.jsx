import { useEffect, useMemo, useState } from 'react';
import AppHeader from '../components/AppHeader';
import BackLink from '../components/BackLink';
import CoverageMap from '../components/worker/CoverageMap';
import Rating from '../components/worker/Rating';
import { useAuth } from '../auth/AuthContext';
import { getWorkerContact, getWorkerProfile } from '../api/worker';
import { listPortfolio } from '../api/portfolio';
import { listMyServices } from '../api/offerings';
import { Link } from '../router';
import { formatServiceRate, formatServiceSchedule, parseServiceContent } from '../lib/serviceContent';
import styles from './MyWorkerProfile.module.css';

function maskPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return 'No registrado';
  const end = digits.slice(-3);
  return `(+502) *****-${end}`;
}

export default function MyWorkerProfile() {
  const { session, user } = useAuth();
  const token = session?.accessToken;
  const [profile, setProfile] = useState(null);
  const [contact, setContact] = useState(null);
  const [services, setServices] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const current = await getWorkerProfile(token);
        if (cancelled) return;
        setProfile(current);
        const [contactData, serviceData, photoData] = await Promise.all([
          getWorkerContact(token).catch(() => null),
          current.id_perfil ? listMyServices(current.id_perfil, token).catch(() => []) : [],
          current.id_perfil ? listPortfolio(token).catch(() => []) : [],
        ]);
        if (cancelled) return;
        setContact(contactData);
        setServices(serviceData.filter((item) => item.activo !== false));
        setPhotos(photoData);
      } catch (err) {
        if (!cancelled) setError(err.message || 'No se pudo cargar tu perfil.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (token) load();
    return () => { cancelled = true; };
  }, [token]);

  const coverage = useMemo(() => {
    const areas = (profile?.cobertura || []).map((zone) => zone.nombre).filter(Boolean);
    return {
      centerLabel: areas[0] || 'El Asintal',
      radiusKm: 3,
      description: 'Área aproximada de atención. Tu residencia exacta permanece privada.',
      areas,
      center: { lat: 14.5965, lng: -91.7274 },
    };
  }, [profile]);

  if (loading) return <div className={styles.page}><AppHeader /><main className={styles.loading}>Cargando tu perfil…</main></div>;
  if (error || !profile) return <div className={styles.page}><AppHeader /><main className={styles.main}><BackLink to="/">Volver</BackLink><p className={styles.error}>{error || 'Perfil no disponible.'}</p></main></div>;

  const name = user?.nombre || session?.user?.nombre || 'Mi perfil';
  const available = profile.disponibilidad === 'Disponible';
  const avatar = photos[0]?.imagen_thumb_url || photos[0]?.imagen_url;

  return (
    <div className={styles.page}>
      <AppHeader />
      <div className={styles.heroBand} />
      <main className={styles.main}>
        <div className={styles.mobileBack}><BackLink to="/">Volver al panel</BackLink><strong>Mi Perfil</strong></div>
        <div className={styles.layout}>
          <aside className={styles.sidebar}>
            <section className={`${styles.card} ${styles.identity}`}>
              <div className={styles.avatar}>
                {avatar ? <img src={avatar} alt="Foto de perfil" /> : <span>{name.charAt(0).toUpperCase()}</span>}
              </div>
              <h1>{name}</h1>
              <p className={styles.trade}>{profile.oficio_principal || 'Trabajador'}</p>
              <span className={`${styles.status} ${available ? styles.online : styles.busy}`}>
                <i /> {profile.disponibilidad || 'Disponibilidad por confirmar'}
              </span>
              <Rating value={Number(profile.reputacion || 0)} reviewCount={Number(profile.total_resenas || 0)} />
              <Link to="/worker/profile" className={styles.primaryButton}>Editar perfil</Link>
            </section>

            <section className={styles.card}>
              <h2>Información de contacto</h2>
              {profile.contacto_visible ? (
                <>
                  <p className={styles.contactLine}><span aria-hidden="true">☎</span>{maskPhone(contact?.telefono)}</p>
                  <p className={styles.contactHint}>Tus datos completos solo se muestran cuando lo autorizas.</p>
                </>
              ) : <p className={styles.muted}>Contacto oculto para el público.</p>}
            </section>

            <section className={styles.card}>
              <CoverageMap coverage={coverage} />
              <p className={styles.location}>⌖ {(profile.cobertura || []).map((z) => z.nombre).join(', ') || 'El Asintal'}</p>
              <p className={styles.schedule}><strong>Horarios:</strong> Consulta la disponibilidad indicada en cada servicio.</p>
            </section>
          </aside>

          <div className={styles.content}>
            <section className={styles.card}>
              <h2>Sobre mí</h2>
              <p>{profile.descripcion || 'Agrega una descripción para que los clientes conozcan tu experiencia y forma de trabajo.'}</p>
              {profile.experiencia && <p className={styles.experience}><strong>Experiencia:</strong> {profile.experiencia}</p>}
            </section>

            <section className={styles.card}>
              <div className={styles.sectionHead}><h2>Servicios ofrecidos</h2><Link to="/worker/content">Administrar</Link></div>
              {services.length ? <ul className={styles.services}>{services.map((item) => {
                const details = parseServiceContent(item.descripcion);
                return <li key={item.id_servicio}><span>{item.nombre}</span>{details.descripcion && <small>{details.descripcion}</small>}{details.configurado && <small>{formatServiceRate(details.tarifa)} · {formatServiceSchedule(details.horario)}</small>}</li>;
              })}</ul> : <p className={styles.muted}>Todavía no has agregado servicios.</p>}
            </section>

            <section className={styles.card}>
              <div className={styles.sectionHead}><h2>Portafolio de trabajos</h2><Link to="/worker/content">Ver más ›</Link></div>
              {photos.length ? <div className={styles.gallery}>{photos.slice(0, 6).map((photo) => <figure key={photo.id_elemento}><img src={photo.imagen_thumb_url || photo.imagen_url} alt={photo.titulo || 'Trabajo realizado'} loading="lazy" /><figcaption>{photo.titulo}</figcaption></figure>)}</div> : <div className={styles.emptyPortfolio}><p>Agrega fotografías de tus trabajos realizados.</p><Link to="/worker/content">Agregar fotos</Link></div>}
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
