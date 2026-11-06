export type ResourceOwner = {
  /** Columna en esta tabla que identifica al dueño. */
  field: 'id_usuario' | 'id_perfil';
  /** user: el valor es id_usuario. profile: el valor es id_perfil del trabajador. */
  via: 'user' | 'profile';
};

export type ResourceConfig = {
  path: string;
  table: string;
  pk: string | string[];
  publicRead?: boolean;
  hiddenFields?: string[];
  /** Campos que no se pueden escribir por el CRUD genérico. */
  protectedFields?: string[];
  denyMutations?: boolean;
  denyCreate?: boolean;
  owner?: ResourceOwner;
  /** Filtro obligatorio para lecturas anónimas (evita listar todo el catálogo). */
  anonFilter?: string;
};

export const RESOURCES: ResourceConfig[] = [
  {
    path: 'usuarios',
    table: 'usuario',
    pk: 'id_usuario',
    hiddenFields: ['password_hash'],
    protectedFields: ['password_hash', 'estado', 'modo_activo', 'rol'],
    denyCreate: true,
    owner: { field: 'id_usuario', via: 'user' },
  },
  { path: 'zonas', table: 'zona', pk: 'id_zona', publicRead: true },
  {
    path: 'perfiles-trabajador',
    table: 'perfil_trabajador',
    pk: 'id_perfil',
    publicRead: true,
    owner: { field: 'id_usuario', via: 'user' },
  },
  {
    path: 'perfiles-zona',
    table: 'perfil_zona',
    pk: ['id_perfil', 'id_zona'],
    owner: { field: 'id_perfil', via: 'profile' },
  },
  {
    path: 'portafolio',
    table: 'portafolio',
    pk: 'id_elemento',
    publicRead: true,
    anonFilter: 'id_perfil',
    owner: { field: 'id_perfil', via: 'profile' },
    denyMutations: true,
  },
  { path: 'reportes', table: 'reporte', pk: 'id_reporte', denyMutations: true },
  { path: 'bitacora', table: 'bitacora', pk: 'id_evento', denyMutations: true },
  { path: 'categorias', table: 'categoria', pk: 'id_categoria', publicRead: true },
  {
    path: 'servicios',
    table: 'servicio_ofrecido',
    pk: 'id_servicio',
    publicRead: true,
    owner: { field: 'id_perfil', via: 'profile' },
  },
  { path: 'solicitudes', table: 'solicitud_servicio', pk: 'id_solicitud', denyMutations: true },
  { path: 'cotizaciones', table: 'cotizacion_privada', pk: 'id_cotizacion', denyMutations: true },
  { path: 'mensajes', table: 'mensaje', pk: 'id_mensaje', denyMutations: true },
  { path: 'resenas', table: 'resena', pk: 'id_resena', publicRead: true, denyMutations: true },
];
