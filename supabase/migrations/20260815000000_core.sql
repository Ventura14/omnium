-- 0001_core.sql — Núcleo de nutrición + tablas de registro temprano
-- Fase 1. Sin precios ni scrapers todavía.

create extension if not exists "pgcrypto";
create extension if not exists "vector";   -- se usará en fase 2 para el matching

-- =====================================================================
-- ALIMENTOS
-- =====================================================================

create type food_source as enum ('bedca', 'openfoodfacts', 'manual');

create table foods (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users(id) on delete cascade,
  name            text not null,
  search_name     text not null,              -- minúsculas, sin acentos; lo rellena la app
  source          food_source not null default 'manual',
  source_ref      text,                       -- código BEDCA o barcode de OFF
  -- Macros por 100 g de producto comestible
  kcal_100g       numeric(7,2) not null check (kcal_100g >= 0),
  protein_100g    numeric(7,2) not null check (protein_100g >= 0),
  carbs_100g      numeric(7,2) not null check (carbs_100g >= 0),
  fat_100g        numeric(7,2) not null check (fat_100g >= 0),
  fiber_100g      numeric(7,2) default 0,
  -- Merma al cocinar: 1.00 = sin cambio, 0.75 = pierde 25% de peso
  cooked_yield    numeric(4,2) default 1.00 check (cooked_yield > 0),
  is_excluded     boolean not null default false,   -- tomate crudo, marisco...
  created_at      timestamptz not null default now()
);

create index on foods (user_id, search_name);
create unique index on foods (user_id, source, source_ref) where source_ref is not null;

-- =====================================================================
-- RECETAS
-- =====================================================================

create table recipes (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  name            text not null,
  servings        integer not null check (servings > 0),
  prep_minutes    integer,
  batch_friendly  boolean not null default true,   -- ¿aguanta bien en tupper?
  freezer_ok      boolean not null default false,
  fridge_days     integer default 4,               -- caducidad en nevera
  instructions    text,
  source_url      text,
  created_at      timestamptz not null default now()
);

create table recipe_ingredients (
  recipe_id       uuid not null references recipes(id) on delete cascade,
  food_id         uuid not null references foods(id) on delete restrict,
  grams           numeric(10,2) not null check (grams > 0),
  note            text,                            -- "en dados", "al horno"
  primary key (recipe_id, food_id)
);

-- Macros calculados. Nunca guardar esto denormalizado.
create view recipe_macros as
select
  r.id as recipe_id,
  r.servings,
  round(sum(ri.grams * f.kcal_100g    / 100), 1) as kcal_total,
  round(sum(ri.grams * f.protein_100g / 100), 1) as protein_total,
  round(sum(ri.grams * f.carbs_100g   / 100), 1) as carbs_total,
  round(sum(ri.grams * f.fat_100g     / 100), 1) as fat_total,
  round(sum(ri.grams * f.kcal_100g    / 100) / r.servings, 1) as kcal_per_serving,
  round(sum(ri.grams * f.protein_100g / 100) / r.servings, 1) as protein_per_serving,
  round(sum(ri.grams * f.carbs_100g   / 100) / r.servings, 1) as carbs_per_serving,
  round(sum(ri.grams * f.fat_100g     / 100) / r.servings, 1) as fat_per_serving
from recipes r
join recipe_ingredients ri on ri.recipe_id = r.id
join foods f on f.id = ri.food_id
group by r.id, r.servings;

-- =====================================================================
-- PLANIFICACIÓN
-- Producción (domingo) y consumo (L-V) están DESACOPLADOS.
-- =====================================================================

create type meal_type as enum ('breakfast', 'midmorning', 'lunch', 'snack', 'dinner');

create table meal_plans (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  week_start      date not null,                   -- siempre lunes
  target_kcal     integer not null default 3000,
  target_protein  integer not null default 155,
  status          text not null default 'draft',   -- draft | active | done
  created_at      timestamptz not null default now(),
  unique (user_id, week_start)
);

-- Sesión de cocina: PRODUCE raciones
create table cook_sessions (
  id              uuid primary key default gen_random_uuid(),
  plan_id         uuid not null references meal_plans(id) on delete cascade,
  cook_date       date not null,
  notes           text
);

create table cook_session_recipes (
  session_id        uuid not null references cook_sessions(id) on delete cascade,
  recipe_id         uuid not null references recipes(id) on delete restrict,
  servings_produced numeric(5,2) not null check (servings_produced > 0),
  primary key (session_id, recipe_id)
);

