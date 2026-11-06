-- Rol ADMINISTRADOR separado de CLIENTE y TRABAJADOR.
-- Aprobación de cuentas nuevas y sugerencias de oficios.

ALTER TABLE usuario ADD COLUMN IF NOT EXISTS rol varchar(30);

UPDATE usuario
SET rol = 'TRABAJADOR'
WHERE (rol IS NULL OR rol = '' OR rol = 'CLIENTE')
  AND EXISTS (
    SELECT 1 FROM perfil_trabajador p WHERE p.id_usuario = usuario.id_usuario
  );

UPDATE usuario
SET rol = 'CLIENTE'
WHERE rol IS NULL OR rol = '';

ALTER TABLE usuario ALTER COLUMN rol SET DEFAULT 'CLIENTE';
ALTER TABLE usuario ALTER COLUMN rol SET NOT NULL;

ALTER TABLE usuario DROP CONSTRAINT IF EXISTS chk_usuario_rol;
ALTER TABLE usuario ADD CONSTRAINT chk_usuario_rol
  CHECK (rol IN ('CLIENTE', 'TRABAJADOR', 'ADMINISTRADOR'));

ALTER TABLE usuario DROP CONSTRAINT IF EXISTS chk_usuario_estado;
ALTER TABLE usuario ADD CONSTRAINT chk_usuario_estado
  CHECK (estado IN ('ACTIVO', 'INACTIVO', 'SUSPENDIDO', 'ELIMINADO', 'PENDIENTE'));

CREATE TABLE IF NOT EXISTS sugerencia_oficio (
  id_sugerencia integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_usuario integer NOT NULL REFERENCES usuario (id_usuario),
  nombre varchar(100) NOT NULL,
  descripcion text,
  estado varchar(30) NOT NULL DEFAULT 'PENDIENTE',
  fecha_creacion timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_sugerencia_oficio_estado CHECK (estado IN ('PENDIENTE', 'APROBADA', 'RECHAZADA'))
);

CREATE INDEX IF NOT EXISTS idx_sugerencia_oficio_estado ON sugerencia_oficio (estado);
CREATE INDEX IF NOT EXISTS idx_sugerencia_oficio_usuario ON sugerencia_oficio (id_usuario);
