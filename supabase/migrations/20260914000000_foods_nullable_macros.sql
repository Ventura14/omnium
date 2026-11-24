-- 20260914000000_foods_nullable_macros.sql
--
-- Bloqueaba la carga de los alimentos del ticket del 2026-09-13:
-- foods.kcal_100g/protein_100g/carbs_100g/fat_100g eran NOT NULL sin
-- default, y el esquema no podia representar "existe el alimento,
-- la etiqueta todavia no" -- exactamente lo que la regla 15 exige
-- poder decir.
--
-- Quitar el NOT NULL a secas habria abierto un agujero peor: tanto
-- recipe_macros como compute_recipe_macros suman con sum(), y sum()
-- en SQL IGNORA los NULL en vez de propagarlos. Una receta con un
-- ingrediente de macros desconocidos habria dado un total mas bajo
-- de lo real, en silencio, sin ningun aviso -- el mismo patron que
-- esta regla existe para impedir, introducido por arreglar el
-- primero. Las dos vistas/funciones se reescriben aqui juntas: si
-- CUALQUIER ingrediente de la receta tiene una macro NULL, el total
-- de esa macro sale NULL (nunca un numero parcial), y se anade
-- missing_macro_foods con los nombres de los alimentos responsables
-- -- la diferencia entre una tarjeta vacia sin explicacion y "manda
-- foto del pan de molde".
--
-- Verificado tambien (no solo asumido) que esto no deja huecos en
-- otros consumidores de estas 4 columnas:
--   - cheapest_dia_proposal: coalesce(protein_100g_scraped,
--     food_protein_100g) referenciado en UNA vista, no en varias.
--     Arreglado aparte en 20260912000000 (bloque/metrica pasan a
--     NULL cuando food_protein_100g es NULL, en vez de caer en el
--     ELSE `false` y rankear sin criterio real sin marcarlo).
--   - foods_energy_check.energy_impossible: es una columna de vista,
--     no un CHECK real. La comparacion aritmetica con un operando
--     NULL da NULL, no true/false -- una fila con macros
--     desconocidas sale con energy_impossible en NULL, ni oculta un
--     problema ni lo inventa. No requiere cambio.
--
-- Deuda anotada, NO arreglada hoy (mismo bicho, un año mas viejo):
-- foods.cooked_yield tiene DEFAULT 1.00, que es el mismo patron que
-- este NOT NULL -- una merma sin medir presentada como "no hay
-- perdida" en vez de como "no lo sé". Se deja así a proposito: cada
-- arreglo de este tipo se hace de uno en uno para poder saber cual
-- rompio algo si algo rompe.
comment on column foods.cooked_yield is
  'DEUDA (regla 15): DEFAULT 1.00 presenta "sin medir" como "sin '
  'perdida". Mismo patron que el NOT NULL de kcal_100g/protein_100g/'
  'carbs_100g/fat_100g, corregido en 20260914000000 -- este todavia '
  'no. No arreglar de pasada; su propia migracion cuando toque.';

alter table foods alter column kcal_100g drop not null;
alter table foods alter column protein_100g drop not null;
alter table foods alter column carbs_100g drop not null;
alter table foods alter column fat_100g drop not null;

drop function if exists compute_recipe_macros(uuid[], numeric[], integer);

create function compute_recipe_macros(p_food_ids uuid[], p_grams numeric[], p_servings integer)
returns table(
  kcal_per_serving numeric,
  protein_per_serving numeric,
  carbs_per_serving numeric,
  fat_per_serving numeric,
  missing_macro_foods text[]
)
language sql
stable
as $$
  -- sum() por si solo IGNORA los NULL en vez de propagarlos -- por
  -- eso cada total pasa por el bool_or de abajo antes de sumar: si
  -- CUALQUIER ingrediente tiene esa macro en NULL, el total sale
  -- NULL, nunca un numero que calla el que falta.
  with ingredientes as (
    select f.name, f.kcal_100g, f.protein_100g, f.carbs_total_100g, f.fat_100g, g.grams
    from unnest(p_food_ids, p_grams) as g(food_id, grams)
    join foods f on f.id = g.food_id
  )
  select
    case when bool_or(kcal_100g is null) then null
         else round(sum(grams * kcal_100g / 100) / p_servings, 1) end,
    case when bool_or(protein_100g is null) then null
         else round(sum(grams * protein_100g / 100) / p_servings, 1) end,
    case when bool_or(carbs_total_100g is null) then null
         else round(sum(grams * carbs_total_100g / 100) / p_servings, 1) end,
    case when bool_or(fat_100g is null) then null
         else round(sum(grams * fat_100g / 100) / p_servings, 1) end,
    nullif(
      array_agg(name) filter (
        where kcal_100g is null or protein_100g is null
           or carbs_total_100g is null or fat_100g is null
      ),
      '{}'
    )
  from ingredientes
  where p_servings > 0;
$$;

-- recipe_fit y plan_day_totals dependen de recipe_macros -- CASCADE
-- las tira tambien, las dos se recrean debajo. plan_day_totals tenia
-- EL MISMO agujero que compute_recipe_macros/recipe_macros: sumaba
-- `mps.servings * rm.kcal_per_serving` dentro de un sum(), y si
-- rm.kcal_per_serving llega NULL (receta con un ingrediente sin
-- macros), sum() se lo salta -- el total del dia habria bajado en
-- silencio, no habria fallado. Encontrado al revisar los
-- consumidores de recipe_macros, no solo los de foods directamente
-- -- mismo patron, un nivel mas arriba. recipe_fit no necesita
-- cambio: sus columnas son resta/division sobre lo que devuelve
-- recipe_macros, y esa aritmetica ya propaga NULL sola.
drop view if exists recipe_macros cascade;

