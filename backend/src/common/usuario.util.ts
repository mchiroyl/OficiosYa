export type UsuarioRow = {
  id_usuario: number;
  nombre: string;
  correo: string;
  telefono: string | null;
  password_hash?: string;
  modo_activo: boolean;
  estado: string;
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
  if (!usuario.modo_activo) {
    return 'La cuenta está desactivada.';
  }
  if (usuario.estado === 'SUSPENDIDO') {
    return 'La cuenta está suspendida.';
  }
  if (usuario.estado === 'ELIMINADO') {
    return 'La cuenta fue eliminada.';
  }
  if (usuario.estado !== 'ACTIVO') {
    return 'La cuenta no está disponible.';
  }
  return null;
}
