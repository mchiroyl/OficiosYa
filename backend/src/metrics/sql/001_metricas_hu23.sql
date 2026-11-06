-- Métricas analíticas (HU-23)
-- Ejecutar en el SQL Editor de Supabase. Idempotente.
-- Indicadores: usuarios activos, oficios más solicitados y solicitudes cerradas con éxito.

CREATE INDEX IF NOT EXISTS idx_usuario_activos
  ON usuario (id_usuario)
  WHERE estado = 'ACTIVO' AND modo_activo = true;

CREATE INDEX IF NOT EXISTS idx_solicitud_estado
  ON solicitud_servicio (estado);

CREATE INDEX IF NOT EXISTS idx_solicitud_servicio
  ON solicitud_servicio (id_servicio);

CREATE INDEX IF NOT EXISTS idx_servicio_categoria
  ON servicio_ofrecido (id_categoria);

CREATE OR REPLACE FUNCTION metricas_plataforma(p_limit integer DEFAULT 6)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  WITH usuarios_activos AS (
    SELECT count(*)::integer AS total
    FROM usuario
    WHERE estado = 'ACTIVO'
      AND modo_activo = true
  ),
  oficios AS (
    SELECT
      c.id_categoria,
      c.nombre,
      count(ss.id_solicitud)::integer AS total
    FROM solicitud_servicio ss
    JOIN servicio_ofrecido so ON so.id_servicio = ss.id_servicio
    JOIN categoria c ON c.id_categoria = so.id_categoria
    GROUP BY c.id_categoria, c.nombre
    ORDER BY count(ss.id_solicitud) DESC, c.nombre ASC
    LIMIT greatest(1, least(coalesce(p_limit, 6), 20))
  ),
  solicitudes AS (
    SELECT
      count(*) FILTER (
        WHERE estado IN ('Finalizada', 'FINALIZADA', 'COMPLETADA')
      )::integer AS cerradas_exito,
      count(*)::integer AS total
    FROM solicitud_servicio
  )
  SELECT jsonb_build_object(
    'usuarios_activos', (SELECT total FROM usuarios_activos),
    'oficios_mas_solicitados', coalesce(
      (SELECT jsonb_agg(to_jsonb(o) ORDER BY o.total DESC, o.nombre ASC) FROM oficios o),
      '[]'::jsonb
    ),
    'solicitudes_cerradas_exito', (SELECT cerradas_exito FROM solicitudes),
    'solicitudes_total', (SELECT total FROM solicitudes)
  );
$$;

REVOKE ALL ON FUNCTION metricas_plataforma(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION metricas_plataforma(integer) TO service_role;

NOTIFY pgrst, 'reload schema';
