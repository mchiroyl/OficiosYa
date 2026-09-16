-- Máquina de estados transaccional de solicitudes (HU-14, HU-15)
-- Ejecutar en el SQL Editor de Supabase. Idempotente.

CREATE OR REPLACE FUNCTION cambiar_estado_solicitud(
  p_id_solicitud integer,
  p_id_actor integer,
  p_accion text
)
RETURNS jsonb
LANGUAGE plpgsql
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

  estado_actual := CASE
    WHEN sol.estado IS NULL OR sol.estado = 'PENDIENTE' THEN 'Enviada'
    ELSE sol.estado
  END;

  IF estado_actual = 'Enviada' AND p_accion = 'Aceptar' THEN
    estado_siguiente := 'Aceptada';
    rol_requerido := 'trabajador';
  ELSIF estado_actual = 'Enviada' AND p_accion = 'Rechazar' THEN
    estado_siguiente := 'Rechazada';
    rol_requerido := 'trabajador';
  ELSIF estado_actual = 'Enviada' AND p_accion = 'Cancelar' THEN
    estado_siguiente := 'Cancelada';
    rol_requerido := 'cliente';
  ELSIF estado_actual = 'Aceptada' AND p_accion = 'Finalizar' THEN
    estado_siguiente := 'Finalizada';
    rol_requerido := 'ambos';
  ELSIF estado_actual = 'Aceptada' AND p_accion = 'Cancelar' THEN
    estado_siguiente := 'Cancelada';
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

  RETURN jsonb_build_object(
    'id_solicitud', sol.id_solicitud,
    'id_cliente', sol.id_cliente,
    'id_trabajador', sol.id_trabajador,
    'id_servicio', sol.id_servicio,
    'descripcion', sol.descripcion,
    'ubicacion_aprox', sol.ubicacion_aprox,
    'fecha_deseada', sol.fecha_deseada,
    'estado', sol.estado,
    'urgente', sol.urgente
  );
END;
$$;

GRANT EXECUTE ON FUNCTION cambiar_estado_solicitud(integer, integer, text)
  TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
