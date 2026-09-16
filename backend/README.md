# OficiosYa — Backend

NestJS + Supabase (PostgreSQL).

1. Copia `.env.example` a `.env` y completa las variables.
2. Arranca:

```bash
npm install
npm run dev
```

- API: http://localhost:3000/api
- Swagger: http://localhost:3000/api/docs

Índices de búsqueda (HU-10/HU-11): ejecuta `src/search/sql/001_motor_busqueda_indexada.sql` en el SQL Editor de Supabase para activar el motor SQL (`GET /api/search/profiles`). Sin eso, el endpoint usa un respaldo con las mismas variables.

Reseñas (HU-18): ejecuta `src/reviews/sql/001_promedio_calificacion.sql` para el trigger que actualiza `reputacion_promedio`. El endpoint `POST /api/reviews/create` también recalcula el promedio si el trigger aún no está.
