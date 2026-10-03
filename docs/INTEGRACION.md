# Integración de login y frontend

Rama de integración: `integracion-login-frontend`. Base: `login` (`243173c`).
Comparación con `frontend` (`5d7f732`), usando las referencias de la copia local.
Los cambios se integraron por funcionalidad: los contratos de las dos ramas no eran intercambiables.

## Resultado

| Función | Procedencia | Integración |
| --- | --- | --- |
| Búsqueda, filtros, paginación y envío de solicitudes | frontend | Conservados en `/buscar` y `/categoria/:id`; pruebas adaptadas al directorio actual. |
| Historial enriquecido con cliente, profesional, servicio y reseña | frontend | Recuperado mediante GET `/api/requests/client` y `/api/requests/worker`, filtrados por el usuario autenticado. |
| Filtros Activas / Finalizadas / Todas | frontend | Integrados en la bandeja del trabajador y en las solicitudes del cliente. |
| Iniciar trabajo | frontend | Integrado como acción `Iniciar` en PUT `/api/requests/:id/status`, con autorización de trabajador y control de concurrencia. |
| Calificaciones existentes y prevención de reseña duplicada en la interfaz | frontend | Integradas en ambos historiales; se conserva POST `/api/reviews/create` y el cálculo de promedio de login. |
| Rutas `/client/requests` y `/worker/requests` | frontend | Alias de los paneles actuales, sin duplicar pantallas ni APIs de escritura. |
| Identidad visual y navegación de regreso | frontend | Tokens, logotipo en autenticación, estilo del directorio y regreso al inicio en los paneles. |
| Categorías con directorio propio, modo cliente/trabajador y perfil público | login | Conservados. Las categorías dinámicas sustituyen a las categorías fijas de la pantalla anterior. |
| Recuperación de contraseña, chat, portafolio, DPI y moderación | login | Conservados. |
| Dashboard y administración de usuarios, categorías y zonas | login | Conservados; el enlace Admin abre el dashboard desde el cual se accede a todos los módulos. |

`Completada` y `COMPLETADA` se presentan como `Finalizada`; `En proceso`, `En Proceso` y `EN_PROCESO` como `En Proceso`. Este último ya no se confunde con `Aceptada`.
No se recuperan las APIs antiguas PATCH de estados o reseñas duplicadas: las pantallas usan los contratos de login.
La etiqueta fija “Recomendado para ti” sobre el primer resultado no se trasladó porque no estaba respaldada por una recomendación personalizada.

## Base de datos y ejecución

1. Configurar `backend/.env` siguiendo `backend/.env.example` con las credenciales del proyecto Supabase.
2. En Supabase ejecutar `backend/src/requests/sql/001_maquina_estados_solicitud.sql` si aún no se aplicó y luego `002_integracion_en_proceso.sql`. La segunda migración actualiza el CHECK, trigger y RPC para permitir iniciar, finalizar y cancelar trabajos en curso; conserva los permisos service_role del RPC.
3. Mantener las migraciones de búsqueda y reseñas indicadas en `backend/README.md`.
4. Arrancar el backend con `npm run dev` desde `backend`.
5. Frontend: `npm run build -- --configLoader native`, seguido de `npm run preview -- --host 127.0.0.1 --port 5173 --configLoader native` desde `frontend`.

La migración está preparada, pero no se ejecutó contra una base real. Con la versión anterior del RPC, la nueva acción Iniciar requiere aplicar 002.

## Validación

- Backend y frontend compilan.
- `node --test tests/requests-integration.test.cjs` desde backend: normalización de estados, transiciones, autorización, historiales por propietario y detección de cambios simultáneos.
- Pruebas Playwright con Chrome: búsqueda, validación, envío de solicitudes, teclado y diseño móvil; integración de historiales, reseñas, rutas antiguas y navegación por categorías/administración.
- Las pruebas de interfaz usan respuestas simuladas; no verifican Supabase, correo ni WebSockets reales.

## Hallazgos previos fuera de esta integración

- El CRUD genérico de recursos aún necesita una revisión de permisos: autenticación por sí sola no limita todas las operaciones al propietario o administrador.
- El campo de motivo de rechazo de login se conserva, pero su API original no persiste ese texto. Requiere un contrato de almacenamiento específico.
- Queda la advertencia de Vite sobre el tamaño del paquete JavaScript principal.

Las migraciones no se han aplicado a una base remota.

## Login por modo

El selector cambia la presentación, los mensajes y el botón del login. Conserva los campos ingresados y abre el panel correspondiente después de autenticar. La selección persiste al recargar y al ir al registro. Tres pruebas de Playwright cubren esos recorridos y el diseño móvil.
