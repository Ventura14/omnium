# Omnium

Asistente personal de nutrición, entrenamiento y finanzas que optimiza
**coste por gramo de proteína**, no calorías.

Es un proyecto personal, no un producto.

## Arranque

Requisitos: Node 20+, pnpm, Python 3.11+ con [uv](https://docs.astral.sh/uv/), y una cuenta de Supabase con acceso al proyecto.

1. `pnpm install`
2. `cp .env.example .env.local` y rellena `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. `cd services && cp .env.example .env` y rellena `SUPABASE_DB_URL`
4. `pnpm dev`

Las claves **no están en el repo**. Pídeselas al dueño del proyecto o sácalas tú mismo del panel de Supabase (Project Settings → API para las del frontend, Project Settings → Database para `SUPABASE_DB_URL`) si tienes acceso al proyecto.

## Base de datos

**Este proyecto trabaja contra Supabase cloud. No hay stack local.**

- **Nunca `supabase start` ni `supabase db reset`.** `db reset` contra el proyecto enlazado **borra el catálogo entero** (25 alimentos verificados a mano, 108 productos con precios reales) y no es reversible. Si vienes de otro proyecto Supabase, este es el reflejo que hay que romper.
- Las migraciones viven en `supabase/migrations/`, versionadas, y se aplican con `supabase db push` contra el proyecto enlazado.
- Nunca cambios manuales en el panel de Supabase: si el esquema cambia, hay un archivo de migración.

## Comandos

```bash
pnpm dev                            # frontend local
pnpm build                          # build de producción
pnpm start                          # sirve el build de producción
pnpm lint
pnpm typecheck                      # antes de cada commit
supabase db push                    # aplica migraciones pendientes al proyecto enlazado
supabase migration list             # solo lectura, seguro sin permiso
supabase gen types typescript --linked > lib/database.types.ts
cd services && uv run pytest        # tests de Python
```

## Estructura

```
/app          Next.js App Router
/components   UI. shadcn/ui + composiciones propias. Sin lógica.
/lib          Cliente Supabase, tipos generados, helpers de formato
/services     Python
  /scrapers   Uno por tienda+canal
  /nutrition  Cálculo de macros, importadores BEDCA/OFF
/supabase
  /migrations SQL versionado
/docs         PLAN.md — estado de las fases
```

## Antes de tocar nada

Lee **[CLAUDE.md](./CLAUDE.md)** entero. Contiene 16 reglas duras que salieron de errores reales de este proyecto, no de preferencias de estilo — por ejemplo, que los nombres de alimentos de BEDCA a veces mienten sobre lo que describen, o que las conservas necesitan confirmación manual del peso escurrido porque no hay forma de derivarlo del envase. Ignorar esas reglas reintroduce bugs que ya se encontraron y se pagaron una vez.

Para el estado actual del proyecto y qué fase está en marcha, ver [docs/PLAN.md](./docs/PLAN.md).

## Secretos

`gitleaks` corre en pre-commit y en CI. Nunca imprimas el contenido de un `.env` por stdout, ni "solo para verificar el formato" — hubo un incidente real en este proyecto donde eso expuso una contraseña de base de datos completa. Para comprobar que una variable está definida, usa `[ -n "$VAR" ] && echo "OK"`.
