import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { api } from '../api/client';
import { searchProfiles } from '../api/search';
import Logo from '../components/Logo';
import SearchFilters, { DEFAULT_FILTERS } from '../components/search/SearchFilters';
import ServiceRequestModal from '../components/requests/ServiceRequestModal';
import { Link } from '../router';
import ui from '../components/search/Search.module.css';
import styles from './Home.module.css';

const PAGE_SIZE = 12;
const money = (amount) => new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' }).format(amount);
const RATE_LABELS = { por_hora: 'Por hora', por_servicio: 'Por servicio', a_convenir: 'A convenir' };

export default function Home() {
  const { logout, user } = useAuth();
  const [draft, setDraft] = useState({ ...DEFAULT_FILTERS });
  const [query, setQuery] = useState({ ...DEFAULT_FILTERS, offset: 0 });
  const [zones, setZones] = useState(null);
  const [zonesError, setZonesError] = useState('');
  const [zonesRetry, setZonesRetry] = useState(0);
  const [validation, setValidation] = useState('');
  const [result, setResult] = useState({ perfiles: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    setZonesError('');
    api('/zonas?estado=ACTIVA&order=nombre:asc', { signal: controller.signal })
      .then((data) => { if (!controller.signal.aborted) setZones(data); })
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
    searchProfiles({ ...query, verificado: query.verificado ? true : undefined, limit: PAGE_SIZE }, { signal: controller.signal })
      .then((data) => { if (!controller.signal.aborted) setResult(data); })
      .catch((err) => {
        if (!controller.signal.aborted) setError(err.status ? err.message : 'No pudimos conectar con el servidor. Revisa tu conexión y vuelve a intentar.');
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [query]);

  const applySearch = (event) => {
    event.preventDefault();
    if (draft.precio_min !== '' && draft.precio_max !== '' && Number(draft.precio_min) > Number(draft.precio_max)) {
      setValidation('El precio máximo debe ser mayor o igual al mínimo.');
      return;
    }
    if ([draft.precio_min, draft.precio_max].some((value) => value !== '' && (!Number.isFinite(Number(value)) || Number(value) < 0))) {
      setValidation('Los precios deben ser números mayores o iguales a cero.');
      return;
    }
    setValidation('');
    setQuery({ ...draft, q: draft.q.trim(), offset: 0 });
  };
  const reset = () => {
    setDraft({ ...DEFAULT_FILTERS });
    setQuery({ ...DEFAULT_FILTERS, offset: 0 });
    setValidation('');
  };
  const change = (name, value) => { setDraft((current) => ({ ...current, [name]: value })); setValidation(''); };
  const total = Number(result.total);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brand}><Logo variant="compact" /><span>Oficios<span className={styles.brandAccent}>YA</span></span></div>
        <nav className={styles.nav} aria-label="Cuenta">
          <Link to="/worker/profile">Mi perfil de trabajador</Link>
          <button type="button" className={ui.textButton} onClick={() => logout()}>Cerrar sesión</button>
        </nav>
      </header>
      <main className={styles.main}>
        <section className={styles.hero} aria-labelledby="search-title">
          <p className={styles.eyebrow}>ENCUENTRA AYUDA CERCA DE TI</p>
          <h1 id="search-title">El oficio que necesitas,<br />en el lugar indicado.</h1>
          <p>Busca profesionales, compara sus servicios y cuéntales qué necesitas.</p>
          <form className={styles.searchBar} role="search" onSubmit={applySearch}>
            <label className="sr-only" htmlFor="general-search">Buscar por oficio o servicio</label>
            <span aria-hidden="true" className={styles.searchIcon}>⌕</span>
            <input id="general-search" type="search" maxLength={150} placeholder="¿Qué servicio necesitas? Ej. plomería" value={draft.q} onChange={(event) => change('q', event.target.value)} />
            <button type="submit" className={ui.primary}>Buscar</button>
          </form>
        </section>
        <div className={styles.layout}>
          <SearchFilters filters={draft} onChange={change} onSubmit={applySearch} onReset={reset} zones={zones} zonesError={zonesError} onRetryZones={() => setZonesRetry((n) => n + 1)} error={validation} />
          <section className={styles.results} aria-labelledby="results-title" aria-busy={loading}>
            <div className={styles.resultsHeading}>
              <h2 id="results-title">Profesionales para ti</h2>
              <p role="status">{loading ? 'Buscando profesionales…' : error ? 'Búsqueda no disponible' : `${total} ${total === 1 ? 'resultado' : 'resultados'}`}</p>
            </div>
            {query.q && <p className={styles.query}>Resultados para «{query.q}»</p>}
            {loading ? <div className={styles.empty}>Estamos buscando profesionales que coincidan con tu búsqueda.</div> : error ? (
              <div className={styles.empty}><p role="alert">{error}</p><button className={ui.secondary} onClick={() => setQuery({ ...query })}>Reintentar búsqueda</button></div>
            ) : result.perfiles.length === 0 ? (
              <div className={styles.empty}><h3>No encontramos profesionales</h3><p>Prueba otro oficio, amplía el rango de precio o cambia la zona.</p><button className={ui.secondary} onClick={reset}>Limpiar búsqueda y filtros</button></div>
            ) : <div className={styles.cards}>{result.perfiles.map((worker) => {
              const own = Number(worker.id_usuario) === Number(user?.id_usuario);
              return <article key={worker.id_perfil} className={styles.card}>
                <div className={styles.cardTop}><div className={styles.avatar} aria-hidden="true">{worker.nombre?.trim().charAt(0) || 'O'}</div><span className={worker.disponibilidad === 'Disponible' ? styles.available : styles.occupied}>{worker.disponibilidad}</span></div>
                <h3>{worker.nombre}</h3><p className={styles.profession}>{worker.oficio_principal}</p>
                {worker.verificado && <span className={styles.verified}>✓ Perfil verificado</span>}
                <p className={styles.rating}>{Number(worker.total_resenas) > 0 ? `★ ${Number(worker.reputacion).toFixed(1)} · ${worker.total_resenas} reseñas` : 'Sin reseñas todavía'}</p>
                <p className={styles.description}>{worker.descripcion || 'Consulta los servicios disponibles de este profesional.'}</p>
                <p className={styles.coverage}>Cobertura: {worker.cobertura?.map((zone) => zone.nombre).join(', ') || 'Por consultar'}</p>
                <div className={styles.cardBottom}><p className={styles.price}>{worker.tarifas?.monto_desde != null ? <>Desde <strong>{money(worker.tarifas.monto_desde)}</strong>{RATE_LABELS[worker.tarifas.tipo] && <small>{RATE_LABELS[worker.tarifas.tipo]}</small>}</> : 'Tarifa por consultar'}</p>
                  <button type="button" className={ui.primary} disabled={own} onClick={() => setSelected(worker)}>{own ? 'Este es tu perfil' : 'Solicitar servicio'}</button>
                </div>
              </article>;
            })}</div>}
            {!loading && !error && (query.offset > 0 || total > PAGE_SIZE) && <nav className={styles.pagination} aria-label="Páginas de resultados">
              <button className={ui.secondary} disabled={query.offset === 0} onClick={() => setQuery({ ...query, offset: Math.max(0, query.offset - PAGE_SIZE) })}>Anterior</button>
              <span>Página {Math.floor(query.offset / PAGE_SIZE) + 1}</span>
              <button className={ui.secondary} disabled={query.offset + PAGE_SIZE >= total} onClick={() => setQuery({ ...query, offset: query.offset + PAGE_SIZE })}>Siguiente</button>
            </nav>}
          </section>
        </div>
      </main>
      <footer className={styles.footer}>OficiosYA · Conectamos talento con quienes lo necesitan.</footer>
      {selected && <ServiceRequestModal worker={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
