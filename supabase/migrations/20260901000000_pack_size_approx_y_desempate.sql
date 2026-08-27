-- 20260901000000_pack_size_approx_y_desempate.sql
--
-- pack_size_is_approx: dia.py no trae ningun campo de peso propio
-- (weight/size/quantity no existen en el JSON scrapeado -- solo
-- measure_unit + price + price_per_unit). Pero cuando measure_unit
-- es KILO, price / price_per_unit es una derivacion aritmetica sobre
-- dos campos ESTRUCTURADOS que Dia publica como datos, no texto --
-- coincide con el peso del titulo al gramo en decenas de productos
-- comprobados. Cuando el titulo trae "Aprox." (el propio formato de
-- Dia lo marca, no es una lectura mia del marketing), ese numero es
-- el peso de la unidad concreta que se vendio el dia del scrape, no
-- una constante de catalogo -- un re-scrape puede dar otro numero.
-- Se guarda igual pero marcado.
--
-- Conservas y piezas con hueso/piel (reglas 8 y 14) NO se derivan
-- aqui aunque tengan price_per_kg: ese numero seria el peso del
-- ENVASE, no el escurrido ni la fraccion comestible, que es lo que
-- de verdad importa en esas reglas -- se rellenan solo a mano, sin
-- excepcion. La exclusion en el script de carga es por nombre
-- (rodaja, chuleta, con piel, con hueso, en lata, conserva,
-- escurrid) -- un heuristico de nombre usado SOLO para retirar
-- automatismo, nunca para concederlo, coherente con que no existe
-- señal estructural que distinga esto (por eso existen las reglas).
alter table products add column pack_size_is_approx boolean not null default false;

-- Desempate de cheapest_dia_proposal: cuando dos candidatos empatan
-- en €/kg (mismo error que ya se corrigio al rankear sin metrica --
-- 20260828000000), desempatar por precio absoluto ASCENDENTE premia
-- el envase pequeño. A igual €/kg el envase mas GRANDE es mejor
-- compra (menos viajes, mismo coste por gramo). Caso real: "Patatas
-- 4 Kg" y "Patatas para freir 2 Kg" empatan a 1.25 €/kg -- el
-- desempate antiguo elegia el de 2 Kg por ser mas barato en
-- absoluto. Ahora gana el pack_size_g mayor: si ninguno de los dos
-- tiene pack_size_g confirmado, el desempate cae a precio absoluto
-- MAYOR como proxy debil de "mas cantidad", nunca a MENOR.
drop view if exists cheapest_dia_proposal;

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
    bool_or(metrica is not null) over (partition by food_id, bloque) as grupo_tiene_metrica,
    row_number() over (
      partition by food_id, bloque
      order by metrica asc nulls last, pack_size_g desc nulls last, price desc
    ) as rn
  from grupos
),
chosen as (
  select * from con_flag where grupo_tiene_metrica and rn = 1
  union all
  select * from con_flag where not grupo_tiene_metrica
),
deduplicado as (
  select
    *,
    case
      when not grupo_tiene_metrica then 1
      else row_number() over (partition by food_id order by bloque asc)
    end as rn_final
  from chosen
),
anotado as (
  select
    *,
    (not grupo_tiene_metrica) as sin_criterio_comparacion,
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
    case when proteina_estimada and food_protein_100g >= 10 and not sin_criterio_comparacion then
      'sin proteina propia en la ficha -- no habia candidato medido para este alimento, se usa la proteina del food (BEDCA), no la del producto'
    end,
    case when not proteina_estimada and food_protein_100g >= 10 and not sin_criterio_comparacion then
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
