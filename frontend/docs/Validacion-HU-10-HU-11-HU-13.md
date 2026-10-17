# Entrega frontend: HU-10, HU-11 y HU-13

Fecha: 14 de septiembre de 2026.
Base: rama `login`, commit `7af0b2d`.
Rama de implementación: `codex/hu-10-11-13`.

## Cambios entregados

- HU-10: buscador general en la página principal, consulta real a
  `/api/search/profiles`, estados de carga/error/sin resultados, reintento y
  paginación de 12 perfiles. Las búsquedas anteriores se cancelan al emitir otra.
- HU-11: filtros combinables por zona activa, disponibilidad, precio, calificación
  y verificación; orden por relevancia, reputación y precio; limpieza y validación
  de rangos. Desmarcar verificación elimina el filtro; no envía `verificado=false`.
- HU-13: modal asociado al perfil seleccionado, catálogo de servicios activos,
  descripción, ubicación, fecha local convertida a ISO y urgencia. Envía el token
  de la sesión. Solo confirma al recibir identificador y estado de la API.
- Protección contra doble envío durante la petición, bloqueo del perfil propio,
  validación de servicio/perfil, conservación de datos ante rechazo y tratamiento
  explícito de respuestas inciertas sin reenvío automático.
- Ventana accesible con título, mensajes anunciados, recorrido de teclado,
  cierre con Escape y restauración del foco. Presentación de escritorio y móvil.
- Manual PDF en la ruta solicitada por Jira. No existía un manual previo en la
  rama de base; se creó una edición enfocada en este flujo, con orientación del
  módulo de tarifas/cobertura ya existente y capturas con datos ficticios.

## Verificación ejecutada

| Comprobación | Resultado |
| --- | --- |
| Compilación frontend, Vite con `--configLoader native` | Correcta |
| Compilación backend existente, `npm run build` | Correcta |
| Suite Playwright en Chrome, compilación de producción | 8 pruebas aprobadas |
| Búsqueda combinada, limpieza, orden y paginación | Aprobada con API controlada |
| Búsqueda anterior lenta frente a búsqueda nueva | Aprobada con API controlada |
| Descripción, fecha, token, IDs y confirmación del POST | Aprobada con API controlada |
| Errores 400/401, fallos de red, catálogos vacíos y reintentos | Aprobada con API controlada |
| Escape, foco del modal y ancho móvil de 390 px | Aprobada |
| Lectura real de zonas activas | HTTP 200 |
| Lectura real de búsqueda de perfiles | HTTP 200; un perfil, motor de respaldo `consultas-indexadas` |
| Búsqueda real por el oficio de un perfil existente | HTTP 200; perfil encontrado |
| Rango invertido en la API real | HTTP 400 |
| Lectura real de servicios activos | HTTP 200; catálogo vacío al verificar |
| Creación sin token en la API real | HTTP 401; acceso rechazado |

Las comprobaciones reales se hicieron con el backend local en el puerto 3001,
conectado al Supabase del equipo. La configuración local está en `backend/.env`,
excluido de Git. La clave secreta no se incorpora al frontend ni a este informe.

## Pendientes para la aceptación del equipo

1. Registrar un servicio activo asociado a un trabajador habilitado y usar una
   cuenta cliente distinta para comprobar un envío autenticado en el ambiente
   del equipo. No se insertaron datos de prueba en la base compartida.
2. La función SQL indexada aún no estaba aplicada: el backend utilizó su mecanismo
   de respaldo existente. El equipo puede aplicar la migración documentada en
   `backend/README.md` si requiere el motor SQL; esta entrega no modifica el esquema.
3. Contrastar la entrega con los criterios completos de Jira: solo se recibió el
   resumen de la tarea y su ruta de entrega, además de los contratos en el repositorio.

Las rutas de perfil público `/workers/:id` pertenecen al prototipo previo y usan
datos locales. El nuevo buscador y su formulario usan registros de API y no
dependen de esas rutas. El backend de envío no ofrece idempotencia ni se añadió
una bandeja de seguimiento, aceptación de solicitudes, chat o pagos.

## Cómo reproducir

Consulta `frontend/README.md`. Compila antes de ejecutar `npm run test:e2e`.
Los ocho escenarios están en `frontend/tests/search-requests.spec.js` y no escriben
en Supabase. Para una revisión manual real, inicia sesión en el frontend, busca
un oficio y abre el formulario de un resultado.
