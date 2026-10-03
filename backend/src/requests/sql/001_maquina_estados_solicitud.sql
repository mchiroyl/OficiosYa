-- Máquina de estados transaccional de solicitudes (HU-14, HU-15)
-- Ejecutar en el SQL Editor de Supabase. Idempotente.
-- Acepta los nombres de las HU y los del CHECK original del schema.

CREATE OR REPLACE FUNCTION fn_norm_estado_solicitud(p_estado text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_estado IS NULL OR upper(p_estado) IN ('PENDIENTE', 'ENVIADA') THEN 'Enviada'
    WHEN upper(p_estado) IN ('ACEPTADA', 'EN_PROCESO') THEN 'Aceptada'
    WHEN upper(p_estado) = 'RECHAZADA' THEN 'Rechazada'
    WHEN upper(p_estado) = 'CANCELADA' THEN 'Cancelada'
    WHEN upper(p_estado) IN ('FINALIZADA', 'COMPLETADA') THEN 'Finalizada'
    ELSE p_estado
  END;
$$;

ALTER TABLE solicitud_servicio DROP CONSTRAINT IF EXISTS chk_solicitud_estado;
ALTER TABLE solicitud_servicio
  ADD CONSTRAINT chk_solicitud_estado
  CHECK (
    estado IN (
      'Enviada',
      'PENDIENTE',
      'Aceptada',
      'ACEPTADA',
      'EN_PROCESO',
      'Rechazada',
      'RECHAZADA',
      'Cancelada',
      'CANCELADA',
      'Finalizada',
      'FINALIZADA',
      'COMPLETADA'
    )
  );

CREATE OR REPLACE FUNCTION fn_validar_estado_solicitud()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  desde text;
  hacia text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF fn_norm_estado_solicitud(NEW.estado) = 'Enviada' THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'INVALID_TRANSITION: El estado inicial debe ser Enviada'
      USING ERRCODE = '22023';
  END IF;

  desde := fn_norm_estado_solicitud(OLD.estado);
  hacia := fn_norm_estado_solicitud(NEW.estado);

  IF desde = hacia THEN
    RETURN NEW;
  END IF;

  IF (desde = 'Enviada' AND hacia IN ('Aceptada', 'Rechazada', 'Cancelada'))
     OR (desde = 'Aceptada' AND hacia IN ('Finalizada', 'Cancelada')) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'INVALID_TRANSITION: No se puede pasar de % a %', desde, hacia
    USING ERRCODE = '22023';
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_estado_solicitud ON solicitud_servicio;
CREATE TRIGGER trg_validar_estado_solicitud
  BEFORE INSERT OR UPDATE OF estado
  ON solicitud_servicio
  FOR EACH ROW
  EXECUTE FUNCTION fn_validar_estado_solicitud();

CREATE OR REPLACE FUNCTION cambiar_estado_solicitud(
  p_id_solicitud integer,
  p_id_actor integer,
  p_accion text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sol solicitud_servicio%ROWTYPE;
  id_usuario_trabajador integer;
  estado_actual text;
  estado_siguiente text;
  rol_requerido text;
  es_cliente boolean;
  es_trabajador boolean;
BEGIN
  IF p_accion NOT IN ('Aceptar', 'Rechazar', 'Cancelar', 'Finalizar') THEN
    RAISE EXCEPTION 'INVALID_ACTION' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO sol
  FROM solicitud_servicio
  WHERE id_solicitud = p_id_solicitud
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  SELECT pt.id_usuario INTO id_usuario_trabajador
  FROM perfil_trabajador pt
  WHERE pt.id_perfil = sol.id_trabajador;

  es_cliente := sol.id_cliente = p_id_actor;
  es_trabajador := id_usuario_trabajador = p_id_actor;

  IF NOT es_cliente AND NOT es_trabajador THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  estado_actual := fn_norm_estado_solicitud(sol.estado);

  IF estado_actual = 'Enviada' AND p_accion = 'Aceptar' THEN
    estado_siguiente := 'ACEPTADA';
    rol_requerido := 'trabajador';
  ELSIF estado_actual = 'Enviada' AND p_accion = 'Rechazar' THEN
    estado_siguiente := 'Rechazada';
    rol_requerido := 'trabajador';
  ELSIF estado_actual = 'Enviada' AND p_accion = 'Cancelar' THEN
    estado_siguiente := 'CANCELADA';
    rol_requerido := 'cliente';
  ELSIF estado_actual = 'Aceptada' AND p_accion = 'Finalizar' THEN
    estado_siguiente := 'COMPLETADA';
    rol_requerido := 'ambos';
  ELSIF estado_actual = 'Aceptada' AND p_accion = 'Cancelar' THEN
    estado_siguiente := 'CANCELADA';
    rol_requerido := 'cliente';
  ELSE
    RAISE EXCEPTION 'INVALID_TRANSITION: No se puede % una solicitud en estado %', p_accion, estado_actual
      USING ERRCODE = '22023';
  END IF;

  IF rol_requerido = 'cliente' AND NOT es_cliente THEN
    RAISE EXCEPTION 'FORBIDDEN_ROLE' USING ERRCODE = '42501';
  END IF;
  IF rol_requerido = 'trabajador' AND NOT es_trabajador THEN
    RAISE EXCEPTION 'FORBIDDEN_ROLE' USING ERRCODE = '42501';
  END IF;

  UPDATE solicitud_servicio
  SET estado = estado_siguiente
  WHERE id_solicitud = p_id_solicitud
    AND estado = sol.estado
  RETURNING * INTO sol;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CONFLICT' USING ERRCODE = '40001';
  END IF;

  BEGIN
    INSERT INTO bitacora (id_actor, accion, recurso, origen)
    VALUES (
      p_id_actor,
      'STATUS_' || upper(p_accion),
      'solicitud_servicio',
      'rpc/cambiar_estado_solicitud'
    );
  EXCEPTION WHEN OTHERS THEN
    BEGIN
      INSERT INTO bitacora (id_evento, id_actor, accion, recurso, origen)
      VALUES (
        COALESCE((SELECT MAX(id_evento) FROM bitacora), 0) + 1,
        p_id_actor,
        'STATUS_' || upper(p_accion),
        'solicitud_servicio',
        'rpc/cambiar_estado_solicitud'
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END;

  RETURN jsonb_build_object(
    'id_solicitud', sol.id_solicitud,
    'id_cliente', sol.id_cliente,
    'id_trabajador', sol.id_trabajador,
    'id_servicio', sol.id_servicio,
    'descripcion', sol.descripcion,
    'ubicacion_aprox', sol.ubicacion_aprox,
    'fecha_deseada', sol.fecha_deseada,
    'estado', fn_norm_estado_solicitud(sol.estado),
    'urgente', sol.urgente
  );
END;
$$;

REVOKE ALL ON FUNCTION cambiar_estado_solicitud(integer, integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION cambiar_estado_solicitud(integer, integer, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION cambiar_estado_solicitud(integer, integer, text) TO service_role;

NOTIFY pgrst, 'reload schema';
