import { useState } from 'react';
import { Link, useNavigate, usePath } from '../router';
import { useAuth } from '../auth/AuthContext';
import styles from './AdminHeader.module.css';

const GROUPS = [
  { title: 'VISTA GENERAL', links: [{ to: '/admin', label: 'Resumen', icon: '▦' }] },
  { title: 'PERSONAS', links: [
    { to: '/admin/usuarios?rol=CLIENTE', label: 'Clientes', icon: '◉' },
    { to: '/admin/usuarios?rol=TRABAJADOR', label: 'Trabajadores', icon: '◈' },
    { to: '/admin/usuarios', label: 'Todas las cuentas', icon: '☷' },
    { to: '/admin/dpi', label: 'Verificación DPI', icon: '◇' },
  ] },
  { title: 'PLATAFORMA', links: [
    { to: '/admin/sugerencias', label: 'Oficios sugeridos', icon: '✦' },
    { to: '/admin/categorias', label: 'Categorías', icon: '▤' },
    { to: '/admin/zonas', label: 'Zonas', icon: '◎' },
    { to: '/admin/reportes', label: 'Reportes', icon: '⚑' },
  ] },
];

export default function AdminHeader() {
  const { logout, user } = useAuth();
  const path = usePath();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const current = `${path}${window.location.search}`;

  return <>
    <button className={styles.mobileToggle} type="button" aria-expanded={open} aria-controls="admin-navigation" onClick={() => setOpen((v) => !v)}>☰ <span>Administración</span></button>
    <aside id="admin-navigation" className={`${styles.sidebar} ${open ? styles.open : ''}`}>
      <Link to="/admin" className={styles.brand} onClick={() => setOpen(false)} aria-label="Ir al resumen de administración">
        <span className={styles.brandSymbol}>OY<span>.</span></span>
        <span className={styles.brandText}>OFICIOSYA<small>CONSOLA DE GESTIÓN</small></span>
      </Link>
      <div className={styles.environment}><span className={styles.dot} /> SISTEMA OPERATIVO <span className={styles.version}>v1.0</span></div>
      <nav className={styles.nav} aria-label="Administración">
        {GROUPS.map((group) => <div className={styles.group} key={group.title}>
          <p>{group.title}</p>
          {group.links.map(({ to, label, icon }) => {
            const active = to === '/admin' ? path === '/admin' : current === to;
            return <Link key={to} to={to} className={`${styles.link} ${active ? styles.active : ''}`} aria-current={active ? 'page' : undefined} onClick={() => setOpen(false)}>
              <span className={styles.icon} aria-hidden="true">{icon}</span>{label}
            </Link>;
          })}
        </div>)}
      </nav>
      <div className={styles.account}>
        <span className={styles.avatar}>{(user?.nombre || 'A').charAt(0).toUpperCase()}</span>
        <span className={styles.identity}><strong>{user?.nombre || 'Administrador'}</strong><small>Administrador</small></span>
        <button type="button" title="Cerrar sesión" aria-label="Cerrar sesión" onClick={async () => { await logout(); navigate('/admin/login', { replace: true }); }}>↪</button>
      </div>
    </aside>
    {open && <button className={styles.backdrop} aria-label="Cerrar menú" onClick={() => setOpen(false)} />}
  </>;
}
