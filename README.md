# Omnium

Asistente personal para **comer lo que necesitas al menor coste**: planifica la semana, calcula los macros en gramos y te dice qué comprar, dónde y cuánto te cuesta cada gramo de proteína.

> **Estado:** proyecto personal publicado como código abierto, no un producto. Está pensado para una persona (o un grupo pequeño de confianza) con **su propia** base de datos Supabase. Las tiendas con scraper hoy son Dia y Glovo; leer [Limitaciones](#limitaciones-conocidas) antes de empezar.

## Índice

1. [Qué aporta](#qué-aporta)
2. [Qué hace la app](#qué-hace-la-app)
3. [Cómo está hecho](#cómo-está-hecho)
4. [Arranque paso a paso](#arranque-paso-a-paso)
5. [Configuración](#configuración)
6. [Hacerlo tuyo](#hacerlo-tuyo)
7. [Datos de terceros y licencia](#datos-de-terceros-y-licencia)
8. [Limitaciones conocidas](#limitaciones-conocidas)
9. [Desarrollo](#desarrollo)

---

## Qué aporta

Hay muchas apps que cuentan calorías. Esta resuelve otro problema: **cumplir un objetivo de calorías y proteína sin gastar de más ni pensar cada día qué cocinar.** Lo que la distingue:

### 1. Optimiza el coste por gramo de proteína, no las calorías

Una app de dieta típica minimiza calorías. Si tu objetivo es ganar músculo, eso es justo lo contrario de lo que quieres: necesitas **mucha proteína al precio más bajo posible**, con las calorías en un rango, no en un mínimo.

Para eso compara productos por **céntimos por gramo de proteína**, no por €/kg. Un ejemplo ilustrativo (números inventados, para ver la idea):

| Producto | Precio | Proteína | €/kg | **Cént. por g de proteína** |
|---|---|---|---|---|
| Pechuga de pollo | 6,50 €/kg | 22 g/100 g | 6,50 | **2,95** |
| Solomillo de ternera | 22,00 €/kg | 20 g/100 g | 22,00 | **11,00** |

Por €/kg la ternera es 3,4 veces más cara; por gramo de proteína, casi 4. El orden puede incluso invertirse entre un producto barato pero flojo en proteína y otro caro pero concentrado. La vista `cheapest_dia_proposal` ordena así los candidatos de cada alimento y marca los casos en los que la comparación **no es de fiar** (ver el punto 4).

### 2. Cocinas un día y comes durante varios (batch cooking)

La mayoría de planificadores asumen que se cocina y se come el mismo día. Aquí **producción y consumo están desacoplados**:

- una **sesión de cocina** (típicamente el domingo) *produce* raciones, y
- cada **hueco del calendario** (comida del martes, cena del jueves...) *consume* una ración.

`plan_balance` cuadra raciones producidas y consumidas: te dice si has cocinado de más o de menos. `plan_day_totals` suma los macros de cada día y distingue las comidas **fuera de casa** y los huecos vacíos, para no darte un falso déficit.

### 3. Compra sin desperdicio

Del plan sale la **lista de la compra con los gramos agregados** por alimento. Como los productos se venden en formatos cerrados (bandejas de 900 g, packs de 6 huevos), la app calcula **cuántos envases comprar y cuánto sobra** (`packs_to_buy`, `grams_leftover`), y prorratea el coste por lo que realmente usas. Ordenada por zonas de la tienda, con casillas "ya lo llevo" que se guardan.

### 4. Datos honestos: nunca finge saber lo que no sabe

Este es el valor menos visible y el que más trabajo ha dado. La base de datos distingue siempre **"no lo sé"** de **"es cero"**, porque un valor por defecto es una afirmación que nadie hizo:

- **Carbohidratos:** la fuente (BEDCA) mezcla dos convenciones (con y sin fibra) en la misma columna. Cada fila lleva `carbs_convention` (`net`, `total` o `unknown`), asignada solo por prueba aritmética, nunca por estimación.
- **Energía imposible:** se detectan los alimentos cuya grasa y proteína ya superan sus calorías declaradas (`foods_energy_check`).
- **Crudo o seco, siempre:** todo se pesa en crudo. Un alimento "hervido" con más calorías que el crudo es físicamente imposible y delata datos en base seca.
- **Precios:** cada precio dice si fue `scraped` (observado), `estimated` (calculado) o `manual`. Nunca se mezclan sin decirlo.
- **Conservas, legumbres y cortes:** el peso del título del envase no es el peso del alimento (líquido de gobierno, hueso, piel). Esos casos exigen **confirmación manual** y la app nunca los infiere. Las legumbres piden estado explícito (secas, cocidas, escurridas): un factor de 3 en calorías.
- **Pesos "aprox.":** los envases de peso aproximado se marcan (`pack_size_is_approx`, etiqueta "aprox." en `/compra`) en vez de tratarse como exactos.

Las [reglas duras de `CLAUDE.md`](./CLAUDE.md) recogen cada una de estas decisiones con el error real que las motivó.

### 5. ¿Compensa pedir a domicilio? Una respuesta con datos

Si tienes saldo de una tarjeta de beneficios que solo sirve en reparto (tipo Cobee), la pregunta real es si el **recargo** de pedir por una plataforma (Glovo, Uber Eats) se come el ahorro fiscal frente a comprar en tienda. La app guarda por separado el precio en tienda y en cada canal, las **comisiones** de envío y servicio (con suelo, porcentaje y techo) y calcula el coste total de un pedido por canal. El recargo real de las plataformas no está publicado en ningún sitio: medirlo es parte del proyecto.

> Esto es opcional. Si compras solo en tienda, ignora los canales de reparto.

### 6. La lógica vive en SQL y Python, no en el frontend

Todo el cálculo (macros, costes, envases, balances) está en **funciones y vistas de Postgres** o en scripts de Python. El frontend solo pinta. Es una decisión de diseño deliberada: lo que se calcula en SQL se puede leer, consultar y auditar con una consulta; lo que se calcula en un componente de React, no.

---

## Qué hace la app

| Pantalla | Para qué |
|---|---|
| `/foods` | Catálogo de alimentos con macros por 100 g. Alta manual desde una etiqueta. |
| `/recetas` | Recetas en gramos, con macros por ración calculados en Postgres. |
| `/semana` | Planificador semanal: asigna recetas a huecos (media mañana, comida, merienda, cena), ve los macros del día frente a tu objetivo. Variantes casa / oficina, con aviso si asignas una receta al día equivocado. Las recetas se ofrecen ordenadas por proteína por cada 100 kcal. (Las *rotaciones* semanales existen en SQL, `save_week_as_rotation` y `apply_rotation`, pero aún sin pantalla propia.) |
| `/compra` | Lista de la compra de la semana: envases, sobrantes, coste prorrateado y comparación de canales. |
| `/objetivos` | Histórico de objetivos (kcal, proteína, grasa, carbohidratos). El vigente es el de fecha más reciente. |
| `/peso` | Registro de peso corporal. |

Hay además una **cadena de scripts de Python** (en `services/`) que importan el catálogo de alimentos y precios.

---

## Cómo está hecho

```
┌───────────────────────────────────────────┐
│ Next.js (App Router) + Tailwind + shadcn  │  Solo pinta y envía formularios.
│ Server Components por defecto             │
└──────────────────┬────────────────────────┘
                   │  supabase-js (RLS)
┌──────────────────▼────────────────────────┐
│ Supabase: Postgres 15 + Auth + pgvector   │  Tablas, vistas y funciones:
│ RLS en todas las tablas                   │  aquí vive la lógica.
└──────────────────▲────────────────────────┘
                   │  psycopg (SUPABASE_DB_URL)
┌──────────────────┴────────────────────────┐
│ services/ (Python 3.11+, uv)              │  Importadores y scrapers.
│ nutrition/  scrapers/                     │  Se ejecutan a mano, no en Vercel.
└───────────────────────────────────────────┘
```

- **Frontend:** Next.js, TypeScript, Tailwind, shadcn/ui. Desplegable en Vercel.
- **Datos:** Supabase (Postgres, Auth, pgvector). Migraciones versionadas en `supabase/migrations/`.
- **Servicios:** Python con `uv` y SQL directo con `psycopg` (sin ORM).
- **Seguridad:** RLS activado en todas las tablas; todas las vistas con `security_invoker`; `gitleaks` en pre-commit y CI.

Estructura del repositorio:

```
/app            Páginas (App Router)
/components     UI, sin lógica de negocio
/lib            Cliente Supabase, tipos generados, fechas, formato
/services
  /nutrition    Importador de BEDCA y aplicador de seeds
  /scrapers     Scraper y cargadores de Dia / Glovo, cesta de la compra
  /tests        Tests de Python
/supabase
  /migrations   Esquema, versionado
  /seed         Datos de ejemplo sintéticos
/docs           PLAN.md (hoja de ruta) y PROVIDERS.md (tiendas y canales)
```

---

## Arranque paso a paso

Vas a montar **tu propia instancia**: tu proyecto de Supabase, tus claves, tus datos. Nada de esto es compartido con nadie.

### 0. Requisitos

- **Node 20+** y [pnpm](https://pnpm.io/)
- **Python 3.11+** y [uv](https://docs.astral.sh/uv/)
- La [CLI de Supabase](https://supabase.com/docs/guides/cli) (`brew install supabase/tap/supabase` o equivalente)
- Una cuenta gratuita de [Supabase](https://supabase.com/)

### 1. Clonar e instalar

```bash
git clone https://github.com/Ventura14/omnium.git
cd omnium
pnpm install
```

### 2. Crear tu proyecto de Supabase

En [supabase.com/dashboard](https://supabase.com/dashboard) crea un proyecto nuevo. Apunta:

- **La URL del proyecto** y la **clave pública** (`anon` / `publishable`): *Project Settings → API*.
- **La connection string de Postgres**: *Project Settings → Database → Connection string → "Session pooler"* (compatible con redes sin IPv6). Si la contraseña tiene caracteres especiales (`@ : / # %`), codifícalos en URL.
- **La referencia del proyecto** (`<ref>`): aparece en la URL del panel.

### 3. ⚠️ Desactiva el registro público

La app **no tiene pantalla de registro**, pero el endpoint de registro de Supabase Auth **está abierto por defecto** y la clave `anon` es pública (va en el navegador). Con el registro abierto, cualquiera podría crearse una cuenta, y varias tablas (alimentos, recetas, productos, precios, canales y comisiones) son un catálogo compartido que **cualquier usuario autenticado puede leer y modificar**.

En el panel: *Authentication → Sign In / Providers* (el nombre exacto varía según la versión del panel) y desactiva **"Allow new users to sign up"**.

### 4. Crear tu usuario

Como el registro está cerrado, créalo tú: *Authentication → Users → Add user → Create new user*, con tu email y una contraseña, y marca **Auto Confirm User**.

### 5. Variables de entorno

```bash
cp .env.example .env.local
cp services/.env.example services/.env
```

Rellena `.env.local` con la URL y la clave pública, y `services/.env` con la connection string. Mira [Configuración](#configuración) para el detalle de cada variable.

> **Nunca imprimas el contenido de un `.env`** (ni "solo para comprobar el formato"). Para comprobar que una variable está definida: `[ -n "$VAR" ] && echo "OK"`.

### 6. Crear el esquema (migraciones)

```bash
supabase login
supabase link --project-ref <ref>
supabase migration list     # solo lectura: qué hay aplicado y qué falta
supabase db push            # aplica las migraciones a TU proyecto
```

> ⚠️ **Nunca ejecutes `supabase db reset`.** Contra un proyecto enlazado **borra la base de datos entera** y no se puede deshacer. Este proyecto trabaja contra Supabase en la nube; **no está probado con el stack local** (`supabase start`).

Las migraciones se han verificado sobre una base de datos **vacía**: aplican las 50 sin errores.

### 7. Cargar el catálogo de alimentos (BEDCA)

[BEDCA](https://www.bedca.net/) es la base de datos española de composición de alimentos. El volcado está en el repositorio, así que no hace falta descargar nada:

```bash
uv run services/nutrition/insert_bedca.py
```

Es idempotente: se puede repetir. Importa ~950 alimentos.

### 8. Datos de ejemplo (opcional, recomendado la primera vez)

```bash
uv run services/nutrition/apply_seed.py
```

Crea, para tu usuario, un **catálogo de trabajo de 35 alimentos básicos**, 5 recetas marcadas `[Ejemplo]` y un objetivo de ejemplo (2500 kcal, 140 g de proteína). Son sintéticos: **bórralos o edítalos**. Es idempotente y, si falta el usuario o BEDCA, se detiene con un mensaje que dice qué hacer.

### 9. Arrancar

```bash
pnpm dev
```

Abre [http://localhost:3000](http://localhost:3000), entra con el usuario del paso 4 y recorre, por este orden: `/objetivos` (pon el tuyo), `/recetas`, `/semana` (crea el plan de la semana y asigna recetas).

### 10. (Opcional) Precios y compra

Para que `/compra` compare precios necesitas datos de una tienda. Hoy hay scraper para **Dia**. Es opcional y tiene reglas estrictas (1 petición/segundo, nunca en bucle): lee [docs/PROVIDERS.md](./docs/PROVIDERS.md) antes de lanzarlo.

### 11. (Opcional) Desplegar en Vercel

Importa el repositorio en Vercel y define en *Environment Variables* las mismas variables de `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, y `APP_TIMEZONE` si no estás en Madrid).

> 💤 **El plan gratuito de Supabase pausa el proyecto tras 7 días sin actividad.** Una app de uso semanal vive justo al borde: si se pausa, la app deja de responder hasta que lo reactives desde el panel. Detalle en [docs/NOTES_infra.md](./docs/NOTES_infra.md).

---

## Configuración

| Variable | Dónde | Obligatoria | Para qué |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.local` | Sí | URL de tu proyecto Supabase. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `.env.local` | Sí | Clave **pública** (`anon`/`publishable`). La limita RLS, no el secreto. **Nunca pongas aquí la `service_role`.** |
| `APP_TIMEZONE` | `.env.local` / Vercel | No | Zona horaria IANA de tus fechas ("hoy", el lunes de la semana). Por defecto `Europe/Madrid`. Un valor inválido falla a propósito. |
| `SUPABASE_DB_URL` | `services/.env` | Para los scripts | Connection string directa de Postgres (rol `postgres`, salta RLS). **Solo para scripts de servicio; nunca en el frontend ni en Vercel.** |
| `APP_TIMEZONE` | `services/.env` | No | Misma zona, para fechar el objetivo de ejemplo del seed. Usa el mismo valor que en la app. |

Los archivos `.env*` están en `.gitignore`. Solo se versionan los `.env.example`, con los valores vacíos.

---

## Hacerlo tuyo

Estas son las cosas que **son tuyas y no del código**. Dónde cambiar cada una:

| Qué | Cómo |
|---|---|
| **Tu objetivo** de kcal, proteína, grasa y carbohidratos | Pantalla `/objetivos`. Se guarda un histórico, nunca se sobrescribe el anterior. Los objetivos se fechan en **lunes**. |
| **Tus recetas** | `/recetas`. Borra las `[Ejemplo]` cuando tengas las tuyas. |
| **Tu catálogo de trabajo** (`is_staple`) | Es una marca en `foods`. El seed marca 35 de partida; cámbialos. La app no la exige: es la convención del proyecto. |
| **Tu zona horaria** | `APP_TIMEZONE`. |
| **Tu cesta de la compra** (qué busca el scraper) | `services/scrapers/basket.json`, fuera de git. Parte de `basket.example.json`. |
| **Las comisiones de tu plataforma de reparto** | La lista `FEES` de `services/scrapers/load_glovo_channel.py`. Las que trae son las medidas en una dirección concreta; **cámbialas por las que Glovo te enseña antes de pagar.** |
| **Tu tipo marginal de IRPF** (para convertir saldo bruto de la tarjeta de beneficios en euros netos) | Hoy es una constante, **0,30**, en la función SQL `gross_salary_equivalent` y en el texto de `/compra`. Es una estimación ilustrativa, no un dato fiscal: cámbiala con una migración nueva. |
| **Tus restricciones alimentarias** | No hay un filtro automático: se respetan eligiendo qué alimentos entran en tu catálogo de trabajo y qué recetas creas. |
| **Tus días de oficina o de casa** | Tabla `work_location`. El seed no la rellena (son datos tuyos); las variantes casa / oficina de las recetas avisan en `/semana` si no coinciden. |

---

## Datos de terceros y licencia

**El código** se publica bajo licencia [MIT](./LICENSE).

**Los datos no son de este proyecto**, y la licencia MIT no los cubre:

- **Composición de alimentos:** [BEDCA](https://www.bedca.net/), Base de Datos Española de Composición de Alimentos (AESAN). El volcado incluido (`services/nutrition/data/bedca_raw.xml`) es de esa fuente; consulta sus condiciones de uso.
- **Catálogos, precios e imágenes de supermercados:** el repositorio incluye muestras de sondeo de Dia y Mercadona (`services/scrapers/data/*_sample.json`) y miniaturas de productos de Dia (`public/products/`). Son **datos de esas empresas**, incluidos como ejemplo de lo que devuelven; no se reivindica ningún derecho sobre ellos.
- **Tu uso:** si ejecutas los scrapers, tú eres quien consulta esas tiendas. Respeta sus términos de uso y su protección anti-bot (`CLAUDE.md`, regla 9). Si eres titular de alguno de esos datos y prefieres que se retiren, abre una *issue* y se quitan.

Este proyecto **no es** asesoramiento dietético, médico ni fiscal. Los objetivos nutricionales deberías validarlos con un profesional, y el cálculo de equivalente bruto de la tarjeta de beneficios es una estimación.

---

## Limitaciones conocidas

Escritas aquí para que no te las encuentres de sorpresa:

- **Tiendas:** el scraper y las vistas de precios están **fijados a Dia**. Rellenar las tablas con otra tienda no basta; hay que tocar vistas. Estado real y pasos en [docs/PROVIDERS.md](./docs/PROVIDERS.md). La clase `StoreAdapter` mencionada como objetivo de diseño **no existe todavía**.
- **Pensado para pocas personas de confianza:** las tablas de catálogo (alimentos, recetas, productos, precios, canales y comisiones) las puede modificar cualquier usuario autenticado. Con un registro público abierto no es seguro (paso 3).
- **Sin stack local:** solo probado contra Supabase en la nube.
- **Un solo idioma:** la interfaz y la documentación están en español.
- **Sin importador de Open Food Facts:** solo BEDCA. Los productos de marca se dan de alta a mano desde la etiqueta.
- **Matching alimento ↔ producto:** hoy es una cesta explícita (término de búsqueda → alimento) y confirmación manual. La columna de *embeddings* está en el esquema, pero el matching automático no está construido.
- **Los scrapers dependen de webs ajenas:** si Dia cambia su web o su protección, se rompen, y esto se arregla a mano.
- **Verificación:** los tests automáticos son pocos (cesta de la compra). Las migraciones se han comprobado aplicándolas sobre una base vacía, y la CI hace análisis de secretos, tipos y lint.

---

## Desarrollo

```bash
pnpm dev                            # frontend local
pnpm build && pnpm start            # build de producción
pnpm lint
pnpm typecheck                      # antes de cada commit
supabase gen types typescript --linked > lib/database.types.ts   # tras cambiar el esquema
cd services && uv run pytest        # tests de Python
```

**Antes de tocar nada, lee [CLAUDE.md](./CLAUDE.md) entero.** Contiene las reglas duras del proyecto, cada una nacida de un error real: que los nombres de alimentos de BEDCA a veces mienten sobre lo que describen, que las conservas necesitan confirmación manual del peso escurrido, que las vistas nuevas necesitan `security_invoker`... Ignorarlas reintroduce bugs que ya se pagaron una vez.

Para el estado del proyecto y la hoja de ruta, [docs/PLAN.md](./docs/PLAN.md).

**Secretos:** `gitleaks` corre en pre-commit y en CI sobre todo el historial. Si te ofreces a contribuir, instálalo (`brew install gitleaks`) y activa los hooks con `pre-commit install`.
