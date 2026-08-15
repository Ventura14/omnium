# CLAUDE.md

Contexto para agentes trabajando en este repo. Léelo entero antes de tocar nada.

## Qué es esto

Asistente personal para nutrición, entrenamiento y finanzas, de código abierto. Pensado para una persona (o un grupo pequeño de confianza) con su propia base de datos Supabase. Está construido alrededor del *batch cooking* (se cocina un día, se come durante varios) y de comprar en supermercados con un scraper por tienda.

**Objetivo por defecto:** cumplir un objetivo de calorías y proteína (típicamente ganar masa muscular con un superávit ligero) al menor coste. La app optimiza **coste por gramo de proteína**, nunca "menos calorías". Los objetivos concretos (kcal, proteína, grasa, carbohidratos) se guardan por usuario en `nutrition_targets`.

## Stack

- **Frontend:** Next.js (App Router) + TypeScript + Tailwind + shadcn/ui, en Vercel
- **Datos:** Supabase (Postgres 15 + Auth + pgvector)
- **Lógica:** Python 3.11+ (scrapers, matching, optimización), en Docker
- **Migraciones:** Supabase CLI, versionadas en `supabase/migrations/`

## Reglas duras

Estas no se negocian. Si una tarea parece requerir romperlas, para y pregunta.

1. **Cero lógica de negocio en TypeScript.** El frontend renderiza y envía formularios. Cálculo de macros, optimización de cesta, matching de productos y categorización de gastos viven en Python o en funciones de Postgres. El proyecto está pensado para mantenerse leyendo Python y SQL: la lógica que no se pueda auditar ahí es deuda.
2. **Server Components por defecto.** `"use client"` solo cuando haya interacción real. Nada de gestores de estado globales.
3. **RLS activado en todas las tablas desde el primer día**, con `user_id = auth.uid()`. Aunque ahora solo haya un usuario.
4. **Nunca commitear secretos.** `.env*` está en `.gitignore`. Los seeds son sintéticos, jamás datos reales del usuario.
5. **Toda la nutrición en gramos.** Sin tazas, cucharadas ni unidades. La conversión, si algún día llega, se hace en capa de presentación.
6. **No optimices rendimiento.** Un usuario, ejecución semanal. Un script que tarda 40 segundos está bien. Optimiza legibilidad.
7. **Migraciones, nunca cambios manuales en el panel de Supabase.** Si el esquema cambia, hay un archivo en `supabase/migrations/`.

## Vocabulario del dominio

Confundir estos términos es el error más frecuente. Son cosas distintas:

| Término | Significado |
|---|---|
| **food** | Alimento genérico con datos nutricionales por 100 g. "Pechuga de pollo". No tiene precio. |
| **product** | SKU real de un supermercado. "Bandeja pechuga fileteada 900 g — Dia". Tiene precio, marca y formato. |
| **channel** | Vía de compra de un product: presencial, web propia, Glovo, Uber Eats. Mismo producto, precios distintos. |
| **recipe** | Conjunto de foods en gramos, que produce N raciones. |
| **serving / ración** | Una porción de una recipe. Coloquialmente, un tupper. |
| **cook_session** | Sesión de cocina (típicamente domingo) que **produce** raciones. |
| **meal_plan_slot** | Hueco del calendario que **consume** una ración. |
| **carbs_100g** | Carbohidratos TOTALES, fibra INCLUIDA (convención BEDCA, verificada por Atwater). Al importar de otras fuentes hay que comprobar su convención y normalizar a esta. USDA y Open Food Facts suelen reportar carbohidratos netos: en ese caso, sumar la fibra antes de insertar. |

**Clave:** producción y consumo están desacoplados. Se cocina el domingo y se come de lunes a viernes. No asumas nunca que cocinar y comer ocurren el mismo día.

## Restricciones alimentarias

Son restricciones duras del sistema, no preferencias sugeridas, pero **son datos de cada usuario, no del código**: nunca se escriben a mano en una receta, una vista ni un componente. Tipos de restricción que se modelan:

- **Excluir** alimentos concretos (alergias, intolerancias, aversiones).
- **Permitir** una forma concreta de un alimento excluido (p. ej. excluir el tomate crudo pero no el frito).
- **Preferir** unos alimentos sobre otros.
- **Reducir** (no eliminar) un ingrediente, como el gluten.
- Qué ingestas hay en el día (hay quien no desayuna) y cuáles cambian entre casa y oficina.
- Comidas y cenas fuera de casa por semana (configurable).

## Estructura

```
/app                 Next.js App Router
/components          UI. shadcn/ui + composiciones propias. Sin lógica.
/lib                 Cliente Supabase, tipos generados, helpers de formato
/services            Python
  /scrapers          Uno por tienda+canal. Interfaz común StoreAdapter.
  /matching          food ↔ product vía embeddings + pgvector
  /optimizer         Asignación de cesta y canal
  /nutrition         Cálculo de macros, importadores BEDCA/OFF
/supabase
  /migrations        SQL versionado
  /seed              Datos sintéticos
/docs
  PLAN.md            Plan de implementación
```

## Comandos

```bash
pnpm dev                          # frontend local
pnpm typecheck                    # antes de cada commit
supabase db reset                 # recrear BBDD local desde migraciones
supabase gen types typescript --local > lib/database.types.ts
cd services && uv run pytest      # tests de Python
```

## Convenciones

- Código, nombres de tablas y comentarios en **inglés**. Documentación y textos de UI en **español**.
- Tablas en plural y `snake_case`. Componentes en `PascalCase`.
- Toda tabla lleva `id uuid`, `user_id uuid`, `created_at timestamptz`.
- Dinero en `numeric(10,2)`, nunca en float.
- Pesos en gramos con `numeric(10,2)`. Energía en kcal enteras.
- Un adaptador de tienda es una clase que implementa `StoreAdapter`. Añadir Mercadona debe ser un archivo nuevo, jamás un refactor.

## Estado actual

Fase 0-1: núcleo de nutrición. Precios introducidos a mano. **Sin scrapers todavía** — no los implementes aunque parezcan la siguiente pieza lógica.

## Qué NO hacer

- No añadas dependencias de frontend sin preguntar.
- No uses ORMs en Python. SQL directo con `psycopg`.
- No implementes autenticación social, recuperación de contraseña ni onboarding. Un usuario.
- No generes datos nutricionales inventados. Si falta un alimento, se importa de BEDCA u Open Food Facts o lo mete el usuario a mano.
- No conectes con la API de Strava para nada que alimente un LLM: sus términos lo prohíben. Datos para IA solo desde export manual GPX/FIT.
