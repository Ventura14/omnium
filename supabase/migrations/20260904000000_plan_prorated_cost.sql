-- 20260904000000_plan_prorated_cost.sql
-- La pantalla /compra tiene que enseñar DOS totales, no uno --
-- "coste en caja" (envases enteros, shopping_list) y "coste
-- prorrateado" (lo que valen los gramos que de verdad te comes, sin
-- redondear a paquete). El prorrateado se calculo varias veces con
-- scripts sueltos durante la Fase 7 pero nunca quedo en una vista --
-- regla dura 1, nada de esta aritmetica se hace en TypeScript, asi
-- que hace falta una vista real antes de poder pintarla.
--
-- OJO: grams_needed aqui es CONSUMO real (via meal_plan_slots,
-- gramos que de verdad se comen esa semana), no produccion en tandas
-- completas como en shopping_list -- son dos magnitudes distintas a
-- proposito (ver comentario de shopping_list, 20260902000000).
create or replace view plan_prorated_cost as
with grams_consumidos as (
  select
    mps.plan_id,
    ri.food_id,
    sum(ri.grams * mps.servings / r.servings) as grams
  from meal_plan_slots mps
  join recipes r on r.id = mps.recipe_id
  join recipe_ingredients ri on ri.recipe_id = r.id
  where mps.recipe_id is not null
    and not mps.eating_out
  group by mps.plan_id, ri.food_id
)
select
  gc.plan_id,
  gc.food_id,
  f.name as food_name,
  gc.grams,
  cdp.price_per_kg_ajustado,
  case when cdp.price_per_kg_ajustado is not null
    then round(gc.grams / 1000.0 * cdp.price_per_kg_ajustado, 4)
  end as cost,
  (cdp.food_id is null or cdp.sin_criterio_comparacion) as needs_manual_check
from grams_consumidos gc
join foods f on f.id = gc.food_id
left join cheapest_dia_proposal cdp
  on cdp.food_id = gc.food_id and cdp.sin_criterio_comparacion = false;

-- chosen_by_user no llegaba a shopping_list -- /compra necesita
-- marcarlo visualmente (misma razon que pack_size_is_approx, que si
-- pasaba). Se recrea identica salvo esa columna añadida -- drop
-- porque el orden de columnas cambia respecto a 20260903000000. Va
-- antes de plan_cost_summary porque esa vista depende de esta.
drop view if exists shopping_list;

create or replace view shopping_list as
with batches as (
  select mp.id as plan_id, b.*
  from meal_plans mp
  cross join lateral plan_cook_batches(mp.id) b
),
grams as (
  select
    ba.plan_id,
    ri.food_id,
    sum(ri.grams * ba.tandas) as grams_needed
  from batches ba
  join recipe_ingredients ri on ri.recipe_id = ba.recipe_id
  group by ba.plan_id, ri.food_id
),
priced as (
  select cdp.food_id, cdp.product_name, cdp.price, cdp.pack_size_g, cdp.pack_size_is_approx, cdp.chosen_by_user
  from cheapest_dia_proposal cdp
  where cdp.sin_criterio_comparacion = false
),
calculado as (
  select
    g.plan_id,
    f.id as food_id,
    f.name as food_name,
    g.grams_needed,
    p.product_name,
    case when p.product_name is not null then 'dia' end as store,
    p.price as precio_envase,
    p.pack_size_g,
    p.pack_size_is_approx,
    coalesce(p.chosen_by_user, false) as chosen_by_user,
    case when p.pack_size_g is not null and p.pack_size_g > 0
      then ceil(round(g.grams_needed / p.pack_size_g, 2))::integer
    end as packs_to_buy
  from grams g
  join foods f on f.id = g.food_id
  left join priced p on p.food_id = g.food_id
)
select
  plan_id,
  food_id,
  food_name,
  grams_needed,
  product_name,
  store,
  precio_envase,
  pack_size_g,
  pack_size_is_approx,
  chosen_by_user,
  packs_to_buy,
  case when packs_to_buy is not null
    then round(packs_to_buy * precio_envase, 2)
  end as estimated_cost,
  case when packs_to_buy is not null
    then round(packs_to_buy * pack_size_g - grams_needed, 2)
  end as grams_leftover,
  case when packs_to_buy is not null and packs_to_buy * pack_size_g > 0
    then round((packs_to_buy * pack_size_g - grams_needed) / (packs_to_buy * pack_size_g) * 100, 1)
  end as leftover_pct,
  (product_name is null or pack_size_g is null) as needs_manual_check
from calculado
order by plan_id, (packs_to_buy * precio_envase) desc nulls last;

-- Los dos totales que pinta /compra, uno por plan -- la suma vive
-- aqui (regla dura 1) para que la pagina no sume filas en TypeScript.
create or replace view plan_cost_summary as
select
  coalesce(sl.plan_id, ppc.plan_id) as plan_id,
  sl.box_total,
  ppc.prorated_total
from (
  select plan_id, sum(estimated_cost) as box_total
  from shopping_list
  group by plan_id
) sl
full outer join (
  select plan_id, sum(cost) as prorated_total
  from plan_prorated_cost
  group by plan_id
) ppc on sl.plan_id = ppc.plan_id;
