# CLAUDE.md

Contexto para agentes trabajando en este repo. Léelo entero antes de tocar nada.

## Qué es esto

Asistente personal para nutrición, entrenamiento y finanzas, de código abierto. Pensado para una persona (o un grupo pequeño de confianza) con su propia base de datos Supabase. Está construido alrededor del *batch cooking* (se cocina un día, se come durante varios) y de comprar en supermercados con un scraper por tienda.

**Objetivo por defecto:** cumplir un objetivo de calorías y proteína (típicamente ganar masa muscular con un superávit ligero) al menor coste. La app optimiza **coste por gramo de proteína**, nunca "menos calorías". Los objetivos concretos (kcal, proteína, grasa, carbohidratos) se guardan por usuario en `nutrition_targets`.

## Stack

- **Frontend:** Next.js (App Router) + TypeScript + Tailwind + shadcn/ui, en Vercel. shadcn/ui instalado el 2026-08-27, decisión del usuario tras ver tres mockups de /compra y /semana con sus propios datos. Componentes instalados según haga falta (empezó con checkbox, card, badge, progress, separator para /compra) -- no traer el catálogo entero de una vez.
- **Datos:** Supabase (Postgres 15 + Auth + pgvector)
- **Lógica:** Python 3.11+ (scrapers, matching, optimización), en Docker
- **Migraciones:** Supabase CLI, versionadas en `supabase/migrations/`

## Reglas duras

Estas no se negocian. Si una tarea parece requerir romperlas, para y pregunta.

