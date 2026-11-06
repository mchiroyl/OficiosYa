import { useEffect, useMemo, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import AdminHeader from '../components/AdminHeader';
import { Link } from '../router';
import { useAuth } from '../auth/AuthContext';
import { isAdminUser } from '../lib/admin';
import {
  listCategories,
  listUsers,
  listWorkerProfiles,
} from '../api/admin';
import { listAdminReports } from '../api/reports';
import { listResource } from '../api/resources';
import styles from './Admin.module.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

export default function AdminDashboard() {
  const { session, user } = useAuth();
  const token = session?.accessToken;
  const [users, setUsers] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [requests, setRequests] = useState([]);
  const [categories, setCategories] = useState([]);
  const [reports, setReports] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token || !isAdminUser(user)) return;
    Promise.allSettled([
      listUsers(token),
      listWorkerProfiles(token),
      listResource('solicitudes', {}, token),
      listCategories(token),
      listAdminReports(token, { estado: 'todos' }),
    ])
      .then(([u, w, s, c, r]) => {
        if (u.status === 'fulfilled') setUsers(u.value);
        if (w.status === 'fulfilled') setWorkers(w.value);
        if (s.status === 'fulfilled') setRequests(s.value);
        if (c.status === 'fulfilled') setCategories(c.value);
        if (r.status === 'fulfilled') setReports(r.value);
        if ([u, w, s, c, r].some((result) => result.status === 'rejected')) {
          setError('Algunos datos no se pudieron cargar. Las secciones disponibles siguen visibles.');
        }
      })
      .finally(() => setLoading(false));
  }, [token, user]);

  const metrics = useMemo(() => {
    const clientes = users.filter((u) => !isAdminUser(u) && String(u.rol || 'CLIENTE').toUpperCase() === 'CLIENTE').length;
    const trabajadores = users.filter((u) => !isAdminUser(u) && String(u.rol || '').toUpperCase() === 'TRABAJADOR').length;
    const activos = users.filter((u) => u.estado === 'ACTIVO').length;
    const finalizadas = requests.filter((r) => r.estado === 'Finalizada').length;
    const tasa = requests.length ? Math.round((finalizadas / requests.length) * 100) : 0;
    const ratings = workers
      .map((w) => Number(w.promedio_calificacion || w.reputacion || 0))
      .filter((n) => n > 0);
    const avg =
      ratings.length > 0
        ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(2)
        : '—';

    const byCategory = {};
    for (const req of requests) {
      const key = req.id_servicio || 'Sin categoría';
      byCategory[key] = (byCategory[key] || 0) + 1;
    }
    const topCats = Object.entries(byCategory)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);

    return { clientes, trabajadores, activos, tasa, avg, topCats,
      pendingUsers: users.filter((u) => u.estado === 'PENDIENTE' || u.estado === 'INACTIVO').length,
      pendingReports: reports.filter((r) => r.estado === 'PENDIENTE').length };
  }, [users, workers, requests, reports]);

  if (!isAdminUser(user)) {
    return (
      <div className={styles.page}>
        <AdminHeader />
        <main className={styles.main}>
          <div className={styles.empty}>No tienes permisos de administrador.</div>
        </main>
      </div>
    );
  }

  const barData = {
    labels: metrics.topCats.map(([id]) => {
      const cat = categories.find((c) => Number(c.id_categoria) === Number(id));
      return cat?.nombre || `Servicio ${id}`;
    }),
    datasets: [
      {
        label: 'Solicitudes',
        data: metrics.topCats.map(([, count]) => count),
        backgroundColor: '#171717',
        borderRadius: 8,
      },
    ],
  };

  const doughnutData = {
    labels: ['Clientes', 'Trabajadores'],
    datasets: [
      {
        data: [metrics.clientes, metrics.trabajadores],
        backgroundColor: ['#1b1b1b', '#bcbcbc'],
      },
    ],
  };

  return (
    <div className={styles.page}>
      <AdminHeader />
      <main className={styles.main}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>OFICIOSYA / ADMINISTRACIÓN</p>
            <h1>Centro de operaciones</h1>
            <p>Una vista clara del movimiento de la plataforma y de las decisiones pendientes.</p>
          </div>
          <nav className={styles.adminNav}>
            <Link to="/admin/usuarios">Aprobar usuarios</Link>
            <Link to="/admin/sugerencias">Sugerencias de oficios</Link>
            <Link to="/admin/categorias">Categorías</Link>
            <Link to="/admin/zonas">Zonas</Link>
            <Link to="/admin/dpi">Auditoría DPI</Link>
            <Link to="/admin/reportes">Reportes</Link>
          </nav>
        </header>

        {error && <p className={styles.error}>{error}</p>}

        <section className={styles.kpis} aria-label="Indicadores de la plataforma">
          <article><p>Usuarios activos</p><strong>{metrics.activos}</strong></article>
          <article><p>Cuentas por aprobar</p><strong>{metrics.pendingUsers}</strong></article>
          <article><p>Clientes / Trabajadores</p><strong>{metrics.clientes} / {metrics.trabajadores}</strong></article>
          <article><p>Promedio calificaciones</p><strong>{metrics.avg}</strong></article>
          <article><p>Tasa completados</p><strong>{metrics.tasa}%</strong></article>
          <article><p>Reportes pendientes</p><strong>{metrics.pendingReports}</strong></article>
        </section>

        <div className={styles.sectionHeading}><h2>Módulos de gestión</h2><span>Accesos rápidos</span></div>
        <section className={styles.moduleGrid} aria-label="Módulos de administración">
          {[
            ['/admin/usuarios?rol=CLIENTE', '01 / PERSONAS', 'Clientes', 'Consulta y aprueba cuentas de clientes.'],
            ['/admin/usuarios?rol=TRABAJADOR', '02 / PERSONAS', 'Trabajadores', 'Revisa trabajadores y su estado.'],
            ['/admin/sugerencias', '03 / CATÁLOGO', 'Oficios sugeridos', 'Decide qué oficios se agregan.'],
            ['/admin/categorias', '04 / SISTEMA', 'Categorías', 'Organiza el catálogo de servicios.'],
            ['/admin/zonas', '05 / SISTEMA', 'Zonas', 'Mantén las áreas de cobertura.'],
            ['/admin/reportes', '06 / SEGURIDAD', 'Moderación', 'Resuelve reportes y verificaciones.'],
          ].map(([to, tag, title, description]) => <Link to={to} className={styles.moduleCard} key={to}>
            <small>{tag}</small><strong>{title}</strong><span>{description}</span><b>ABRIR MÓDULO ↗</b>
          </Link>)}
        </section>

        <div className={styles.sectionHeading}><h2>Actividad</h2><span>{loading ? 'Actualizando…' : 'Datos actuales'}</span></div>
        <section className={styles.charts}>
          <div className={styles.chartCard}>
            <h2>Oficios más solicitados</h2>
            {metrics.topCats.length ? <Bar data={barData} options={{ responsive: true, plugins: { legend: { display: false } } }} /> :
              <div className={styles.emptyState}><strong>Aún no hay solicitudes</strong><p>Cuando se creen servicios, aquí aparecerán los oficios con más movimiento.</p></div>}
          </div>
          <div className={styles.chartCard}>
            <h2>Clientes vs trabajadores</h2>
            {metrics.clientes + metrics.trabajadores ? <Doughnut data={doughnutData} /> :
              <div className={styles.emptyState}><strong>Aún no hay cuentas</strong><p>Las cuentas nuevas aparecerán aquí después del registro.</p></div>}
          </div>
        </section>
      </main>
    </div>
  );
}
