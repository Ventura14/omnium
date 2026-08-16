-- 20260816050000_carbs_convention.sql
-- carbs_100g mezcla dos convenciones dentro de la misma columna:
-- verificado que 54 filas tienen fiber_100g > carbs_100g, matematica-
-- mente imposible si carbs incluyera fibra. El test de Atwater
-- (filtrado a fiber_100g >= 3, para no diluir la media con filas de
-- fibra despreciable) confirma que ninguna formula unica explica bien
-- el catalogo -- la mezcla es real, no un error de medicion.
--
-- No se normaliza el catalogo entero: serian ~900 alimentos que nadie
-- va a comer, corregidos por inferencia, chocando de frente con la
-- regla de no generar datos nutricionales (CLAUDE.md). En su lugar,
-- se hace explicita la convencion por fila, marcando SOLO lo
-- demostrable con una prueba aritmetica, nunca por Atwater (Atwater
-- es una estimacion, no una prueba -- no sirve para clasificar un
-- dato como si fuera un hecho).
--
-- Esta migracion es segura de aplicar sola: el default 'unknown' dej
-- a carbs_total_100g identico a carbs_100g para todas las filas hasta
-- que se corra el UPDATE de clasificacion (migracion aparte, a la
-- espera de confirmacion).

alter table foods add column carbs_convention text not null default 'unknown'
  check (carbs_convention in ('total', 'net', 'unknown'));

-- Columna generada, no hace falta backfill propio: se recalcula sola
-- en cuanto carbs_convention cambia de valor (es una GENERATED STORED,
-- Postgres la recalcula en cada INSERT/UPDATE que toque sus columnas
-- de origen). 'unknown' cae en el mismo caso que 'total': no hay
-- prueba de que haya que sumar la fibra, así que no se inventa.
alter table foods add column carbs_total_100g numeric
  generated always as (
    case
      when carbs_convention = 'net' then carbs_100g + coalesce(fiber_100g, 0)
      else carbs_100g
    end
  ) stored;

-- recipe_macros y compute_recipe_macros pasan a usar carbs_total_100g,
-- nunca carbs_100g directamente -- mismo cambio en los dos sitios que
-- consumen macros de foods.

create or replace view recipe_macros as
select
  r.id as recipe_id,
  r.servings,
  round(sum(ri.grams * f.kcal_100g        / 100), 1) as kcal_total,
  round(sum(ri.grams * f.protein_100g     / 100), 1) as protein_total,
  round(sum(ri.grams * f.carbs_total_100g / 100), 1) as carbs_total,
  round(sum(ri.grams * f.fat_100g         / 100), 1) as fat_total,
  round(sum(ri.grams * f.kcal_100g        / 100) / r.servings, 1) as kcal_per_serving,
  round(sum(ri.grams * f.protein_100g     / 100) / r.servings, 1) as protein_per_serving,
  round(sum(ri.grams * f.carbs_total_100g / 100) / r.servings, 1) as carbs_per_serving,
  round(sum(ri.grams * f.fat_100g         / 100) / r.servings, 1) as fat_per_serving
from recipes r
join recipe_ingredients ri on ri.recipe_id = r.id
join foods f on f.id = ri.food_id
group by r.id, r.servings;

create or replace function compute_recipe_macros(
  p_food_ids uuid[],
  p_grams numeric[],
  p_servings integer
)
returns table (
  kcal_per_serving numeric,
  protein_per_serving numeric,
  carbs_per_serving numeric,
  fat_per_serving numeric
)
language sql
stable
as $$
  select
    round(sum(g.grams * f.kcal_100g        / 100) / p_servings, 1),
    round(sum(g.grams * f.protein_100g     / 100) / p_servings, 1),
    round(sum(g.grams * f.carbs_total_100g / 100) / p_servings, 1),
    round(sum(g.grams * f.fat_100g         / 100) / p_servings, 1)
  from unnest(p_food_ids, p_grams) as g(food_id, grams)
  join foods f on f.id = g.food_id
  where p_servings > 0;
$$;
