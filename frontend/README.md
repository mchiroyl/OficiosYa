# OficiosYa — Frontend

React + Vite.

```bash
npm install
npm run dev
```

Abre http://localhost:5173. El backend debe estar en http://localhost:3000.

También puedes usar `start.bat`.

## Búsqueda y solicitudes (HU-10, HU-11, HU-13)

Después de iniciar sesión, `/` muestra el buscador y los filtros. La interfaz usa
`GET /api/search/profiles` y el catálogo `GET /api/zonas?estado=ACTIVA`.
El formulario de cada resultado carga `GET /api/servicios?id_perfil=ID&activo=true`
y envía `POST /api/requests/create` con el token de la sesión. No usa los perfiles
de ejemplo de `src/data/workers.js` ni muestra confirmaciones simuladas.

Se requiere un trabajador activo con al menos un servicio activo asociado. Si el
catálogo está vacío, el formulario informa esa condición y bloquea el envío.
La descripción debe tener entre 10 y 4000 caracteres. La fecha opcional debe ser
futura; se convierte de la hora local del dispositivo a ISO con zona horaria.
Un error de red o de servidor al enviar se considera una confirmación incierta:
no se reenvía automáticamente porque la API no ofrece claves de idempotencia.

El backend se configura con su propio `.env`; nunca copies la clave secreta de
Supabase al frontend. `VITE_API_URL` permite indicar otra URL pública de la API.
Para cambiar solo el destino del proxy local, establece `API_PROXY_TARGET`, por
ejemplo `http://localhost:3001`, antes de arrancar Vite.

## Validación automatizada

```bash
npm ci
npm run build
npx playwright install chromium
npm run test:e2e
```

Las pruebas usan la compilación `dist` y respuestas de API controladas; no crean
usuarios ni solicitudes en Supabase. Cubren filtros combinados, paginación,
respuestas fuera de orden, validaciones, errores, autenticación del envío,
prevención de doble envío, teclado y presentación móvil.

Si tienes Chrome instalado, puedes establecer `PLAYWRIGHT_CHANNEL=chrome`.
En PowerShell: `$env:PLAYWRIGHT_CHANNEL='chrome'`.
En entornos Windows restringidos donde el empaquetador no puede leer directorios
superiores, compila con `npm run build -- --configLoader native` (Node 22.12+).
La configuración de pruebas ya utiliza ese cargador para la vista previa.
Si ejecutas tu propia vista previa en el puerto 5173, establece
`PLAYWRIGHT_EXTERNAL_SERVER=1` para que Playwright no administre ese proceso.

Manual de entrega: `../05_Entregables_Finales_y_Despliegue/01_Manual_de_Usuario_Cliente_y_Trabajador.pdf`.
