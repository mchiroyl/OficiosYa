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
import AppHeader from '../components/AppHeader';
import { Link } from '../router';
import { useAuth } from '../auth/AuthContext';
import { isAdminUser } from '../lib/admin';
import {
  listCategories,
  listReports,
  listUsers,
  listWorkerProfiles,
} from '../api/admin';
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

  useEffect(() => {
    if (!token || !isAdminUser(user)) return;
    Promise.all([
      listUsers(token),
      listWorkerProfiles(token),
      listResource('solicitudes', {}, token),
      listCategories(token),
      listReports(token),
    ])
      .then(([u, w, s, c, r]) => {
        setUsers(u);
        setWorkers(w);
        setRequests(s);
        setCategories(c);
        setReports(r);
      })
      .catch((err) => setError(err.message || 'No se pudieron cargar las métricas.'));
  }, [token, user]);

  const metrics = useMemo(() => {
    const clientes = users.filter((u) => !workers.some((w) => Number(w.id_usuario) === Number(u.id_usuario))).length;
    const trabajadores = workers.length;
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

    return { clientes, trabajadores, activos, tasa, avg, topCats, pendingReports: reports.filter((r) => r.estado === 'Pendiente').length };
  }, [users, workers, requests, reports]);

  if (!isAdminUser(user)) {
    return (
      <div className={styles.page}>
        <AppHeader />
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
        backgroundColor: '#299d98',
        borderRadius: 8,
      },
    ],
  };

  const doughnutData = {
    labels: ['Clientes', 'Trabajadores'],
    datasets: [
      {
        data: [metrics.clientes, metrics.trabajadores],
        backgroundColor: ['#83d0cc', '#247c7c'],
      },
    ],
  };

  return (
    <div className={styles.page}>
      <AppHeader />
      <main className={styles.main}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>MÓDULO ADMIN</p>
            <h1>Dashboard de inteligencia</h1>
            <p>Métricas en tiempo real de uso de la plataforma.</p>
          </div>
          <nav className={styles.adminNav}>
            <Link to="/admin/usuarios">Usuarios</Link>
            <Link to="/admin/categorias">Categorías</Link>
            <Link to="/admin/zonas">Zonas</Link>
            <Link to="/admin/dpi">Auditoría DPI</Link>
            <Link to="/admin/reportes">Reportes</Link>
          </nav>
        </header>

        {error && <p className={styles.error}>{error}</p>}

        <section className={styles.kpis}>
          <article><p>Usuarios activos</p><strong>{metrics.activos}</strong></article>
          <article><p>Clientes / Trabajadores</p><strong>{metrics.clientes} / {metrics.trabajadores}</strong></article>
          <article><p>Promedio calificaciones</p><strong>{metrics.avg}</strong></article>
          <article><p>Tasa completados</p><strong>{metrics.tasa}%</strong></article>
          <article><p>Reportes pendientes</p><strong>{metrics.pendingReports}</strong></article>
        </section>

        <section className={styles.charts}>
          <div className={styles.chartCard}>
            <h2>Oficios más solicitados</h2>
            <Bar data={barData} options={{ responsive: true, plugins: { legend: { display: false } } }} />
          </div>
          <div className={styles.chartCard}>
            <h2>Clientes vs trabajadores</h2>
            <Doughnut data={doughnutData} />
          </div>
        </section>
      </main>
    </div>
  );
}
