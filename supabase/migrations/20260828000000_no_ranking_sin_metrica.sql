-- 20260828000000_no_ranking_sin_metrica.sql
-- Cuando un candidato no tiene price_per_kg NI pack_size_g
-- confirmado, la vista caia a ordenar por precio bruto -- eso premia
-- el paquete pequeño: un brick de 200ml siempre gana a uno de 1L, y
-- siempre es peor compra. Es la misma leccion que medido/estimado
-- (20260827000000) aplicada otra vez: NO SE RANKEA LO QUE NO SE
-- PUEDE MEDIR. Un orden sobre un dato que no existe no es un
-- ranking, es un orden arbitrario con aspecto de recomendacion.
--
-- Arreglo: si NINGUN candidato de un food (dentro de su bloque
-- medido/estimado) tiene metrica comparable, no se elige ganador --
-- se devuelven TODOS los candidatos de ese grupo, marcados
-- sin_criterio_comparacion=true, para que el humano elija con la
-- info completa delante. Si AL MENOS UN candidato tiene metrica, el
-- comportamiento no cambia: se elige el mejor como siempre.
--
-- effective_price_per_kg añade una fuente mas de €/kg ademas de la
-- que ya da Dia directamente: cuando pack_size_g esta confirmado a
-- mano, price / (pack_size_g/1000) tambien cuenta como medida real,
-- no como estimacion -- pack_size_g confirmado es un hecho, igual que
-- el price_per_kg que ya trae la tienda.

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
    -- El "then false" colapsa la particion para alimentos no
    -- proteicos, igual que en 20260827000000.
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
      order by metrica asc nulls last, price asc
    ) as rn
  from grupos
),
chosen as (
  -- Con metrica: solo el ganador (rn=1), como antes. Sin metrica en
  -- todo el grupo: TODOS los candidatos, sin elegir ninguno.
  select * from con_flag where grupo_tiene_metrica and rn = 1
  union all
  select * from con_flag where not grupo_tiene_metrica
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
  from chosen
)
select
  food_id,
  food_name,
  product_id,
  product_name,
  url,
  price,
  pack_size_g,
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
    case when proteina_estimada and food_protein_100g >= 10 then
      'sin proteina propia en la ficha -- €/g de proteina estimado con la proteina del food, no del producto (candidato "estimado", no "medido")'
    end,
    case when not proteina_estimada and food_protein_100g >= 10 and not sin_criterio_comparacion then
      'proteina medida en la ficha de Dia (candidato "medido")'
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
