export type UsuarioRow = {
  id_usuario: number;
  nombre: string;
  correo: string;
  telefono: string | null;
  password_hash?: string;
  modo_activo: boolean;
  estado: string;
  rol?: string | null;
};

export type PerfilTrabajadorRow = {
  id_perfil: number;
  id_usuario: number;
  oficio_principal: string;
};

export function publicUsuario(usuario: UsuarioRow) {
  const { password_hash: _omit, ...safe } = usuario;
  return safe;
}

export function assertCuentaOperable(usuario: UsuarioRow) {
  if (usuario.estado === 'PENDIENTE') {
    return 'Tu cuenta está pendiente de aprobación por un administrador.';
  }
  if (!usuario.modo_activo) {
    return 'La cuenta está desactivada.';
  }
  if (usuario.estado === 'SUSPENDIDO') {
    return 'La cuenta está suspendida.';
  }
  if (usuario.estado === 'ELIMINADO') {
    return 'La cuenta fue eliminada.';
  }
  if (usuario.estado === 'INACTIVO') {
    return 'Tu cuenta está pendiente de aprobación o no está activa.';
  }
  if (usuario.estado !== 'ACTIVO') {
    return 'La cuenta no está disponible.';
  }
  return null;
}
