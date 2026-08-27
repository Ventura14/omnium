-- 20260829000000_medido_gana_a_estimado.sql
-- cheapest_dia_proposal devolvia DOS filas por food_id cuando existia
-- tanto un candidato medido como uno estimado -- correcto como dos
-- propuestas para que el humano elija, pero un consumidor que solo
-- necesita UN precio por alimento (p.ej. el coste semanal de la
-- cesta) no tiene forma de saberlo desde la vista y termina sumando
-- las dos filas como si fueran dos compras independientes. Paso real:
-- "Carne de cerdo, lomo" salio a 15.55 EUR en vez de 7.32 porque el
-- script de coste sumo la fila medido (7.32) y la estimada (8.24).
--
-- Arreglo: cuando un food_id tiene ganador en el bloque medido Y en
-- el estimado, la vista devuelve SOLO el medido -- un dato real de
-- ficha vale mas que uno heredado del generico de BEDCA, y "un precio
-- por alimento" es la promesa por defecto de la vista. Si algun dia
-- hace falta comparar los dos a proposito, se consulta product por
-- product_id, no esta vista.
--
-- Los foods sin bloque medido/estimado (proteina < 10, o el grupo
-- entero sin metrica -- ver 20260828000000) no cambian: siguen
-- devolviendo lo mismo que antes.

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
  select * from con_flag where grupo_tiene_metrica and rn = 1
  union all
  select * from con_flag where not grupo_tiene_metrica
),
-- Deduplicacion final: si el food_id tiene metrica (esta en chosen por
-- la rama rn=1), se queda solo con la fila de bloque=false (medido, o
-- el unico bloque para foods no proteicos). Si el food_id esta sin
-- metrica en ningun bloque (la rama "not grupo_tiene_metrica"), se
-- devuelven TODAS sus filas sin filtrar -- el row_number() de abajo se
-- calcula igual mezclando bloques, pero solo se usa para decidir en
-- la rama con metrica.
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
