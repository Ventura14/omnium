-- 20260912000000_channel_aware_pricing.sql
-- Cargar precios reales de Glovo para los mismos productos que ya
-- tienen precio presencial destapo un fallo real, comprobado en
-- vivo antes de aplicar nada (dry-run con 2 productos, revertido):
-- cheapest_dia_proposal no distinguia canal en absoluto. Con dos
-- filas de product_prices para el mismo product_id (una por canal),
-- la vista o bien duplicaba la fila (precios iguales, caso
-- Patatas 4 Kg) o peor, se quedaba con UNA sola fila mezclando un
-- `price` de un canal con un `price_per_kg_ajustado` calculado con
-- el `price_per_kg` de OTRO canal (caso Champiñones: price=1.15 de
-- Glovo, price_per_kg_ajustado=5.41 heredado del presencial) -- dos
-- numeros que ya no describian la misma compra, pegados en la misma
-- fila sin ninguna marca de que no correspondian.
--
-- LA CAUSA RAIZ: products.price_per_kg nunca fue un dato del
-- producto. Es el €/kg del CANAL PRESENCIAL, congelado en el scrape
-- original de dia.es, guardado en una columna cuyo nombre no lo
-- dice -- mismo patron que ya nos mordio con carbs_100g (mezclaba
-- convenciones), user_id (dos significados segun la tabla) y el
-- peso del envase contra el peso escurrido. price_per_kg de verdad
-- se deriva de dos datos que SI son lo que dicen ser:
--   pack_size_g       -- del producto, el envase pesa igual en cualquier canal
--   product_prices.price -- del canal, cambia segun donde se compre
--
-- products.price_per_kg NO se borra en esta migracion (una columna
-- que se borra a la vez que se cambia la vista que la usaba hace
-- imposible saber cual de los dos rompio algo si algo rompe) -- se
-- marca obsoleta en su comentario, se borra en una migracion
-- posterior cuando se confirme que nadie mas la lee.
--
-- Efecto secundario real de este cambio, no pedido explicitamente
-- pero inevitable: en cuanto cheapest_dia_proposal devuelve una fila
-- POR CANAL, shopping_list y plan_prorated_cost (que hasta ahora
-- asumian una fila por alimento) se duplicarian igual que la propia
-- cheapest_dia_proposal lo hacia antes de este arreglo. Las dos se
-- acotan aqui al canal presencial -- es como compra el usuario hoy,
-- y la version multi-canal de /compra es trabajo aparte, ya
-- identificado, no de esta migracion.
comment on column products.price_per_kg is
  'OBSOLETA -- este valor es el €/kg del canal PRESENCIAL en el '
  'momento del scrape, no un dato del producto. cheapest_dia_proposal '
  'ya no lo lee: deriva effective_price_per_kg de product_prices.price '
  '/ (pack_size_g/1000) por canal. Se mantiene sin borrar hasta '
  'confirmar que nada mas la usa (20260912000000).';

-- ADVERTENCIA (2026-09-14), no resuelta, solo documentada: con
-- price_per_kg fuera de la formula, pack_size_g pasa a ser el UNICO
-- dato que fija effective_price_per_kg para todo el catalogo. Tiene
-- que seguir siendo el peso DECLARADO por Dia (el que Dia uso para
-- construir su propio precio), nunca el peso REAL confirmado por
-- ticket o balanza -- si algun dia se "corrige" pack_size_g de un
-- producto de precio fijo con un peso mas exacto salido de
-- product_weight_observations, effective_price_per_kg se rompe en
-- silencio (el precio del envase no cambia con el peso real, solo
-- lo que compraste). product_weight_observations existe para saber
-- cuanta comida entra en casa, nunca para escribir en pack_size_g.
comment on column products.pack_size_g is
  'Peso DECLARADO por Dia (el "aprox." de la ficha), no el real '
  'confirmado por ticket/balanza -- desde 20260912000000 es el unico '
  'dato que fija effective_price_per_kg para productos de precio '
  'fijo. NUNCA sobrescribir con un valor de product_weight_observations: '
  'el precio del envase se fijo sobre el peso declarado, no sobre el '
  'real, y corregirlo aqui rompe el ranking de €/kg en silencio.';

