import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { api } from '../api/client';
import { searchProfiles } from '../api/search';
import AppHeader from '../components/AppHeader';
import BackLink from '../components/BackLink';
import SearchFilters, { DEFAULT_FILTERS } from '../components/search/SearchFilters';
import ServiceRequestModal from '../components/requests/ServiceRequestModal';
import { Link, matchPath, useNavigate, usePath, useSearch } from '../router';
import ui from '../components/search/Search.module.css';
import styles from './Home.module.css';

const PAGE_SIZE = 12;
const money = (amount) =>
  new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' }).format(amount);
const RATE_LABELS = {
  por_hora: 'Por hora',
  por_servicio: 'Por servicio',
  a_convenir: 'A convenir',
};

/**
 * Interfaz de directorio / resultados.
 * Se usa en `/buscar` y `/categoria/:id` (pantalla aparte del menú principal).
 */
export default function SearchDirectory() {
  const path = usePath();
  const search = useSearch();
  const navigate = useNavigate();
  const { user } = useAuth();
  const categoryParams = matchPath('/categoria/:id', path);
  const categoryId = categoryParams?.id ? decodeURIComponent(categoryParams.id) : '';
  const initialQ = useMemo(() => {
    try {
      return new URLSearchParams(search).get('q') || '';
    } catch {
      return '';
    }
  }, [search]);

  const [draft, setDraft] = useState({
    ...DEFAULT_FILTERS,
    q: initialQ,
    id_categoria: categoryId || '',
  });
  const [query, setQuery] = useState({
    ...DEFAULT_FILTERS,
    q: initialQ,
    id_categoria: categoryId || '',
    offset: 0,
  });
  const [zones, setZones] = useState(null);
  const [categories, setCategories] = useState([]);
  const [zonesError, setZonesError] = useState('');
  const [zonesRetry, setZonesRetry] = useState(0);
  const [validation, setValidation] = useState('');
  const [result, setResult] = useState({ perfiles: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    setDraft((prev) => ({
      ...prev,
      q: initialQ || prev.q,
      id_categoria: categoryId || prev.id_categoria,
    }));
    setQuery((prev) => ({
      ...prev,
      q: initialQ,
      id_categoria: categoryId || '',
      offset: 0,
    }));
  }, [categoryId, initialQ]);

  useEffect(() => {
    const controller = new AbortController();
    setZonesError('');
    Promise.all([
      api('/zonas?estado=ACTIVA&order=nombre:asc', { signal: controller.signal }),
      api('/categorias?order=nombre:asc', { signal: controller.signal }).catch(() => []),
    ])
      .then(([zonesData, cats]) => {
        if (controller.signal.aborted) return;
        setZones(Array.isArray(zonesData) ? zonesData : zonesData?.data || []);
        setCategories(Array.isArray(cats) ? cats : cats?.data || []);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setZones([]);
        setZonesError('No se pudieron cargar las zonas. Puedes buscar sin ese filtro.');
      });
    return () => controller.abort();
  }, [zonesRetry]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');

    const filters = {
      ...query,
      verificado: query.verificado ? true : undefined,
      limit: PAGE_SIZE,
    };

    // Categorías de respaldo (string no numérico) se buscan por texto de oficio.
    if (filters.id_categoria && !/^\d+$/.test(String(filters.id_categoria))) {
      const cat = categories.find(
        (c) => String(c.id_categoria) === String(filters.id_categoria),
      );
      filters.q = filters.q || cat?.nombre || filters.id_categoria;
      delete filters.id_categoria;
    }

    searchProfiles(filters, { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) setResult(data);
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setError(
            err.status
              ? err.message
              : 'No pudimos conectar con el servidor. Revisa tu conexión y vuelve a intentar.',
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [query, categories]);

  const applySearch = (event) => {
    event.preventDefault();
    if (
      draft.precio_min !== '' &&
      draft.precio_max !== '' &&
      Number(draft.precio_min) > Number(draft.precio_max)
    ) {
      setValidation('El precio máximo debe ser mayor o igual al mínimo.');
      return;
    }
    if (
      [draft.precio_min, draft.precio_max].some(
        (value) => value !== '' && (!Number.isFinite(Number(value)) || Number(value) < 0),
      )
    ) {
      setValidation('Los precios deben ser números mayores o iguales a cero.');
      return;
    }
    setValidation('');
    setQuery({ ...draft, q: draft.q.trim(), offset: 0 });
  };

  const reset = () => {
    const next = {
      ...DEFAULT_FILTERS,
      id_categoria: categoryId || '',
      offset: 0,
    };
    setDraft({ ...DEFAULT_FILTERS, id_categoria: categoryId || '' });
    setQuery(next);
    setValidation('');
  };

  const change = (name, value) => {
    setDraft((current) => ({ ...current, [name]: value }));
    setValidation('');
  };

  const total = Number(result.total);
  const categoryName =
    categories.find((c) => String(c.id_categoria) === String(categoryId))?.nombre ||
    (categoryId && !/^\d+$/.test(categoryId)
      ? categoryId.charAt(0).toUpperCase() + categoryId.slice(1)
      : '');

  const title = categoryName
    ? `Categoría: ${categoryName}`
    : query.q
      ? `Resultados de búsqueda`
      : 'Directorio de profesionales';

  return (
    <div className={styles.page}>
      <AppHeader />
      <main className={styles.main}>
        <BackLink to="/">Volver al menú principal</BackLink>

        <section className={styles.hero} aria-labelledby="search-title">
          <p className={styles.eyebrow}>
            {categoryId ? 'DIRECTORIO POR CATEGORÍA' : 'BUSQUEDA Y FILTROS'}
          </p>
          <h1 id="search-title">{title}</h1>
          <p>
            {categoryId
              ? `Profesionales de ${categoryName || 'esta categoría'} en El Asintal. Refina con filtros a la izquierda.`
              : 'Busca por oficio y combina filtros de zona, precio y reputación.'}
          </p>
          <form className={styles.searchBar} role="search" onSubmit={applySearch}>
            <label className="sr-only" htmlFor="general-search">
              Buscar por oficio o servicio
            </label>
            <span aria-hidden="true" className={styles.searchIcon}>
              ⌕
            </span>
            <input
              id="general-search"
              type="search"
              maxLength={150}
              placeholder='Ej. "plomero", "electricista"'
              value={draft.q}
              onChange={(event) => change('q', event.target.value)}
            />
            <button type="submit" className={ui.primary}>
              Buscar
            </button>
          </form>
        </section>

        <div className={styles.layout}>
          <SearchFilters
            filters={draft}
            onChange={change}
            onSubmit={applySearch}
            onReset={reset}
            zones={zones}
            zonesError={zonesError}
            onRetryZones={() => setZonesRetry((n) => n + 1)}
            categories={categories}
            error={validation}
          />
          <section className={styles.results} aria-labelledby="results-title" aria-busy={loading}>
            <div className={styles.resultsHeading}>
              <h2 id="results-title">Profesionales</h2>
              <p role="status">
                {loading
                  ? 'Buscando…'
                  : error
                    ? 'Búsqueda no disponible'
                    : `${total} ${total === 1 ? 'resultado' : 'resultados'}`}
              </p>
            </div>

            {loading ? (
              <div className={styles.empty}>Cargando profesionales…</div>
            ) : error ? (
              <div className={styles.empty}>
                <p role="alert">{error}</p>
                <button className={ui.secondary} onClick={() => setQuery({ ...query })}>
                  Reintentar
                </button>
              </div>
            ) : result.perfiles.length === 0 ? (
              <div className={styles.empty}>
                <h3>No encontramos profesionales</h3>
                <p>Prueba otra categoría, amplía el precio o cambia la zona.</p>
                <button className={ui.secondary} onClick={() => navigate('/')}>
                  Volver al menú de categorías
                </button>
              </div>
            ) : (
              <div className={styles.cards}>
                {result.perfiles.map((worker) => {
                  const own = Number(worker.id_usuario) === Number(user?.id_usuario);
                  const profilePath = `/workers/${worker.id_perfil}`;
                  return (
                    <article
                      key={worker.id_perfil}
                      className={`${styles.card} ${styles.cardClickable}`}
                      role="link"
                      tabIndex={0}
                      onClick={() => navigate(profilePath)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          navigate(profilePath);
                        }
                      }}
                    >
                      <div className={styles.cardTop}>
                        <div className={styles.avatar} aria-hidden="true">
                          {worker.nombre?.trim().charAt(0) || 'O'}
                        </div>
                        <span
                          className={
                            worker.disponibilidad === 'Disponible'
                              ? styles.available
                              : styles.occupied
                          }
                        >
                          {worker.disponibilidad}
                        </span>
                      </div>
                      <h3>{worker.nombre}</h3>
                      <p className={styles.profession}>{worker.oficio_principal}</p>
                      {worker.verificado && (
                        <span className={styles.verified}>✓ Perfil verificado</span>
                      )}
                      <p className={styles.rating}>
                        {Number(worker.total_resenas) > 0
                          ? `★ ${Number(worker.reputacion).toFixed(1)} · ${worker.total_resenas} reseñas`
                          : 'Sin reseñas todavía'}
                      </p>
                      <p className={styles.description}>
                        {worker.descripcion || 'Consulta los servicios de este profesional.'}
                      </p>
                      <p className={styles.coverage}>
                        Cobertura:{' '}
                        {worker.cobertura?.map((zone) => zone.nombre).join(', ') ||
                          'Por consultar'}
                      </p>
                      <div className={styles.cardBottom}>
                        <p className={styles.price}>
                          {worker.tarifas?.monto_desde != null ? (
                            <>
                              Desde <strong>{money(worker.tarifas.monto_desde)}</strong>
                              {RATE_LABELS[worker.tarifas.tipo] && (
                                <small>{RATE_LABELS[worker.tarifas.tipo]}</small>
                              )}
                            </>
                          ) : (
                            'Tarifa por consultar'
                          )}
                        </p>
                        <div
                          style={{ display: 'grid', gap: 8, width: '100%' }}
                          onClick={(event) => event.stopPropagation()}
                          onKeyDown={(event) => event.stopPropagation()}
                        >
                          <Link to={profilePath} className={ui.secondary}>
                            Ver perfil
                          </Link>
                          <button
                            type="button"
                            className={ui.primary}
                            disabled={own}
                            onClick={() => setSelected(worker)}
                          >
                            {own ? 'Este es tu perfil' : 'Solicitar servicio'}
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            {!loading && !error && (query.offset > 0 || total > PAGE_SIZE) && (
              <nav className={styles.pagination} aria-label="Páginas">
                <button
                  className={ui.secondary}
                  disabled={query.offset === 0}
                  onClick={() =>
                    setQuery({ ...query, offset: Math.max(0, query.offset - PAGE_SIZE) })
                  }
                >
                  Anterior
                </button>
                <span>Página {Math.floor(query.offset / PAGE_SIZE) + 1}</span>
                <button
                  className={ui.secondary}
                  disabled={query.offset + PAGE_SIZE >= total}
                  onClick={() => setQuery({ ...query, offset: query.offset + PAGE_SIZE })}
                >
                  Siguiente
                </button>
              </nav>
            )}
          </section>
        </div>
      </main>
      {selected && (
        <ServiceRequestModal worker={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
