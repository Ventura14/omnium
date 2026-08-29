-- 20260909000000_products_image_path.sql
-- La pantalla comprobaba con existsSync() si el archivo de la
-- miniatura existia en public/ -- funciona en local (process.cwd()
-- es la raiz del proyecto) pero NO esta garantizado en Vercel: los
-- archivos de public/ se sirven desde el CDN estatico, y el
-- filesystem de la funcion serverless no tiene por que contenerlos
-- en la misma ruta en tiempo de peticion. El fallo es silencioso y
-- del lado malo: en local se ven las 23 fotos, se da por bueno, y en
-- el deploy desaparecen sin error ni log que lo relacione con esto.
--
-- Arreglo: si un producto tiene foto es un DATO, no algo que
-- preguntarle al sistema de archivos en cada peticion.
-- image_path guarda la ruta publica (/products/<id>.jpg) SOLO
-- cuando el archivo se guardo de verdad -- lo rellena
-- dia_images.py, nunca la pantalla. Nullable, sin default: sin foto,
-- sin fila con hueco reservado (regla 15).
--
-- Columna separada de image_url a proposito: image_url es la URL de
-- ORIGEN en dia.es (para verificar o re-descargar), image_path es la
-- ruta SERVIDA (para pintar). "Tengo la URL de origen" y "tengo el
-- archivo guardado" son dos hechos distintos -- mismo error de dos
-- magnitudes bajo un nombre que costo dos dias con el peso escurrido
-- de las conservas (regla 8), ahora en imagenes.
alter table products add column image_path text;

-- Solo se añade una columna al final -- create or replace permite
-- esto sin drop, a diferencia de reordenar columnas existentes.
create or replace view cheapest_dia_proposal as
with base as (
  select
    p.id as product_id,
    p.food_id,
    p.name as product_name,
    p.url,
    p.image_path,
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
  proteina_estimada;