drop view if exists plan_prorated_cost cascade;
drop view if exists shopping_list cascade;
drop view if exists cheapest_dia_proposal cascade;

create or replace view cheapest_dia_proposal with (security_invoker = true) as
with base as (
  select
    p.id as product_id,
    p.food_id,
    p.name as product_name,
    p.url,
    p.image_path,
    pp.channel_id,
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
    case
      when p.pack_size_g is not null and p.pack_size_g > 0
        then round(pp.price / (p.pack_size_g / 1000.0), 4)
      else null
    end as effective_price_per_kg
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
    -- food_protein_100g NULL (alimento nuevo, etiqueta pendiente,
    -- verificado 2026-09-14) es un caso distinto de "por debajo de
    -- 10 g/100g": no es que sepamos que la proteina es baja, es que
    -- no sabemos nada. `>= 10` con NULL da NULL, y el CASE caia por
    -- el ELSE a `false` -- clasificaba en silencio como "proteina
    -- irrelevante" y rankeaba solo por precio_per_kg, sin disparar
    -- sin_criterio_comparacion (grupo_tiene_metrica salia true
    -- igualmente, porque price_per_kg_ajustado si existe). Con
    -- bloque y metrica en NULL, grupo_tiene_metrica sale false para
    -- ese food y sin_criterio_comparacion se dispara como debe.
    (case
      when food_protein_100g is null then null
      when food_protein_100g >= 10 then proteina_estimada
      else false
    end) as bloque,
    (case
      when food_protein_100g is null then null
      when food_protein_100g >= 10 then precio_por_g_proteina
      else price_per_kg_ajustado
    end) as metrica
  from scored2
),
con_flag as (
  select
    *,
    -- particionado tambien por channel_id: el mejor candidato se
    -- decide DENTRO de cada canal, un producto de Glovo nunca
    -- compite contra uno presencial por el mismo food.
    bool_or(chosen_by_user) over (partition by food_id, channel_id) as food_tiene_eleccion_manual,
    bool_or(metrica is not null) over (partition by food_id, channel_id, bloque) as grupo_tiene_metrica,
    row_number() over (
      partition by food_id, channel_id, bloque
      order by metrica asc nulls last, pack_size_g desc nulls last, price desc
    ) as rn
  from grupos
),
chosen as (
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
      else row_number() over (partition by food_id, channel_id order by bloque asc)
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
  channel_id,
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
  ], null) as motivos,
  image_path
from anotado
order by
  case
    when sin_criterio_comparacion then 0
    when macro_check = 'desajuste' then 1
    when macro_check = 'sin_comprobar' or not nombre_solapa or kj_contradiction then 2
    else 3
  end,
  food_name,
  channel_id,
  proteina_estimada;

-- shopping_list y plan_prorated_cost se recrean identicas salvo un
-- filtro nuevo: cdp.channel_id = presencial. Acotado a proposito --
-- comprar en Glovo es un flujo distinto que todavia no existe en
-- /compra, y sin este filtro las dos vistas volverian a duplicar
-- filas por canal, el mismo problema que se acaba de arreglar en
-- cheapest_dia_proposal, un nivel mas abajo.
create or replace view shopping_list with (security_invoker = true) as
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
  join channels c on c.id = cdp.channel_id
  where cdp.sin_criterio_comparacion = false
    and c.store = 'dia' and c.channel = 'presencial'
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

create or replace view plan_prorated_cost with (security_invoker = true) as
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
  on cdp.food_id = gc.food_id and cdp.sin_criterio_comparacion = false
  and cdp.channel_id in (select id from channels where store = 'dia' and channel = 'presencial');

create or replace view plan_cost_summary with (security_invoker = true) as
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
