# OficiosYa · Frontend

SPA React + Vite para cliente, trabajador y administrador.

## Requisitos

- Node.js 20+
- Backend OficiosYa corriendo en `http://localhost:3000`

## Ejecutar

```powershell
cd frontend
npm install
copy .env.example .env
npm run dev
```

Abre: http://localhost:5173

O doble clic en `start.bat`.

## Admin

El menú Admin aparece si el backend marca `es_admin` o si el correo está en `VITE_ADMIN_EMAILS` (por defecto `admin@oficiosya.gt`).

## Rutas principales

| Ruta | Rol |
|------|-----|
| `/` | Menú cliente o panel trabajador (según toggle) |
| `/categoria/:id` | Directorio de una categoría |
| `/buscar` | Directorio con filtros |
| `/workers/:id` | Perfil público del trabajador |
| `/mis-solicitudes` | Dashboard cliente |
| `/chat` | Bandeja de chat |
| `/chat/:id` | Hilo de chat (texto + imágenes, WebSocket/polling) |
| `/trabajador/bandeja` | Inbox trabajador |
| `/worker/profile` | Oferta / DPI / portafolio |
| `/admin` | Métricas Chart.js |
| `/admin/usuarios` | Ban / reactivar |
| `/admin/categorias` | CRUD categorías |
| `/admin/zonas` | CRUD zonas El Asintal |
| `/admin/dpi` | Auditoría DPI |
| `/admin/reportes` o `/admin/reports` | Moderación |
