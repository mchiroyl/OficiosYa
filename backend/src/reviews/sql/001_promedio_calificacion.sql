-- Promedio automático de calificación del trabajador (HU-18)
-- Ejecutar en el SQL Editor de Supabase. Idempotente.

ALTER TABLE perfil_trabajador
  ADD COLUMN IF NOT EXISTS reputacion_promedio numeric(3,2) NOT NULL DEFAULT 0;

ALTER TABLE perfil_trabajador
  ADD COLUMN IF NOT EXISTS total_resenas integer NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS idx_resena_id_solicitud
  ON resena (id_solicitud);

CREATE OR REPLACE FUNCTION actualizar_promedio_trabajador()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  perfil_id integer;
  nuevo_promedio numeric(3,2);
  nuevo_total integer;
BEGIN
  perfil_id := COALESCE(NEW.id_trabajador, OLD.id_trabajador);

  SELECT
    COALESCE(round(avg(calificacion)::numeric, 2), 0),
    COUNT(*)::integer
  INTO nuevo_promedio, nuevo_total
  FROM resena
  WHERE id_trabajador = perfil_id;

  UPDATE perfil_trabajador
  SET
    reputacion_promedio = nuevo_promedio,
    total_resenas = nuevo_total
  WHERE id_perfil = perfil_id;

  IF TG_OP = 'UPDATE' AND OLD.id_trabajador IS DISTINCT FROM NEW.id_trabajador THEN
    SELECT
      COALESCE(round(avg(calificacion)::numeric, 2), 0),
      COUNT(*)::integer
    INTO nuevo_promedio, nuevo_total
    FROM resena
    WHERE id_trabajador = OLD.id_trabajador;

    UPDATE perfil_trabajador
    SET
      reputacion_promedio = nuevo_promedio,
      total_resenas = nuevo_total
    WHERE id_perfil = OLD.id_trabajador;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_actualizar_promedio_trabajador ON resena;

CREATE TRIGGER trg_actualizar_promedio_trabajador
AFTER INSERT OR UPDATE OF calificacion, id_trabajador OR DELETE
ON resena
FOR EACH ROW
EXECUTE FUNCTION actualizar_promedio_trabajador();

NOTIFY pgrst, 'reload schema';
