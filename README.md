# OficiosYa

Aplicación para conectar clientes con profesionales de oficios. Incluye búsqueda por categoría y zona, solicitudes, reseñas, chat, portafolio, verificación DPI y administración.

## Organización

| Carpeta | Contenido |
| --- | --- |
| `frontend/` | React + Vite: interfaces de cliente, trabajador y administración. |
| `backend/` | API NestJS, autenticación y acceso a Supabase. |
| `docs/` | Decisiones y notas de integración entre ramas. |
| `frontend/tests/` | Pruebas de interfaz con Playwright. |
| `backend/tests/` | Pruebas de solicitudes con Node.js. |

Los documentos propios de cada módulo permanecen en `frontend/docs/` y `backend/docs/`. Las migraciones SQL están junto a su módulo en `backend/src/*/sql/`.

## Preparación

Requiere Node.js 22.20 o superior y npm. Desde la raíz:

```sh
npm run setup
```

Copia `backend/.env.example` a `backend/.env` y completa las credenciales de Supabase. La configuración opcional del cliente está en `frontend/.env.example`; sin `.env`, Vite usa el proxy `/api` hacia el backend local. No subas credenciales al repositorio.

Configura la base siguiendo [las instrucciones del backend](backend/README.md). Para las solicitudes, aplica en orden:

1. `backend/src/requests/sql/001_maquina_estados_solicitud.sql`
2. `backend/src/requests/sql/002_integracion_en_proceso.sql`

La segunda migración habilita la acción **Iniciar trabajo** y el estado **En Proceso**. No se ejecuta automáticamente al arrancar.

## Desarrollo

Abre dos terminales en la raíz:

```sh
npm run dev:backend
```

```sh
npm run dev:frontend
```

- Interfaz: http://localhost:5173
- API: http://localhost:3000/api
- Swagger: http://localhost:3000/api/docs

El selector del login cambia la interfaz y conserva el modo elegido para abrir el panel de cliente o trabajador al autenticar. Ambos modos usan la misma cuenta.

## Compilación y pruebas

```sh
npm run build
npm run test:backend
npm run test:frontend
```

Las pruebas del frontend necesitan un navegador de Playwright. Instálalo con `npx --prefix frontend playwright install chromium` o usa Chrome instalado con `PLAYWRIGHT_CHANNEL=chrome` (en PowerShell: `$env:PLAYWRIGHT_CHANNEL='chrome'`). Compila el frontend antes de ejecutarlas: usan Vite preview.

Para ver la compilación local:

```sh
npm run preview
```

Las pruebas de interfaz simulan la API. Las pruebas del backend validan lógica con datos simulados; la conexión real, el correo, Storage y las migraciones requieren un proyecto Supabase configurado.

## Documentación

- [Integración de login y frontend, decisiones y pendientes](docs/INTEGRACION.md)
- [Backend, API y base de datos](backend/README.md)
- [Frontend y rutas](frontend/README.md)
