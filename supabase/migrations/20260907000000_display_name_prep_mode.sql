-- 20260907000000_display_name_prep_mode.sql
-- Fase 5c, continuacion. Dos piezas para que /compra (y /semana) se
-- lean de un vistazo en vez de con sintaxis de catalogo cientifico.

-- foods.display_name: nombre corto para UI. Probado antes de
-- escribir esto que cortar por la primera coma de BEDCA falla en 5
-- de 25 casos, uno de ellos una colision real ("Huevo de gallina,
-- clara, cruda" y "Huevo de gallina fresco" darian el mismo nombre
-- corto) -- por eso columna explicita, no heuristica de texto.
--
-- display_name describe LO QUE SE COMPRA, no repite el nombre de
-- BEDCA a secas: cuando BEDCA y el producto real coinciden, se
-- conserva el detalle que distingue producto en el lineal (virgen
-- extra vs refinado, bajo en grasa vs normal, 0% vs entero). Cuando
-- el nombre de BEDCA es un ERROR heredado del catalogo -- caso
-- verificado, no hipotetico: "Nuez, cruda, con cascara" declara 59 g
-- de grasa/100g, que son macros de grano PELADO (la cascara no tiene
-- grasa), y "Pollo, pechuga, con piel, crudo" declara 1.20 g de
-- grasa, que es el valor de pechuga SIN piel (documentado en
-- CLAUDE.md como ejemplo de nombre que no describe su contenido) --
-- display_name corrige, no repite el error. Nullable, sin default:
-- un alimento sin display_name muestra `name` tal cual (regla 15).
alter table foods add column display_name text;

-- prep_mode NO es una columna nueva: se deriva de recipes.suits, que
-- ya distingue esto sin ambiguedad para las 14 recetas del catalogo
-- (ninguna mezcla los dos grupos). Comida/cena (batch, se cocina en
-- tanda el domingo) y media-manana/merienda (al_momento, se monta el
-- mismo dia) son categorias estructuralmente distintas en como vive
-- este usuario, no una coincidencia fragil de los datos actuales --
-- guardarlo en columna duplicaria un dato que suits ya determina.
--
-- create_cook_session() NO cambia: sigue usando todas las filas de
-- plan_cook_batches sin filtrar -- la contabilidad de plan_balance ya
-- funcionaba bien, lo que mentia era la presentacion al humano en
-- "Cocinar el domingo" (mostraba las 4 recetas de ingesta fija como
-- si hubiera que prepararlas en tanda, cuando se montan cada dia).
-- drop porque OUT params cambian (se añade prep_mode) -- create or
-- replace no permite eso, igual que con las vistas. Cascade porque
-- shopping_list (y plan_cost_summary, que depende de shopping_list)
-- llaman a esta funcion -- las dos se recrean identicas mas abajo,
-- shopping_list con una columna display_name añadida.
drop function if exists plan_cook_batches(uuid) cascade;

create or replace function plan_cook_batches(p_plan_id uuid)
returns table (
  recipe_id           uuid,
  recipe_name         text,
  servings_per_batch  integer,
  servings_consumed   numeric,
  tandas              integer,
  servings_produced   numeric,
  servings_leftover   numeric,
  prep_mode           text
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
    ceil(sum(mps.servings) / r.servings) * r.servings - sum(mps.servings) as servings_leftover,
    case
      when r.suits && array['lunch','dinner']::meal_type[] then 'batch'
      when r.suits && array['midmorning','snack']::meal_type[] then 'al_momento'
      else null
    end as prep_mode
  from meal_plan_slots mps
  join recipes r on r.id = mps.recipe_id
  where mps.plan_id = p_plan_id
    and mps.recipe_id is not null
    and not mps.eating_out
  group by r.id, r.name, r.servings, r.suits;
$$;

-- shopping_list se recrea identica (el cascade de arriba la borro),
-- con una columna display_name añadida -- coalesce(f.display_name,
-- f.name), misma logica de fallback que la propia columna.
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
    coalesce(f.display_name, f.name) as display_name,
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
  display_name,
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

-- Los dos totales que pinta /compra, uno por plan -- se recrea
-- identica (dependia de shopping_list, borrada por el cascade).
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
