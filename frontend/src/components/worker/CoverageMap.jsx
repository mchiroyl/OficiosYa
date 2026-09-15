import { MapPinIcon } from '../icons/Icons';
import styles from './CoverageMap.module.css';

/**
 * Mapa visual de zona de cobertura (HU-12).
 * Representación frontend sin API keys; `coverage.center` queda listo
 * para conectar Leaflet/Mapbox más adelante.
 */
export default function CoverageMap({ coverage }) {
  if (!coverage) return null;

  const {
    centerLabel,
    radiusKm,
    description,
    areas = [],
    center,
  } = coverage;

  return (
    <section className={styles.section} aria-labelledby="coverage-heading">
      <h2 id="coverage-heading" className={styles.title}>
        Zona de cobertura
      </h2>

      <p className={styles.description}>
        {description ||
          `Zona de cobertura: hasta ${radiusKm} km alrededor de ${centerLabel}.`}
      </p>

      <div
        className={styles.mapFrame}
        role="img"
        aria-label={`Mapa de cobertura: ${radiusKm} km alrededor de ${centerLabel}`}
        data-lat={center?.lat}
        data-lng={center?.lng}
        data-radius-km={radiusKm}
      >
        <svg
          className={styles.mapSvg}
          viewBox="0 0 640 360"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
          focusable="false"
        >
          <defs>
            <linearGradient id="mapSky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#d8f0ee" />
              <stop offset="100%" stopColor="#eef7f6" />
            </linearGradient>
            <radialGradient id="coverageFill" cx="50%" cy="48%" r="42%">
              <stop offset="0%" stopColor="#299d98" stopOpacity="0.28" />
              <stop offset="70%" stopColor="#83d0cc" stopOpacity="0.16" />
              <stop offset="100%" stopColor="#83d0cc" stopOpacity="0" />
            </radialGradient>
          </defs>

          <rect width="640" height="360" fill="url(#mapSky)" />

          {/* Grid de calles estilizado */}
          {Array.from({ length: 9 }).map((_, i) => (
            <line
              key={`v-${i}`}
              x1={40 + i * 70}
              y1="20"
              x2={40 + i * 70}
              y2="340"
              stroke="#c9e6e3"
              strokeWidth="1.5"
            />
          ))}
          {Array.from({ length: 6 }).map((_, i) => (
            <line
              key={`h-${i}`}
              x1="20"
              y1={30 + i * 55}
              x2="620"
              y2={30 + i * 55}
              stroke="#c9e6e3"
              strokeWidth="1.5"
            />
          ))}

          {/* Bloques urbanos */}
          <rect x="90" y="70" width="70" height="45" rx="4" fill="#b8ddd9" opacity="0.55" />
          <rect x="200" y="120" width="90" height="55" rx="4" fill="#a9d6d2" opacity="0.5" />
          <rect x="360" y="80" width="80" height="50" rx="4" fill="#b8ddd9" opacity="0.55" />
          <rect x="450" y="180" width="100" height="60" rx="4" fill="#a9d6d2" opacity="0.45" />
          <rect x="120" y="220" width="110" height="50" rx="4" fill="#b8ddd9" opacity="0.5" />
          <rect x="280" y="250" width="75" height="40" rx="4" fill="#a9d6d2" opacity="0.45" />

          {/* Área de cobertura */}
          <circle cx="320" cy="175" r="120" fill="url(#coverageFill)" />
          <circle
            cx="320"
            cy="175"
            r="118"
            fill="none"
            stroke="#299d98"
            strokeWidth="2.5"
            strokeDasharray="8 6"
            opacity="0.85"
          />

          {/* Marcador central */}
          <g transform="translate(320 145)">
            <path
              d="M0 0c-14 0-26 11-26 26 0 18 26 40 26 40s26-22 26-40c0-15-12-26-26-26z"
              fill="#247c7c"
            />
            <circle cx="0" cy="24" r="9" fill="#ffffff" />
            <circle cx="0" cy="24" r="4.5" fill="#299d98" />
          </g>

          {/* Etiqueta */}
          <g transform="translate(320 292)">
            <rect
              x="-78"
              y="-14"
              width="156"
              height="28"
              rx="14"
              fill="#ffffff"
              stroke="#d9d9d9"
            />
            <text
              x="0"
              y="5"
              textAnchor="middle"
              fill="#247c7c"
              fontFamily="Poppins, sans-serif"
              fontSize="12"
              fontWeight="600"
            >
              {centerLabel} · {radiusKm} km
            </text>
          </g>
        </svg>

        <div className={styles.mapBadge}>
          <MapPinIcon />
          <span>{centerLabel}</span>
        </div>
      </div>

      {areas.length > 0 && (
        <ul className={styles.areas} aria-label="Colonias y municipios cubiertos">
          {areas.map((area) => (
            <li key={area} className={styles.areaChip}>
              {area}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
