-- 20260831000000_shopping_list.sql
-- Fase 5. La lista de la compra NO sale de lo que se consume
-- (meal_plan_slots), sale de lo que se COCINA -- produccion y
-- consumo estan desacoplados (CLAUDE.md). Una receta de 4
-- raciones/tanda consumida 3 veces esa semana obliga a cocinar una
-- tanda ENTERA de 4, no 3 raciones sueltas.

-- Por cada receta de un plan: cuantas tandas hacen falta para cubrir
-- el consumo real (excluye comer fuera y huecos sin receta), cuanto
-- se produce de mas.
create or replace function plan_cook_batches(p_plan_id uuid)
returns table (
  recipe_id           uuid,
  recipe_name         text,
  servings_per_batch  integer,
  servings_consumed   numeric,
  tandas              integer,
  servings_produced   numeric,
  servings_leftover   numeric
)
language sql
stable
as $$
  select
    r.id,
    r.name,
    r.servings,
    sum(mps.servings) as servings_consumed,
    ceil(sum(mps.servings) / r.servings)::integer as tandas,
    ceil(sum(mps.servings) / r.servings) * r.servings as servings_produced,
    ceil(sum(mps.servings) / r.servings) * r.servings - sum(mps.servings) as servings_leftover
  from meal_plan_slots mps
  join recipes r on r.id = mps.recipe_id
  where mps.plan_id = p_plan_id
    and mps.recipe_id is not null
    and not mps.eating_out
  group by r.id, r.name, r.servings;
$$;

-- Crea la cook_session del domingo y la rellena con las tandas de
-- plan_cook_batches -- las tablas cook_sessions/cook_session_recipes
-- existen desde el primer dia (20260815000000) y hasta ahora nunca
-- se habian escrito.
create or replace function create_cook_session(p_plan_id uuid, p_cook_date date)
returns uuid
language plpgsql
as $$
declare
  v_session_id uuid;
begin
  insert into cook_sessions (plan_id, cook_date)
  values (p_plan_id, p_cook_date)
  returning id into v_session_id;

  insert into cook_session_recipes (session_id, recipe_id, servings_produced)
  select v_session_id, b.recipe_id, b.servings_produced
  from plan_cook_batches(p_plan_id) b;

  return v_session_id;
end;
$$;

-- Una fila por (plan, alimento). grams_needed es lo que hace falta
-- para las tandas COMPLETAS (plan_cook_batches), no para las raciones
-- consumidas -- por eso puede no coincidir con basket_cost/coste
-- prorrateado. packs_to_buy es el corazon de la fase: no se compran
-- gramos sueltos, se compran envases enteros -- el coste real de la
-- compra (estimated_cost) es SIEMPRE >= al coste prorrateado por
-- gramo, nunca al reves.
--
-- packs_to_buy redondea el COCIENTE antes de aplicar ceil, no el
-- peso. pack_size_g derivado de price/price_per_unit arrastra hasta
-- ~1% de error por el redondeo a 2 decimales que hace Dia en
-- price_per_unit (ver 20260901000000) -- un ceil crudo sobre ese
-- error sobreestima en los casos limite. Caso real: "Patatas 4 Kg"
-- deriva a 3992 g (el envase real son 4000); necesitar exactamente
-- 4000 g da ceil(4000/3992)=2 paquetes con el ceil crudo, y
-- ceil(round(4000/3992,2))=ceil(1.00)=1 con el cociente redondeado.
-- Redondear a 2 decimales absorbe el error de redondeo sin ocultar
-- una diferencia real (4700/3992=1.177 -> 1.18 -> ceil -> 2 sigue
-- dando 2, correcto).
--
-- Solo usa candidatos de cheapest_dia_proposal con
-- sin_criterio_comparacion = false -- si el alimento no tiene ganador
-- claro (huevos, hoy) o no tiene ningun producto Dia enlazado,
-- needs_manual_check queda en true y packs_to_buy/estimated_cost en
-- null. No se inventa un envase que no esta confirmado.
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
  select cdp.food_id, cdp.product_name, cdp.price, cdp.pack_size_g, cdp.pack_size_is_approx
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
  packs_to_buy,
  case when packs_to_buy is not null
    then round(packs_to_buy * precio_envase, 2)
  end as estimated_cost,
  case when packs_to_buy is not null
    then round(packs_to_buy * pack_size_g - grams_needed, 2)
  end as grams_leftover,
  -- Porcentaje del comprado que sobra -- una señal visible aunque no
  -- se sepa si ese sobrante se aguanta (stock) o se estropea
  -- (perdida). No distingue las dos cosas -- ver NOTES_shopping_list.md.
  case when packs_to_buy is not null and packs_to_buy * pack_size_g > 0
    then round((packs_to_buy * pack_size_g - grams_needed) / (packs_to_buy * pack_size_g) * 100, 1)
  end as leftover_pct,
  (product_name is null or pack_size_g is null) as needs_manual_check
from calculado
order by plan_id, (packs_to_buy * precio_envase) desc nulls last;