-- Hueco del calendario: CONSUME raciones
create table meal_plan_slots (
  id              uuid primary key default gen_random_uuid(),
  plan_id         uuid not null references meal_plans(id) on delete cascade,
  slot_date       date not null,
  meal            meal_type not null,
  recipe_id       uuid references recipes(id) on delete set null,
  servings        numeric(5,2) not null default 1 check (servings > 0),
  eating_out      boolean not null default false,  -- 1 comida + 1 cena/semana
  notes           text,
  unique (plan_id, slot_date, meal)
);

-- Cuadre: ¿lo cocinado cubre lo planificado?
create view plan_balance as
with produced as (
  select cs.plan_id, csr.recipe_id, sum(csr.servings_produced) as produced
  from cook_sessions cs
  join cook_session_recipes csr on csr.session_id = cs.id
  group by cs.plan_id, csr.recipe_id
),
consumed as (
  select plan_id, recipe_id, sum(servings) as consumed
  from meal_plan_slots
  where recipe_id is not null and not eating_out
  group by plan_id, recipe_id
)
select
  coalesce(p.plan_id, c.plan_id)   as plan_id,
  coalesce(p.recipe_id, c.recipe_id) as recipe_id,
  coalesce(p.produced, 0)          as produced,
  coalesce(c.consumed, 0)          as consumed,
  coalesce(p.produced, 0) - coalesce(c.consumed, 0) as balance
from produced p
full outer join consumed c
  on p.plan_id = c.plan_id and p.recipe_id = c.recipe_id;

-- =====================================================================
-- REGISTRO TEMPRANO
-- Sin UI en fase 1. Existen para empezar a acumular serie temporal YA.
-- =====================================================================

create table body_metrics (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  measured_on     date not null,
  weight_kg       numeric(5,2),
  waist_cm        numeric(5,2),
  notes           text,
  unique (user_id, measured_on)
);

create table exercises (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  name            text not null,
  muscle_group    text not null,     -- chest | back | shoulders | biceps | triceps | legs | core
  equipment       text
);

create table workouts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  performed_on    date not null,
  focus           text,              -- "pecho+tríceps", "espalda+bíceps", "hombro"
  notes           text,
  perceived_effort smallint check (perceived_effort between 1 and 10)
);

create table workout_sets (
  id              uuid primary key default gen_random_uuid(),
  workout_id      uuid not null references workouts(id) on delete cascade,
  exercise_id     uuid not null references exercises(id) on delete restrict,
  set_number      smallint not null,
  weight_kg       numeric(6,2),
  reps            smallint,
  rir             smallint,          -- reps in reserve
  unique (workout_id, exercise_id, set_number)
);

-- =====================================================================
-- RLS — activado desde el día 1 aunque haya un solo usuario
-- =====================================================================

alter table foods                enable row level security;
alter table recipes              enable row level security;
alter table recipe_ingredients   enable row level security;
alter table meal_plans           enable row level security;
alter table cook_sessions        enable row level security;
alter table cook_session_recipes enable row level security;
alter table meal_plan_slots      enable row level security;
alter table body_metrics         enable row level security;
alter table exercises            enable row level security;
alter table workouts             enable row level security;
alter table workout_sets         enable row level security;

-- Tablas con user_id directo
create policy owner_all on foods        for all using (user_id = auth.uid() or user_id is null);
create policy owner_all on recipes      for all using (user_id = auth.uid());
create policy owner_all on meal_plans   for all using (user_id = auth.uid());
create policy owner_all on body_metrics for all using (user_id = auth.uid());
create policy owner_all on exercises    for all using (user_id = auth.uid());
create policy owner_all on workouts     for all using (user_id = auth.uid());

-- Tablas hijas: heredan del padre
create policy owner_all on recipe_ingredients for all using (
  exists (select 1 from recipes r where r.id = recipe_id and r.user_id = auth.uid()));

create policy owner_all on cook_sessions for all using (
  exists (select 1 from meal_plans p where p.id = plan_id and p.user_id = auth.uid()));

create policy owner_all on cook_session_recipes for all using (
  exists (select 1 from cook_sessions cs join meal_plans p on p.id = cs.plan_id
          where cs.id = session_id and p.user_id = auth.uid()));

create policy owner_all on meal_plan_slots for all using (
  exists (select 1 from meal_plans p where p.id = plan_id and p.user_id = auth.uid()));

create policy owner_all on workout_sets for all using (
  exists (select 1 from workouts w where w.id = workout_id and w.user_id = auth.uid()));
