import { Link } from '../router';
import Rating from '../components/worker/Rating';
import { MapPinIcon } from '../components/icons/Icons';
import { workers } from '../data/workers';
import styles from './Home.module.css';

export default function Home() {
  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <p className={styles.kicker}>OficiosYa</p>
        <h1 className={styles.title}>Encuentra el oficio que necesitas</h1>
        <p className={styles.lead}>
          Revisa perfiles, cobertura y calificaciones. Solicita el servicio cuando
          encuentres al trabajador indicado.
        </p>
      </section>

      <section className={styles.catalog} aria-labelledby="catalog-heading">
        <h2 id="catalog-heading" className={styles.sectionTitle}>
          Trabajadores disponibles
        </h2>
        <ul className={styles.grid}>
          {workers.map((worker) => (
            <li key={worker.id}>
              <Link to={`/workers/${worker.id}`} className={styles.card}>
                <img
                  src={worker.avatar}
                  alt=""
                  className={styles.avatar}
                  width={72}
                  height={72}
                />
                <div className={styles.cardBody}>
                  <p className={styles.name}>{worker.name}</p>
                  <p className={styles.profession}>{worker.profession}</p>
                  <Rating value={worker.rating} reviewCount={worker.reviewCount} />
                  <p className={styles.location}>
                    <MapPinIcon />
                    <span>{worker.location}</span>
                  </p>
                  {worker.available && (
                    <span className={styles.badge}>Disponible</span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
