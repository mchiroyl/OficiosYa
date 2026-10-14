-- Respuesta pública única del trabajador (HU-19)
-- Ejecutar en el SQL Editor de Supabase. Idempotente.

ALTER TABLE resena
  ADD COLUMN IF NOT EXISTS respuesta text;

CREATE OR REPLACE FUNCTION fn_respuesta_unica_resena()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.respuesta IS NOT NULL AND btrim(OLD.respuesta) <> ''
     AND NEW.respuesta IS DISTINCT FROM OLD.respuesta THEN
    RAISE EXCEPTION 'REPLY_ONCE: Esta reseña ya tiene una respuesta pública.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_respuesta_unica_resena ON resena;

CREATE TRIGGER trg_respuesta_unica_resena
  BEFORE UPDATE OF respuesta
  ON resena
  FOR EACH ROW
  EXECUTE FUNCTION fn_respuesta_unica_resena();

NOTIFY pgrst, 'reload schema';
