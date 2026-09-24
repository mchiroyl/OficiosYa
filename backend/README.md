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
- Modelo de datos: [docs/05_Modelo_Datos_Inicial.md](docs/05_Modelo_Datos_Inicial.md)
- ERD conceptual y físico: [docs/01_Diagrama_Entidad_Relacion_ERD_Conceptual_y_Fisico.png](docs/01_Diagrama_Entidad_Relacion_ERD_Conceptual_y_Fisico.png) / [PDF](docs/01_Diagrama_Entidad_Relacion_ERD_Conceptual_y_Fisico.pdf)

Índices de búsqueda (HU-10/HU-11): ejecuta `src/search/sql/001_motor_busqueda_indexada.sql` en el SQL Editor de Supabase para activar el motor SQL (`GET /api/search/profiles`). Sin eso, el endpoint usa un respaldo con las mismas variables.

Reseñas (HU-18): `POST /api/reviews/create` solo acepta al cliente de una solicitud Finalizada, una reseña por solicitud, y recalcula el promedio del trabajador. Ejecuta `src/reviews/sql/001_promedio_calificacion.sql` para las columnas `reputacion_promedio`/`total_resenas` y el trigger. Sin esas columnas, el API guarda el promedio en el JSON de `perfil_trabajador.descripcion`.

Solicitudes (HU-14, HU-15): `PUT /api/requests/{id}/status` valida Aceptar, Rechazar, Cancelar y Finalizar. En la API los estados se exponen como Enviada, Aceptada, Rechazada, Cancelada y Finalizada. En la base actual se persisten los valores del CHECK (`PENDIENTE`, `ACEPTADA`, `CANCELADA`, `COMPLETADA`; `Rechazar` usa `CANCELADA` si `Rechazada` no está permitida). Ejecuta `src/requests/sql/001_maquina_estados_solicitud.sql` para ampliar el CHECK, activar el trigger y la función `cambiar_estado_solicitud` (`FOR UPDATE`). Sin esa función, el endpoint usa bloqueo optimista.