create view recipe_macros with (security_invoker = true) as
with por_ingrediente as (
  select
    r.id as recipe_id,
    r.servings,
    f.name as food_name,
    ri.grams,
    f.kcal_100g,
    f.protein_100g,
    f.carbs_total_100g,
    f.fat_100g
  from recipes r
  join recipe_ingredients ri on ri.recipe_id = r.id
  join foods f on f.id = ri.food_id
)
select
  recipe_id,
  servings,
  case when bool_or(kcal_100g is null) then null
       else round(sum(grams * kcal_100g / 100), 1) end as kcal_total,
  case when bool_or(protein_100g is null) then null
       else round(sum(grams * protein_100g / 100), 1) end as protein_total,
  case when bool_or(carbs_total_100g is null) then null
       else round(sum(grams * carbs_total_100g / 100), 1) end as carbs_total,
  case when bool_or(fat_100g is null) then null
       else round(sum(grams * fat_100g / 100), 1) end as fat_total,
  case when bool_or(kcal_100g is null) then null
       else round(sum(grams * kcal_100g / 100) / servings, 1) end as kcal_per_serving,
  case when bool_or(protein_100g is null) then null
       else round(sum(grams * protein_100g / 100) / servings, 1) end as protein_per_serving,
  case when bool_or(carbs_total_100g is null) then null
       else round(sum(grams * carbs_total_100g / 100) / servings, 1) end as carbs_per_serving,
  case when bool_or(fat_100g is null) then null
       else round(sum(grams * fat_100g / 100) / servings, 1) end as fat_per_serving,
  nullif(
    array_agg(food_name) filter (
      where kcal_100g is null or protein_100g is null
         or carbs_total_100g is null or fat_100g is null
    ),
    '{}'
  ) as missing_macro_foods
from por_ingrediente
group by recipe_id, servings;

create view recipe_fit with (security_invoker = true) as
select
  rm.recipe_id,
  r.name,
  rm.servings,
  rm.kcal_per_serving,
  rm.protein_per_serving,
  rm.fat_per_serving,
  rm.carbs_per_serving,
  round(rm.protein_per_serving - 35, 1) as protein_gap,
  round(rm.fat_per_serving - 22, 1) as fat_excess,
  round(100 * rm.protein_per_serving / nullif(rm.kcal_per_serving, 0), 2) as protein_per_100kcal,
  round(100 * 9 * rm.fat_per_serving / nullif(rm.kcal_per_serving, 0), 1) as fat_pct_kcal
from recipe_macros rm
join recipes r on r.id = rm.recipe_id;

create view plan_day_totals with (security_invoker = true) as
select
  mps.plan_id,
  mps.slot_date,
  case when bool_or(mps.recipe_id is not null and not mps.eating_out and rm.kcal_per_serving is null)
    then null
    else round(sum(case when mps.recipe_id is not null and not mps.eating_out
      then mps.servings * rm.kcal_per_serving else 0 end), 1)
  end as kcal,
  case when bool_or(mps.recipe_id is not null and not mps.eating_out and rm.protein_per_serving is null)
    then null
    else round(sum(case when mps.recipe_id is not null and not mps.eating_out
      then mps.servings * rm.protein_per_serving else 0 end), 1)
  end as protein,
  case when bool_or(mps.recipe_id is not null and not mps.eating_out and rm.fat_per_serving is null)
    then null
    else round(sum(case when mps.recipe_id is not null and not mps.eating_out
      then mps.servings * rm.fat_per_serving else 0 end), 1)
  end as fat,
  case when bool_or(mps.recipe_id is not null and not mps.eating_out and rm.carbs_per_serving is null)
    then null
    else round(sum(case when mps.recipe_id is not null and not mps.eating_out
      then mps.servings * rm.carbs_per_serving else 0 end), 1)
  end as carbs,
  mp.target_kcal,
  mp.target_protein,
  case when bool_or(mps.recipe_id is not null and not mps.eating_out and rm.kcal_per_serving is null)
    then null
    else round(sum(case when mps.recipe_id is not null and not mps.eating_out
      then mps.servings * rm.kcal_per_serving else 0 end) - mp.target_kcal, 1)
  end as kcal_gap,
  case when bool_or(mps.recipe_id is not null and not mps.eating_out and rm.protein_per_serving is null)
    then null
    else round(sum(case when mps.recipe_id is not null and not mps.eating_out
      then mps.servings * rm.protein_per_serving else 0 end) - mp.target_protein, 1)
  end as protein_gap,
  count(*) filter (where mps.eating_out) as meals_out,
  count(*) filter (where mps.recipe_id is null and not mps.eating_out) as slots_vacios,
  -- huecos que SI tienen receta pero cuya receta tiene un ingrediente
  -- sin macros -- distinto de slots_vacios (sin receta) y de
  -- meals_out (fuera de casa): aqui SI hay un plan, solo que el
  -- total del dia no se puede calcular con lo que hay.
  count(*) filter (where mps.recipe_id is not null and not mps.eating_out
    and rm.missing_macro_foods is not null) as slots_macro_incompletos
from meal_plan_slots mps
join meal_plans mp on mp.id = mps.plan_id
left join recipe_macros rm on rm.recipe_id = mps.recipe_id
group by mps.plan_id, mps.slot_date, mp.target_kcal, mp.target_protein;
