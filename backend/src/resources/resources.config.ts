export type ResourceConfig = {
  path: string;
  table: string;
  pk: string | string[];
  publicRead?: boolean;
  hiddenFields?: string[];
  denyMutations?: boolean;
};

export const RESOURCES: ResourceConfig[] = [
  {
    path: 'usuarios',
    table: 'usuario',
    pk: 'id_usuario',
    hiddenFields: ['password_hash'],
  },
  { path: 'zonas', table: 'zona', pk: 'id_zona', publicRead: true },
  { path: 'perfiles-trabajador', table: 'perfil_trabajador', pk: 'id_perfil' },
  { path: 'perfiles-zona', table: 'perfil_zona', pk: ['id_perfil', 'id_zona'] },
  { path: 'portafolio', table: 'portafolio', pk: 'id_elemento' },
  { path: 'reportes', table: 'reporte', pk: 'id_reporte' },
  { path: 'bitacora', table: 'bitacora', pk: 'id_evento' },
  { path: 'categorias', table: 'categoria', pk: 'id_categoria', publicRead: true },
  { path: 'servicios', table: 'servicio_ofrecido', pk: 'id_servicio', publicRead: true },
  { path: 'solicitudes', table: 'solicitud_servicio', pk: 'id_solicitud', denyMutations: true },
  { path: 'cotizaciones', table: 'cotizacion_privada', pk: 'id_cotizacion' },
  { path: 'mensajes', table: 'mensaje', pk: 'id_mensaje' },
  { path: 'resenas', table: 'resena', pk: 'id_resena', publicRead: true, denyMutations: true },
];
