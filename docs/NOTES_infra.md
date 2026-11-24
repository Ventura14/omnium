# Notas de infraestructura

## Supabase free tier pausa el proyecto tras 7 días sin actividad (2026-09-08)

El proyecto se pausó solo (status `INACTIVE`) durante unas horas --
plan gratuito, 7 días sin actividad detectada. El usuario lo
reactivó a mano desde el panel. Mientras estuvo pausado, tanto
`SUPABASE_DB_URL` (conexión directa) como el propio `supabase` CLI
(login role) fallaban por igual -- no es un problema de credenciales
locales, es que el proyecto entero no respondía.

Esto **va a repetirse**: omnium es una app de uso semanal (se
plani­fica y se compra una vez por semana), así que vive justo en el
borde de la ventana de 7 días de inactividad de Supabase. Cualquier
semana en la que nadie abra la app es una semana en la que el
proyecto puede pausarse solo.

Relevante para el despliegue en Vercel, cuando llegue: si el
proyecto está pausado, la app en producción tampoco funcionaría
hasta reactivarlo a mano.

**Solución barata, identificada pero NO construida todavía:** un
ping periódico desde el GitHub Actions que ya existe en el repo
(hoy corre CI de typecheck/lint) -- una petición de lectura trivial
contra el proyecto de Supabase con la cadencia suficiente para que
nunca pasen 7 días sin actividad. No implementado a propósito, a la
espera de que se decida cuándo abordarlo.
