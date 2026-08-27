-- 20260903000000_chosen_by_user.sql
-- Mismo patron que carbs_convention_source ('rule' vs 'manual'):
-- products.chosen_by_user marca un producto confirmado a mano por el
-- usuario para su food -- si existe, GANA sin pasar por el ranking
-- (metrica, medido/estimado, desempate).
--
-- OJO con el motivo: esto NO es para revertir lo que el ranking
-- decide cuando el ranking decide bien -- eso se estuvo a punto de
-- hacer aqui mismo con el lomo (creyendo, por error, que el filete de
-- cinta tenia proteina medida real cuando en realidad no tiene ficha
-- propia y hereda el generico de BEDCA; el escalopin SI tiene ficha,
-- 20.00 g medidos, y gana correctamente por la regla
-- medido-gana-a-estimado de 20260827000000 -- la regla funcionaba
-- bien, la premisa para pisarla era la que estaba mal). Esta columna
-- es para preferencias del usuario que ningun criterio automatico
-- puede derivar de los datos -- formato de envase, marca, evitar un
-- aderezo -- y las hace explicitas en vez de forzarlas retorciendo el
-- ranking. Usar con cuidado: cada fila marcada aqui es una apuesta a
-- que el humano sabe algo que los datos no dicen, no un parche para
-- un resultado que no gusta.
alter table products add column chosen_by_user boolean not null default false;

-- cascade: shopping_list (20260902000000) depende de esta vista y se
-- recrea identica al final de esta migracion.
drop view if exists cheapest_dia_proposal cascade;

