import TopBar from '../TopBar';
import { usePath } from '../../router';
import { Link } from '../../router';
import styles from './AuthLayout.module.css';

export default function AuthLayout({ mode, onModeChange, children, hideMode = false }) {
  const path = usePath();
  const login = path === '/login';
  const admin = mode === 'admin' || path === '/admin/login' || path === '/admin/register';
  const worker = mode === 'worker';
  return (
    <div className={`${styles.shell} ${admin ? styles.admin : worker ? styles.worker : styles.client}`}>
      {admin ? <header className={styles.adminBar}>
        <Link to="/admin/login" className={styles.adminBrand}>OFICIOS<span>YA</span><small> / ADMINISTRACIÓN</small></Link>
        <Link to="/login" className={styles.publicLink}>Acceso público ↗</Link>
      </header> : <TopBar mode={mode} onModeChange={onModeChange} hideMode={hideMode} />}
      <main className={`${styles.main} ${login || admin ? styles.login : ''}`}>
        {login && !admin && (
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
            <p className={styles.note}>Una misma cuenta para contratar y ofrecer servicios. El administrador entra por un acceso aparte.</p>
          </section>
        )}
        {admin && (
          <section className={styles.intro} aria-labelledby="mode-title">
            <p className={styles.badge}>PANEL DE ADMINISTRACIÓN</p>
            <h2 id="mode-title">Gestión completa de la plataforma.</h2>
            <p>Aprueba cuentas, revisa oficios sugeridos y configura el catálogo sin mezclarte con el flujo de cliente o trabajador.</p>
            <ul className={styles.features}>
              {['Aprobar o rechazar usuarios nuevos', 'Validar sugerencias de oficios', 'Mantener categorías, zonas y moderación'].map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
          </section>
        )}
        {children}
      </main>
    </div>
  );
}
