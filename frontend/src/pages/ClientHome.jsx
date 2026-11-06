import { useEffect, useState } from 'react';
import AppHeader from '../components/AppHeader';
import { api } from '../api/client';
import { useNavigate } from '../router';
import ui from '../components/search/Search.module.css';
import styles from './Home.module.css';
import menu from './ClientHome.module.css';

const FALLBACK_CATEGORIES = [
  { id_categoria: 'plomeria', nombre: 'Plomería', q: 'plomero' },
  { id_categoria: 'electricidad', nombre: 'Electricidad', q: 'electricista' },
  { id_categoria: 'albanileria', nombre: 'Albañilería', q: 'albañil' },
  { id_categoria: 'carpinteria', nombre: 'Carpintería', q: 'carpintero' },
  { id_categoria: 'pintura', nombre: 'Pintura', q: 'pintor' },
  { id_categoria: 'jardineria', nombre: 'Jardinería', q: 'jardinero' },
  { id_categoria: 'limpieza', nombre: 'Limpieza', q: 'limpieza' },
  { id_categoria: 'tecnico', nombre: 'Técnico', q: 'técnico' },
];

export default function ClientHome() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState(FALLBACK_CATEGORIES);
  const [q, setQ] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    api('/categorias?order=nombre:asc', { signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted) return;
        const list = Array.isArray(data) ? data : data?.data || [];
        if (list.length) setCategories(list);
      })
      .catch(() => {
        /* se mantienen las categorías de respaldo */
      });
    return () => controller.abort();
  }, []);

  const openCategory = (cat) => {
    const id = cat.id_categoria;
    navigate(`/categoria/${encodeURIComponent(id)}`);
  };

  const submitSearch = (event) => {
    event.preventDefault();
    const term = q.trim();
    if (!term) {
      navigate('/buscar');
      return;
    }
    navigate(`/buscar?q=${encodeURIComponent(term)}`);
  };

  return (
    <div className={styles.page}>
      <AppHeader />
      <main className={styles.main}>
        <section className={styles.hero} aria-labelledby="client-home-title">
          <p className={styles.eyebrow}>MODO CLIENTE · EL ASINTAL</p>
          <h1 id="client-home-title">
            ¿Qué oficio necesitas
            <br />
            hoy?
          </h1>
          <p>Elige una categoría para ver profesionales, o busca por texto libre.</p>
          <form className={styles.searchBar} role="search" onSubmit={submitSearch}>
            <label className="sr-only" htmlFor="home-search">
              Buscar oficio
            </label>
            <span aria-hidden="true" className={styles.searchIcon}>
              ⌕
            </span>
            <input
              id="home-search"
              type="search"
              maxLength={150}
              placeholder='Ej. "plomero", "electricista"'
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <button type="submit" className={ui.primary}>
              Buscar
            </button>
          </form>
        </section>

        <section className={menu.section} aria-labelledby="categories-title">
          <div className={menu.sectionHead}>
            <h2 id="categories-title">Categorías de oficios</h2>
            <p>Al tocar una categoría abrirás su directorio completo.</p>
          </div>
          <div className={menu.grid}>
            {categories.map((cat) => (
              <button
                key={cat.id_categoria}
                type="button"
                className={menu.tile}
                onClick={() => openCategory(cat)}
              >
                <span className={menu.tileIcon} aria-hidden="true">
                  {String(cat.nombre || '?').trim().charAt(0).toUpperCase()}
                </span>
                <span className={menu.tileBody}>
                  <strong>{cat.nombre}</strong>
                  <small>Ver profesionales →</small>
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className={menu.quick}>
          <button type="button" className={ui.secondary} onClick={() => navigate('/buscar')}>
            Ver todos los profesionales
          </button>
          <button
            type="button"
            className={ui.primary}
            onClick={() => navigate('/mis-solicitudes')}
          >
            Mis solicitudes
          </button>
        </section>
      </main>
      <footer className={styles.footer}>OficiosYA · Modo Cliente</footer>
    </div>
  );
}
