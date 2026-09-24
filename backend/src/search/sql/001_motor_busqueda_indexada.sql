-- Motor de Búsqueda Indexada (HU-10, HU-11)
-- Ejecutar en el SQL Editor de Supabase. Idempotente.

CREATE OR REPLACE FUNCTION oficiosya_safe_jsonb(raw text)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF raw IS NULL OR btrim(raw) = '' OR left(btrim(raw), 1) <> '{' THEN
    RETURN NULL;
  END IF;
  RETURN btrim(raw)::jsonb;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION oficiosya_safe_numeric(raw text)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN NULLIF(btrim(raw), '')::numeric;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION oficiosya_perfil_bio(raw text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  parsed jsonb;
BEGIN
  parsed := oficiosya_safe_jsonb(raw);
  IF parsed IS NULL THEN
    RETURN coalesce(raw, '');
  END IF;
  RETURN coalesce(parsed->>'bio', '');
END;
$$;

CREATE OR REPLACE FUNCTION oficiosya_perfil_tsv(oficio text, experiencia text, descripcion text)
RETURNS tsvector
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT to_tsvector(
    'simple',
    coalesce(oficio, '') || ' ' || coalesce(experiencia, '') || ' ' || oficiosya_perfil_bio(descripcion)
  );
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'perfil_trabajador' AND column_name = 'tarifa_desde'
  ) THEN
    ALTER TABLE perfil_trabajador
      ADD COLUMN tarifa_desde numeric
      GENERATED ALWAYS AS (
        oficiosya_safe_numeric(oficiosya_safe_jsonb(descripcion) #>> '{tarifas,monto_desde}')
      ) STORED;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'perfil_trabajador' AND column_name = 'tarifa_hasta'
  ) THEN
    ALTER TABLE perfil_trabajador
      ADD COLUMN tarifa_hasta numeric
      GENERATED ALWAYS AS (
        oficiosya_safe_numeric(oficiosya_safe_jsonb(descripcion) #>> '{tarifas,monto_hasta}')
      ) STORED;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'perfil_trabajador' AND column_name = 'tarifa_tipo'
  ) THEN
    ALTER TABLE perfil_trabajador
      ADD COLUMN tarifa_tipo varchar(40)
      GENERATED ALWAYS AS (
        NULLIF(oficiosya_safe_jsonb(descripcion) #>> '{tarifas,tipo}', '')
      ) STORED;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'perfil_trabajador' AND column_name = 'busqueda_tsv'
  ) THEN
    ALTER TABLE perfil_trabajador
      ADD COLUMN busqueda_tsv tsvector
      GENERATED ALWAYS AS (
        oficiosya_perfil_tsv(oficio_principal, experiencia, descripcion)
      ) STORED;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_perfil_busqueda_tsv
  ON perfil_trabajador USING gin (busqueda_tsv);

CREATE INDEX IF NOT EXISTS idx_perfil_disponibilidad
  ON perfil_trabajador (disponibilidad);

CREATE INDEX IF NOT EXISTS idx_perfil_tarifa_desde
  ON perfil_trabajador (tarifa_desde)
  WHERE tarifa_desde IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_perfil_verificado
  ON perfil_trabajador (verificado);

CREATE INDEX IF NOT EXISTS idx_perfil_id_usuario
  ON perfil_trabajador (id_usuario);

CREATE INDEX IF NOT EXISTS idx_perfil_oficio_lower
  ON perfil_trabajador (lower(oficio_principal));

CREATE INDEX IF NOT EXISTS idx_perfil_zona_id_zona
  ON perfil_zona (id_zona, id_perfil);

CREATE INDEX IF NOT EXISTS idx_resena_trabajador_calificacion
  ON resena (id_trabajador, calificacion);

CREATE INDEX IF NOT EXISTS idx_usuario_cuenta_activa
  ON usuario (id_usuario)
  WHERE estado = 'ACTIVO' AND modo_activo = true;

CREATE INDEX IF NOT EXISTS idx_zona_nombre_lower
  ON zona (lower(nombre));

CREATE INDEX IF NOT EXISTS idx_servicio_perfil_activo
  ON servicio_ofrecido (id_perfil)
  WHERE activo = true;

