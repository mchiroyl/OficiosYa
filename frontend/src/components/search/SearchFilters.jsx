import styles from './Search.module.css';

export const DEFAULT_FILTERS = {
  q: '', id_zona: '', disponibilidad: 'Disponible', precio_min: '',
  precio_max: '', reputacion_min: '', verificado: false, orden: 'relevancia',
};

export default function SearchFilters({ filters, onChange, onSubmit, onReset, zones, zonesError, onRetryZones, error }) {
  const change = (event) => onChange(event.target.name,
    event.target.type === 'checkbox' ? event.target.checked : event.target.value);
  return (
    <form className={styles.filters} onSubmit={onSubmit} aria-labelledby="filters-title">
      <div className={styles.filterHeading}>
        <h2 id="filters-title">Filtrar resultados</h2>
        <button type="button" className={styles.textButton} onClick={onReset}>Limpiar</button>
      </div>
      <label className={styles.field}>Zona de cobertura
        <select name="id_zona" value={filters.id_zona} onChange={change} disabled={!zones}>
          <option value="">{zones ? 'Todas las zonas' : 'Cargando zonas…'}</option>
          {zones?.map((zone) => <option key={zone.id_zona} value={zone.id_zona}>{zone.nombre}</option>)}
        </select>
      </label>
      {zonesError && <p className={styles.error} role="alert">{zonesError} <button type="button" onClick={onRetryZones} className={styles.textButton}>Reintentar zonas</button></p>}
      <label className={styles.field}>Disponibilidad
        <select name="disponibilidad" value={filters.disponibilidad} onChange={change}>
          <option value="Disponible">Disponibles</option><option value="Ocupado">Ocupados</option><option value="todos">Todos</option>
        </select>
      </label>
      <fieldset className={styles.priceRange}>
        <legend>Rango de precio (Q)</legend>
        <label className={styles.field}>Mínimo<input type="number" name="precio_min" min="0" step="0.01" placeholder="0" value={filters.precio_min} onChange={change} /></label>
        <label className={styles.field}>Máximo<input type="number" name="precio_max" min="0" step="0.01" placeholder="Sin límite" value={filters.precio_max} onChange={change} /></label>
      </fieldset>
      <label className={styles.field}>Calificación mínima
        <select name="reputacion_min" value={filters.reputacion_min} onChange={change}>
          <option value="">Cualquier calificación</option>
          {[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} {value === 1 ? 'estrella' : 'estrellas'} o más</option>)}
        </select>
      </label>
      <label className={styles.check}><input type="checkbox" name="verificado" checked={filters.verificado} onChange={change} />Solo trabajadores verificados</label>
      <label className={styles.field}>Ordenar por
        <select name="orden" value={filters.orden} onChange={change}>
          <option value="relevancia">Relevancia</option><option value="reputacion">Mejor calificación</option><option value="precio_asc">Menor precio</option><option value="precio_desc">Mayor precio</option>
        </select>
      </label>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <button className={styles.primary} type="submit">Aplicar filtros</button>
    </form>
  );
}