1. **Cero lógica de negocio en TypeScript.** El frontend renderiza y envía formularios. Cálculo de macros, optimización de cesta, matching de productos y categorización de gastos viven en Python o en funciones de Postgres. El proyecto está pensado para mantenerse leyendo Python y SQL: la lógica que no se pueda auditar ahí es deuda.
2. **Server Components por defecto.** `"use client"` solo cuando haya interacción real. Nada de gestores de estado globales.
3. **RLS activado en todas las tablas desde el primer día**, con `user_id = auth.uid()`. Aunque haya un solo usuario. Si hay varios administradores de confianza con acceso total a la base (el caso de la migración `20260911000000_shared_catalog.sql`), RLS deja de ser una barrera de seguridad entre ellos y pasa a ser organización de datos: evita que se pisen planes y compras, no protege a unos de otros. Si entra alguien que no sea de confianza, esa suposición hay que revisarla, y la auditoría de RLS (ver migración `20260910000000`) vuelve a ser relevante para las tablas personales.
4. **Nunca commitear secretos.** `.env*` está en `.gitignore`. Los seeds son sintéticos, jamás datos reales del usuario.
5. **Toda la nutrición en gramos.** Sin tazas, cucharadas ni unidades. La conversión, si algún día llega, se hace en capa de presentación.
6. **No optimices rendimiento.** Un usuario, ejecución semanal. Un script que tarda 40 segundos está bien. Optimiza legibilidad.
7. **Migraciones, nunca cambios manuales en el panel de Supabase.** Si el esquema cambia, hay un archivo en `supabase/migrations/`.
8. **Las conservas requieren confirmación manual del peso escurrido.** El peso del nombre del producto y el "contenido neto" del envase no son lo mismo, y no hay señal estructural que los distinga (ver `services/scrapers/VIABILIDAD_matching_dia_bedca.md`). Nunca infieras el peso escurrido del nombre.
9. **Akamai Bot Manager activo en Dia.** Los scrapers van a 1 req/seg como máximo, sin paralelizar, y con backoff exponencial ante 403 o 429. Nunca reintentar en bucle.
10. **Desarrollo contra Supabase cloud.** NUNCA `supabase start` ni `supabase db reset`: la máquina no da para los contenedores (decisión ya tomada, no reabrir), y `db reset` contra el proyecto enlazado borraría el catálogo completo. Las migraciones se aplican al proyecto enlazado con `supabase db push`, nunca en local. El agente no ejecuta `supabase db push` por iniciativa propia: prepara la migración y para. La aplica solo cuando el usuario lo pide explícitamente, después de revisarla. Solo lectura (`supabase migration list`) sí puede ejecutarse sin pedir permiso.
11. **`search_name` lo rellena siempre un trigger de Postgres** (`normalize_search_name`), tanto en INSERT como en UPDATE. Ningún cliente — ni Python, ni TypeScript — lo calcula ni lo envía.
12. **Las legumbres requieren estado explícito: secas, cocidas o de bote escurridas** (misma clase que la regla 8, conservas). Lentejas secas ~350 kcal/100g, cocidas ~116: un factor de 3. Nunca infieras el estado a partir del nombre de la receta o del alimento.
13. **Solo se usan alimentos CRUDOS o SECOS, y se pesa en crudo.** La merma al cocinar se modela con `foods.cooked_yield`, que ya existe en el esquema. Físicamente: hervir añade agua y BAJA la densidad calórica; asar y freír la quitan y la SUBEN. Por tanto "asado > crudo" es esperable y no es señal de nada. La bandera roja es únicamente **HERVIDO > CRUDO**, físicamente imposible, que delata macros en base seca (arroz, lenteja y garbanzo verificados). Aparte, algunas entradas "hervido" traen grasa añadida que el nombre no anuncia: "Judía verde, hervida" declara 6.79 g de grasa frente a 0.40 en cruda.
14. **En pescado y carne, el formato del corte cambia la fracción comestible.** Rodajas, chuletas y piezas con hueso o piel no son comparables por €/kg (ni por €/g de proteína) con filetes limpios — misma clase que la regla 8 (conservas): el peso del envase no es el peso del alimento. Confirmar a mano (`products.edible_fraction`), nunca inferir del precio.
15. **Un dato que falta no es un valor por defecto.** El esquema debe poder distinguir "no lo sé" de una respuesta real. Un `NOT NULL` con `DEFAULT` convierte una omisión en una afirmación silenciosa que nadie tomó y nadie puede ver. Mismo patrón ya aplicado cinco veces en este proyecto: `carbs_convention = 'unknown'`, `macro_check = 'sin_comprobar'`, `cheapest_dia_proposal.sin_criterio_comparacion`, medido-vs-estimado (`proteina_estimada`), y `foods.pantry_stability` nullable (Fase 5c). Cuando el dato no exista, usa NULL o un estado explícito de "sin clasificar" — nunca `false`/`0`/una cadena vacía como sustituto silencioso.
16. **Nunca confirmar ni pagar un pedido en Glovo, Uber Eats ni ninguna tienda.** Montar la cesta sí (es reversible); confirmar y pagar lo hace siempre el usuario. La autorización se da viendo el desglose final, no por adelantado: aunque el usuario haya pedido el pedido en el mismo mensaje, se para antes de confirmar y se le enseña el total. Si el pago sale de un saldo que caduca o no es reembolsable (p. ej. una tarjeta de beneficios tipo Cobee, que solo sirve en reparto), un pedido equivocado gasta dinero irrecuperable.
17. **Toda vista nueva se crea con `security_invoker = true`.** Sin eso, una vista se ejecuta con los permisos de su creador (`postgres`, que tiene `rolbypassrls`) y enseña a cualquiera lo que la tabla le niega. La regla 3 protege las tablas; esta protege las vistas, y el agujero estuvo abierto en 10 vistas hasta la auditoría del 2026-08-29.

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
| **carbs_100g** | Columna cruda tal como llega de la fuente. **Mezcla dos convenciones** (fibra incluida y fibra excluida) dentro de la misma columna — no asumir ninguna. Prueba: 54 filas tienen `fiber_100g > carbs_100g`, matemáticamente imposible si `carbs_100g` incluyera siempre la fibra. La convención de cada fila se marca en `carbs_convention` (`'net'`, `'total'` o `'unknown'`), asignada solo por regla aritmética demostrable, nunca por Atwater (Atwater es una estimación, no una prueba — no sirve para clasificar un dato como si fuera un hecho). |
| **carbs_convention** | `'net'` si `fiber_100g > carbs_100g` (prueba aritmética de que la fibra está excluida); `'total'` si `fiber_100g` es nulo o <0.5 (la diferencia con incluirla es irrelevante); `'unknown'` en cualquier otro caso — no se inventa. |
| **carbs_total_100g** | Columna generada: `carbs_100g + fiber_100g` cuando `carbs_convention='net'`, si no `carbs_100g` tal cual. **Todo consumo de carbohidratos usa esta columna, nunca `carbs_100g` directamente** (`recipe_macros`, `compute_recipe_macros`). Al importar de USDA/OFF, marcar `carbs_convention` explícitamente según lo que documente la fuente — no sumar fibra a ciegas asumiendo que siempre viene neta. |

**Clave:** producción y consumo están desacoplados. Se cocina el domingo y se come de lunes a viernes. No asumas nunca que cocinar y comer ocurren el mismo día.

## Restricciones alimentarias

Son restricciones duras del sistema, no preferencias sugeridas, pero **son datos de cada usuario, no del código**: nunca se escriben a mano en una receta, una vista ni un componente. Tipos de restricción que se modelan:

- **Excluir** alimentos concretos (alergias, intolerancias, aversiones).
- **Permitir** una forma concreta de un alimento excluido (p. ej. excluir el tomate crudo pero no el frito).
- **Preferir** unos alimentos sobre otros.
- **Reducir** (no eliminar) un ingrediente, como el gluten.
- Qué ingestas hay en el día (hay quien no desayuna) y cuáles cambian entre casa y oficina.
- Comidas y cenas fuera de casa por semana (configurable).