CREATE OR REPLACE FUNCTION buscar_perfiles_indexados(
  p_q text DEFAULT NULL,
  p_id_zona integer DEFAULT NULL,
  p_zona text DEFAULT NULL,
  p_disponibilidad text DEFAULT 'Disponible',
  p_precio_min numeric DEFAULT NULL,
  p_precio_max numeric DEFAULT NULL,
  p_reputacion_min numeric DEFAULT NULL,
  p_verificado boolean DEFAULT NULL,
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0,
  p_orden text DEFAULT 'relevancia'
)
RETURNS TABLE (
  id_perfil integer,
  id_usuario integer,
  nombre varchar,
  oficio_principal varchar,
  descripcion text,
  experiencia varchar,
  disponibilidad varchar,
  verificado boolean,
  contacto_visible boolean,
  tarifa_desde numeric,
  tarifa_hasta numeric,
  tarifa_tipo varchar,
  reputacion numeric,
  total_resenas integer,
  rank real,
  zonas jsonb,
  total bigint
)
LANGUAGE sql
STABLE
AS $$
  WITH params AS (
    SELECT
      NULLIF(btrim(coalesce(p_q, '')), '') AS q,
      CASE
        WHEN NULLIF(btrim(coalesce(p_q, '')), '') IS NULL THEN NULL
        ELSE websearch_to_tsquery('simple', btrim(p_q))
      END AS tsq,
      p_id_zona AS id_zona,
      NULLIF(btrim(coalesce(p_zona, '')), '') AS zona,
      CASE
        WHEN p_disponibilidad IS NULL OR btrim(p_disponibilidad) = '' OR lower(p_disponibilidad) = 'todos'
          THEN NULL
        ELSE p_disponibilidad
      END AS disponibilidad,
      p_precio_min AS precio_min,
      p_precio_max AS precio_max,
      p_reputacion_min AS reputacion_min,
      p_verificado AS verificado,
      greatest(1, least(coalesce(p_limit, 20), 50)) AS lim,
      greatest(0, coalesce(p_offset, 0)) AS off,
      lower(coalesce(NULLIF(btrim(p_orden), ''), 'relevancia')) AS orden
  ),
  reputacion AS (
    SELECT
      r.id_trabajador,
      round(avg(r.calificacion)::numeric, 2) AS reputacion,
      count(*)::integer AS total_resenas
    FROM resena r
    GROUP BY r.id_trabajador
  ),
  cobertura AS (
    SELECT
      pz.id_perfil,
      jsonb_agg(
        jsonb_build_object('id_zona', z.id_zona, 'nombre', z.nombre, 'tipo', z.tipo)
        ORDER BY z.nombre
      ) AS zonas
    FROM perfil_zona pz
    JOIN zona z ON z.id_zona = pz.id_zona
    WHERE z.estado = 'ACTIVA'
    GROUP BY pz.id_perfil
  ),
  filtrados AS (
    SELECT
      p.id_perfil,
      p.id_usuario,
      u.nombre,
      p.oficio_principal,
      oficiosya_perfil_bio(p.descripcion) AS descripcion,
      p.experiencia,
      CASE WHEN p.disponibilidad = 'Ocupado' THEN 'Ocupado' ELSE 'Disponible' END AS disponibilidad,
      p.verificado,
      p.contacto_visible,
      p.tarifa_desde,
      p.tarifa_hasta,
      p.tarifa_tipo,
      coalesce(rep.reputacion, 0) AS reputacion,
      coalesce(rep.total_resenas, 0) AS total_resenas,
      CASE
        WHEN prm.tsq IS NULL THEN 0::real
        ELSE ts_rank(p.busqueda_tsv, prm.tsq)
      END AS rank,
      coalesce(cob.zonas, '[]'::jsonb) AS zonas
    FROM perfil_trabajador p
    JOIN usuario u
      ON u.id_usuario = p.id_usuario
     AND u.estado = 'ACTIVO'
     AND u.modo_activo = true
    CROSS JOIN params prm
    LEFT JOIN reputacion rep ON rep.id_trabajador = p.id_perfil
    LEFT JOIN cobertura cob ON cob.id_perfil = p.id_perfil
    WHERE
      (
        prm.disponibilidad IS NULL
        OR CASE WHEN p.disponibilidad = 'Ocupado' THEN 'Ocupado' ELSE 'Disponible' END = prm.disponibilidad
      )
      AND (prm.verificado IS NULL OR p.verificado = prm.verificado)
      AND (prm.precio_min IS NULL OR coalesce(p.tarifa_hasta, p.tarifa_desde) >= prm.precio_min)
      AND (prm.precio_max IS NULL OR coalesce(p.tarifa_desde, p.tarifa_hasta) <= prm.precio_max)
      AND (prm.reputacion_min IS NULL OR coalesce(rep.reputacion, 0) >= prm.reputacion_min)
      AND (
        prm.tsq IS NULL
        OR p.busqueda_tsv @@ prm.tsq
        OR lower(p.oficio_principal) LIKE '%' || lower(prm.q) || '%'
        OR EXISTS (
          SELECT 1
          FROM servicio_ofrecido s
          WHERE s.id_perfil = p.id_perfil
            AND s.activo = true
            AND lower(s.nombre) LIKE '%' || lower(prm.q) || '%'
        )
      )
      AND (
        prm.id_zona IS NULL AND prm.zona IS NULL
        OR EXISTS (
          SELECT 1
          FROM perfil_zona pz
          JOIN zona z ON z.id_zona = pz.id_zona AND z.estado = 'ACTIVA'
          WHERE pz.id_perfil = p.id_perfil
            AND (
              (prm.id_zona IS NOT NULL AND pz.id_zona = prm.id_zona)
              OR (prm.zona IS NOT NULL AND lower(z.nombre) = lower(prm.zona))
            )
        )
      )
  )
  SELECT
    f.*,
    count(*) OVER() AS total
  FROM filtrados f
  CROSS JOIN params prm
  ORDER BY
    CASE WHEN prm.orden = 'reputacion' THEN f.reputacion END DESC NULLS LAST,
    CASE WHEN prm.orden = 'precio_asc' THEN f.tarifa_desde END ASC NULLS LAST,
    CASE WHEN prm.orden = 'precio_desc' THEN f.tarifa_desde END DESC NULLS LAST,
    CASE WHEN prm.orden IN ('relevancia', 'relevancia') THEN (f.rank + (f.reputacion / 5.0) + CASE WHEN f.verificado THEN 0.2 ELSE 0 END) END DESC,
    f.verificado DESC,
    f.reputacion DESC,
    f.id_perfil DESC
  LIMIT (SELECT lim FROM params)
  OFFSET (SELECT off FROM params);
$$;

GRANT EXECUTE ON FUNCTION buscar_perfiles_indexados(
  text, integer, text, text, numeric, numeric, numeric, boolean, integer, integer, text
) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