create or replace view cheapest_dia_proposal as
with base as (
  select
    p.id as product_id,
    p.food_id,
    p.name as product_name,
    p.url,
    pp.price,
    p.pack_size_g,
    p.pack_size_is_approx,
    p.chosen_by_user,
    p.edible_fraction,
    p.kcal_100g_scraped,
    p.kj_100g_scraped,
    p.protein_100g_scraped,
    f.name as food_name,
    f.kcal_100g as food_kcal_100g,
    f.protein_100g as food_protein_100g,
    coalesce(
      p.price_per_kg,
      case when p.pack_size_g is not null and p.pack_size_g > 0
        then round(pp.price / (p.pack_size_g / 1000.0), 4)
        else null
      end
    ) as effective_price_per_kg
  from products p
  join foods f on f.id = p.food_id
  join product_prices pp on pp.product_id = p.id
  where p.store = 'dia'
),
scored as (
  select
    *,
    coalesce(protein_100g_scraped, food_protein_100g) as protein_100g_usada,
    (protein_100g_scraped is null) as proteina_estimada,
    case
      when effective_price_per_kg is null then null
      when edible_fraction is not null then round(effective_price_per_kg / edible_fraction, 4)
      else effective_price_per_kg
    end as price_per_kg_ajustado
  from base
),
scored2 as (
  select
    *,
    case
      when price_per_kg_ajustado is not null and protein_100g_usada > 0
        then round(price_per_kg_ajustado / (protein_100g_usada * 10), 4)
      else null
    end as precio_por_g_proteina
  from scored
),
grupos as (
  select
    *,
    (case when food_protein_100g >= 10 then proteina_estimada else false end) as bloque,
    (case when food_protein_100g >= 10 then precio_por_g_proteina else price_per_kg_ajustado end) as metrica
  from scored2
),
con_flag as (
  select
    *,
    bool_or(chosen_by_user) over (partition by food_id) as food_tiene_eleccion_manual,
    bool_or(metrica is not null) over (partition by food_id, bloque) as grupo_tiene_metrica,
    row_number() over (
      partition by food_id, bloque
      -- A igual metrica, gana el envase mas grande (mejor compra a
      -- igual €/kg). Sin pack_size_g en ninguno de los dos, cae a
      -- precio absoluto MAYOR como proxy de "mas cantidad" -- una
      -- suposicion debil porque hay que elegir algo, no un hecho.
      order by metrica asc nulls last, pack_size_g desc nulls last, price desc
    ) as rn
  from grupos
),
chosen as (
  -- Eleccion manual del usuario: gana sin pasar por metrica, bloque
  -- ni desempate. Si el food no tiene eleccion manual, sigue el flujo
  -- de siempre (medido/estimado, sin_criterio_comparacion).
  select * from con_flag where food_tiene_eleccion_manual and chosen_by_user
  union all
  select * from con_flag where not food_tiene_eleccion_manual and grupo_tiene_metrica and rn = 1
  union all
  select * from con_flag where not food_tiene_eleccion_manual and not grupo_tiene_metrica
),
deduplicado as (
  select
    *,
    case
      when chosen_by_user then 1
      when not grupo_tiene_metrica then 1
      else row_number() over (partition by food_id order by bloque asc)
    end as rn_final
  from chosen
),
anotado as (
  select
    *,
    (not grupo_tiene_metrica and not chosen_by_user) as sin_criterio_comparacion,
    case
      when kcal_100g_scraped is null or food_kcal_100g is null or food_kcal_100g = 0 then 'sin_comprobar'
      when abs(kcal_100g_scraped - food_kcal_100g) / food_kcal_100g > 0.25 then 'desajuste'
      else 'ok'
    end as macro_check,
    exists (
      select 1
      from unnest(string_to_array(normalize_search_name(product_name), ' ')) as pw
      join unnest(string_to_array(normalize_search_name(food_name), ' ')) as fw on pw = fw
      where length(pw) > 1
    ) as nombre_solapa,
    (
      kcal_100g_scraped is not null and kj_100g_scraped is not null
      and (
        (kcal_100g_scraped = 0 and kj_100g_scraped > 0)
        or abs(kcal_100g_scraped * 4.184 - kj_100g_scraped) > 0.10 * kj_100g_scraped
      )
    ) as kj_contradiction
  from deduplicado
  where rn_final = 1
)
select
  food_id,
  food_name,
  product_id,
  product_name,
  url,
  price,
  pack_size_g,
  pack_size_is_approx,
  chosen_by_user,
  edible_fraction,
  effective_price_per_kg,
  price_per_kg_ajustado,
  sin_criterio_comparacion,
  food_protein_100g,
  protein_100g_scraped,
  proteina_estimada,
  precio_por_g_proteina,
  kcal_100g_scraped,
  kj_100g_scraped,
  food_kcal_100g,
  macro_check,
  nombre_solapa,
  kj_contradiction,
  array_remove(array[
    case when chosen_by_user then
      'producto confirmado a mano por el usuario -- no pasa por el ranking automatico'
    end,
    case when sin_criterio_comparacion then
      'sin price_per_kg ni pack_size_g confirmado -- todos los candidatos de este alimento se muestran sin elegir ninguno'
    end,
    case when pack_size_is_approx then
      'peso de envase aproximado (Dia lo marca "Aprox." -- puede variar entre unidades, packs_to_buy es orientativo)'
    end,
    case when macro_check = 'desajuste' then
      format('macros: %s vs %s kcal/100g (%s%% de diferencia)',
        kcal_100g_scraped, food_kcal_100g,
        round(abs(kcal_100g_scraped - food_kcal_100g) / food_kcal_100g * 100))
    end,
    case when macro_check = 'sin_comprobar' then
      'sin ficha nutricional en Dia para comparar los macros'
    end,
    case when not nombre_solapa then
      'el nombre del producto no comparte ninguna palabra con el alimento'
    end,
    case when kj_contradiction then
      'kcal y kJ del producto se contradicen'
    end,
    case when proteina_estimada and food_protein_100g >= 10 and not sin_criterio_comparacion and not chosen_by_user then
      'sin proteina propia en la ficha -- no habia candidato medido para este alimento, se usa la proteina del food (BEDCA), no la del producto'
    end,
    case when not proteina_estimada and food_protein_100g >= 10 and not sin_criterio_comparacion and not chosen_by_user then
      'proteina medida en la ficha de Dia (candidato "medido") -- se prefiere sobre cualquier candidato estimado del mismo alimento'
    end
  ], null) as motivos
from anotado
order by
  case
    when sin_criterio_comparacion then 0
    when macro_check = 'desajuste' then 1
    when macro_check = 'sin_comprobar' or not nombre_solapa or kj_contradiction then 2
    else 3
  end,
  food_name,
  proteina_estimada;

-- shopping_list se recrea identica -- el cascade de arriba la borro
-- porque depende de cheapest_dia_proposal (definicion igual a
-- 20260902000000_shopping_list.sql).
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
  case when packs_to_buy is not null and packs_to_buy * pack_size_g > 0
    then round((packs_to_buy * pack_size_g - grams_needed) / (packs_to_buy * pack_size_g) * 100, 1)
  end as leftover_pct,
  (product_name is null or pack_size_g is null) as needs_manual_check
from calculado
order by plan_id, (packs_to_buy * precio_envase) desc nulls last;