## Estructura y comandos

Viven en `AGENTS.md`, importado aquí debajo: estructura del repositorio, comandos, mapa de vistas y funciones SQL, y cómo verificar un cambio (incluido probar migraciones en una base vacía). Si un comando de ese archivo no funciona, es un bug del documento: arréglalo allí antes de seguir. Recuerda la regla dura 10: nunca `supabase start` ni `supabase db reset`.

@AGENTS.md

## Convenciones

- Código, nombres de tablas y comentarios en **inglés**. Documentación y textos de UI en **español**.
- Tablas en plural y `snake_case`. Componentes en `PascalCase`.
- Toda tabla lleva `id uuid`, `user_id uuid`, `created_at timestamptz`.
- Dinero en `numeric(10,2)`, nunca en float.
- Pesos en gramos con `numeric(10,2)`. Energía en kcal enteras.
- Objetivo de diseño: añadir una tienda debe ser un archivo nuevo, jamás un refactor. **Hoy no se cumple del todo**: `StoreAdapter` no existe como clase (Dia es un módulo plano, `services/scrapers/dia.py`) y la capa de precios en SQL tiene vistas fijadas a `store = 'dia'`. Estado real y pasos en `docs/PROVIDERS.md`.
- La cesta de los scrapers (término de búsqueda → alimento) es un dato del usuario: vive en `services/scrapers/basket.json` (fuera de git), nunca en el código.
- Toda Server Action que ESCRIBA datos llama a `requireUser()` de `lib/auth.ts` como primera línea, sin excepción. Las lecturas no lo necesitan: RLS ya las cubre. El control estaba copiado a mano en cada acción hasta que se olvidó en /semana (2026-08-19); un solo sitio y una regla escrita es lo que impide que se repita.
- Los `nutrition_targets` se fechan en lunes. `create_meal_plan` los resuelve contra `week_start`, que siempre es lunes, así que un objetivo fechado a media semana no aplica hasta el lunes siguiente.
- Todas las fechas del dominio son fechas civiles de la zona horaria de la app (`APP_TIMEZONE`, por defecto Europe/Madrid), no UTC, **tanto en TypeScript como en SQL**. Ni Vercel ni Supabase corren en Madrid: los dos usan UTC de servidor, y en la franja de 00:00 a 02:00 de Madrid dan el día anterior en silencio, sin fallar de forma ruidosa — es el mismo bug a los dos lados. En TypeScript, usa `todayInAppTimezone()` de `lib/dates.ts` (`todayInMadrid()` es un alias antiguo), el único sitio donde se fija esa zona horaria; nunca derives una fecha de dominio de `new Date()` a secas en el servidor. En SQL, nunca uses `current_date` ni `now()::date` para una fecha de dominio: usa `(now() at time zone '<tu zona>')::date` (`Europe/Madrid` por defecto). Los `timestamptz` de auditoría (`created_at`) SÍ se quedan en UTC — es lo correcto para ellos, no los "arregles".

## Estado actual

Fase 0-1: núcleo de nutrición terminado. Planificador semanal (Fase 4) y rotación (Fase 4c) en marcha. **Scrapers activados el 2026-08-24**, la Fase 7 (precios) se adelantó a las Fases 5 y 6 para poder decidir con datos si compensa pedir por plataformas de reparto (con saldo de una tarjeta de beneficios tipo Cobee) frente a comprar en tienda: hacían falta precios comparables ya, no dentro de varias fases. Ver docs/PLAN.md, sección Fase 7, para el detalle. Antes de esta fecha, "sin scrapers todavía" era la regla; ya no lo es — sigue existiendo la regla 9 (Akamai, 1 req/seg, sin paralelizar, backoff, nunca reintentar en bucle), que no cambia.

## Qué NO hacer

- No añadas dependencias de frontend sin preguntar.
- No uses ORMs en Python. SQL directo con `psycopg`.
- No implementes autenticación social, recuperación de contraseña ni onboarding. Un usuario.
- No generes datos nutricionales inventados. Si falta un alimento, se importa de BEDCA u Open Food Facts o lo mete el usuario a mano.
- No conectes con la API de Strava para nada que alimente un LLM: sus términos lo prohíben. Datos para IA solo desde export manual GPX/FIT.
- Nunca imprimas el contenido de archivos `.env` por stdout, ni siquiera parcialmente ni "solo para verificar el formato". Un incidente real: verificar un `.env` con `awk` expuso una contraseña de base de datos completa en el chat.
- Para comprobar que una variable de entorno está definida, usa `[ -n "$VAR" ] && echo "OK"`. Nunca `cat`, `awk`, `head` ni `grep` sobre el archivo `.env`.
