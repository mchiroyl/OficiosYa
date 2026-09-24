import { useState } from 'react';
import BackLink from '../components/BackLink';
import Button from '../components/ui/Button';
import Rating from '../components/worker/Rating';
import WorkerGallery from '../components/worker/WorkerGallery';
import CoverageMap from '../components/worker/CoverageMap';
import {
  BriefcaseIcon,
  CheckIcon,
  MapPinIcon,
} from '../components/icons/Icons';
import { DEFAULT_WORKER_ID, getWorkerById } from '../data/workers';
import { Link } from '../router';
import styles from './PublicWorkerProfile.module.css';

/**
 * Perfil público del trabajador visto por el cliente (HU-08).
 * Integra galería (HU-06) y zona de cobertura (HU-12).
 * No confundir con WorkerProfile (edición de tarifas/cobertura del trabajador).
 */
export default function PublicWorkerProfile({ workerId }) {
  const worker = getWorkerById(workerId || DEFAULT_WORKER_ID);
  const [requestSent, setRequestSent] = useState(false);

  if (!worker) {
    return (
      <div className={styles.page}>
        <div className={styles.notFound}>
          <BackLink to="/">Volver al menú principal</BackLink>
          <h1 className={styles.notFoundTitle}>Trabajador no encontrado</h1>
          <p className={styles.notFoundText}>
            El perfil que buscas no está disponible o el enlace no es válido.
          </p>
          <Link to={`/workers/${DEFAULT_WORKER_ID}`} className={styles.notFoundLink}>
            Ver perfil de ejemplo
          </Link>
        </div>
      </div>
    );
  }

  const handleRequest = () => {
    setRequestSent(true);
  };

  return (
    <div className={styles.page}>
      <article className={styles.layout}>
        <BackLink to="/">Volver al menú principal</BackLink>
        {/* —— Información principal —— */}
        <header className={styles.heroCard}>
          <div className={styles.heroTop}>
            <div className={styles.avatarWrap}>
              <img
                src={worker.avatar}
                alt={`Foto de perfil de ${worker.name}`}
                className={styles.avatar}
                width={112}
                height={112}
              />
              {worker.available && (
                <span className={styles.availableDot} title="Disponible" />
              )}
            </div>

            <div className={styles.heroInfo}>
              <h1 className={styles.name}>{worker.name}</h1>
              <p className={styles.profession}>{worker.profession}</p>

              <div className={styles.metaRow}>
                <Rating value={worker.rating} reviewCount={worker.reviewCount} />
              </div>

              <p className={styles.location}>
                <MapPinIcon />
                <span>{worker.location}</span>
              </p>

              {worker.availability && (
                <p
                  className={[
                    styles.availability,
                    worker.available ? styles.availabilityOn : '',
                  ].join(' ')}
                >
                  {worker.availability}
                </p>
              )}
            </div>
          </div>

          <p className={styles.shortBio}>{worker.shortBio}</p>

          <div className={styles.ctaWrap}>
            <Button
              variant="primary"
              onClick={handleRequest}
              disabled={requestSent}
              aria-live="polite"
            >
              {requestSent ? 'Solicitud enviada' : 'Solicitar servicio'}
            </Button>
            {requestSent && (
              <p className={styles.ctaHint}>
                Tu solicitud quedó registrada en el prototipo. El flujo de
                contratación se conectará más adelante.
              </p>
            )}
          </div>
        </header>

        <div className={styles.content}>
          {/* —— Acerca de / Servicios / Experiencia —— */}
          <section className={styles.card} aria-labelledby="about-heading">
            <h2 id="about-heading" className={styles.sectionTitle}>
              Acerca de
            </h2>
            <p className={styles.bodyText}>{worker.about}</p>

            {worker.experienceYears != null && (
              <div className={styles.experience}>
                <BriefcaseIcon />
                <span>
                  {worker.experienceYears}{' '}
                  {worker.experienceYears === 1 ? 'año' : 'años'} de experiencia
                </span>
              </div>
            )}
          </section>

          <section className={styles.card} aria-labelledby="services-heading">
            <h2 id="services-heading" className={styles.sectionTitle}>
              Servicios
            </h2>
            <ul className={styles.serviceList}>
              {worker.services.map((service) => (
                <li key={service} className={styles.serviceItem}>
                  <span className={styles.serviceIcon} aria-hidden="true">
                    <CheckIcon />
                  </span>
                  <span>{service}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className={styles.card} aria-labelledby="rating-heading">
            <h2 id="rating-heading" className={styles.sectionTitle}>
              Calificación
            </h2>
            <div className={styles.ratingBlock}>
              <p className={styles.ratingBig}>{Number(worker.rating).toFixed(1)}</p>
              <div>
                <Rating value={worker.rating} size="lg" />
                <p className={styles.ratingSub}>
                  Basado en {worker.reviewCount} reseñas de clientes
                </p>
              </div>
            </div>
          </section>

          {/* —— HU-06 —— */}
          <div className={styles.card}>
            <WorkerGallery images={worker.gallery} />
          </div>

          {/* —— HU-12 —— */}
          <div className={styles.card}>
            <CoverageMap coverage={worker.coverage} />
          </div>

          {/* CTA inferior */}
          <section className={[styles.card, styles.bottomCta].join(' ')} aria-labelledby="hire-heading">
            <div className={styles.bottomCtaText}>
              <h2 id="hire-heading" className={styles.sectionTitle}>
                ¿Listo para contratar?
              </h2>
              <p className={styles.bodyText}>
                Solicita el servicio de {worker.name} y coordina los detalles
                cuando el flujo esté conectado.
              </p>
            </div>
            <div className={styles.bottomCtaAction}>
              <Button
                variant="primary"
                onClick={handleRequest}
                disabled={requestSent}
              >
                {requestSent ? 'Solicitud enviada' : 'Solicitar servicio'}
              </Button>
            </div>
          </section>
        </div>
      </article>
    </div>
  );
}
