import TopBar from '../TopBar';
import { usePath } from '../../router';
import styles from './AuthLayout.module.css';

export default function AuthLayout({ mode, onModeChange, children }) {
  const login = usePath() === '/login';
  const worker = mode === 'worker';
  return (
    <div className={`${styles.shell} ${worker ? styles.worker : styles.client}`}>
      <TopBar mode={mode} onModeChange={onModeChange} />
      <main className={`${styles.main} ${login ? styles.login : ''}`}>
        {login && (
          <section className={styles.intro} aria-labelledby="mode-title" aria-live="polite">
            <p className={styles.badge}>{worker ? 'OFRECE TUS SERVICIOS' : 'ENCUENTRA AYUDA CERCA DE TI'}</p>
            <h2 id="mode-title">{worker ? 'Tu oficio, nuevas oportunidades.' : 'El profesional que necesitas, a tu alcance.'}</h2>
            <p>{worker ? 'Entra a tu espacio de trabajo y organiza los servicios que ofreces.' : 'Entra para encontrar profesionales y dar seguimiento a los servicios de tu hogar.'}</p>
            <ul className={styles.features}>
              {(worker
                ? ['Gestiona tus solicitudes de trabajo', 'Publica tu oferta, tarifas y portafolio', 'Actualiza tu disponibilidad y habla con tus clientes']
                : ['Explora profesionales por categoría', 'Compara perfiles y solicita un servicio', 'Conversa con tu trabajador y califica el resultado']
              ).map((feature) => <li key={feature}>{feature}</li>)}
            </ul>
            <p className={styles.note}>Una misma cuenta para contratar y ofrecer servicios. Puedes cambiar de modo cuando quieras.</p>
          </section>
        )}
        {children}
      </main>
    </div>
  );
}
