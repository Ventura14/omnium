-- 20260827000000_protein_100g_scraped.sql
-- cheapest_dia_proposal calculaba precio_por_g_proteina usando
-- SIEMPRE la proteina del food de BEDCA (fija) para los N candidatos
-- de un mismo alimento -- con el mismo denominador fijo, precio_por_g
-- es precio_por_kg multiplicado por una constante: no son dos
-- criterios independientes, es el mismo dos veces. Por eso "ganaba en
-- los dos" para la merluza: no podia dar otro resultado.
--
-- La proteina del food de BEDCA sirve para comparar FOODS distintos
-- entre si (ternera vs lomo, cada uno con su propia proteina de
-- BEDCA -- ahi si es valido). NO sirve para comparar PRODUCTOS del
-- mismo food, que es justo lo que hace esta vista al elegir cual de
-- los N candidatos proponer: productos distintos del mismo alimento
-- tienen proteina real distinta (dos productos de "merluza" con 74 y
-- 107 kcal/100g no pueden tener la misma proteina).
--
-- protein_100g_scraped guarda la proteina TAL COMO la publica Dia
-- para ESE producto -- mismo patron que kcal_100g_scraped y
-- kj_100g_scraped, cada dato de su fuente, sin mezclar.
--
-- SEGUNDO FALLO encontrado al usar esto: un producto SIN ficha
-- nutricional heredaba la proteina "ideal" de BEDCA y le ganaba a un
-- producto CON ficha que confesaba una proteina real mas baja (caso
-- real: "Filete de cinta de lomo", sin ficha, ganaba a "Escalopin de
-- lomo marinado", con ficha, 20g de proteina real por el marinado).
-- El ranking premiaba la falta de datos -- no se puede rankear una
-- medicion contra una suposicion y llamar ranking al resultado.
-- Arreglo: los candidatos con protein_100g_scraped real y los que
-- caen al valor de BEDCA NUNCA compiten en la misma cola de
-- row_number() -- se particiona tambien por proteina_estimada (solo
-- para alimentos proteicos, que es donde importa) y se devuelve el
-- mejor de CADA bloque cuando ambos existen, para que el humano
-- elija entre "lo medido" y "lo estimado" con esa etiqueta puesta,
-- en vez de que una suposicion se cuele como si fuera un hecho.

alter table products add column protein_100g_scraped numeric(7,2);

-- edible_fraction: confirmada A MANO, igual que pack_size_g -- NULL
-- por defecto, nunca inferida. Regla dura 14 (CLAUDE.md): en pescado
-- y carne, rodajas/chuletas/piezas con hueso o piel no son
-- comparables por €/kg ni por €/g de proteina con filetes limpios.
-- Caso real: "Rodajas de merluza argentina" ganaba las dos metricas
-- automaticas (7.62 €/kg, 0.0423 €/g proteina) sobre "Filetes...sin
-- piel" (8.73 €/kg, 0.0553 €/g) hasta que se supo que solo ~75% del
-- peso de una rodaja es comestible -- con edible_fraction=0.75, el
-- €/kg real sube a 10.16 y el €/g de proteina a 0.0564, y los
-- filetes pasan a ganar. La formula NO estaba mal, le faltaba un
-- dato: hasta que exista, un producto con hueso/piel no compite en
-- igualdad de condiciones, se marca como no comparable en vez de
-- dejarlo ganar por defecto.
alter table products add column edible_fraction numeric(4,2)
  check (edible_fraction is null or (edible_fraction > 0 and edible_fraction <= 1));

-- CREATE OR REPLACE VIEW no permite reordenar columnas existentes
-- (solo añadir al final) -- el orden de columnas cambia respecto a
-- 20260825000000, asi que hace falta borrar y recrear. La vista no
-- guarda datos ni tiene nada que dependa de ella todavia.
drop view if exists cheapest_dia_proposal;

create or replace view cheapest_dia_proposal as
with base as (
  select
    p.id as product_id,
    p.food_id,
    p.name as product_name,
    p.url,
    pp.price,
    p.price_per_kg,
    p.edible_fraction,
    p.kcal_100g_scraped,
    p.kj_100g_scraped,
    p.protein_100g_scraped,
    f.name as food_name,
    f.kcal_100g as food_kcal_100g,
    f.protein_100g as food_protein_100g
  from products p
  join foods f on f.id = p.food_id
  join product_prices pp on pp.product_id = p.id
  where p.store = 'dia'
),
-- El criterio de "mejor candidato" NO es siempre €/kg. Para alimentos
-- proteicos (protein_100g >= 10 -- el corte natural entre carne/
-- pescado/lacteos proteicos/huevo, tipicamente 10-25 g, y todo lo
-- demas: verdura ~1-3g, fruta <1.5g, arroz/pan ~7-8g, aceite 0g) el
-- proyecto entero se organiza por coste por gramo de proteina, no por
-- coste por kilo. Para el resto sigue mandando €/kg: ahi no se compra
-- proteina, se compra volumen o energia.
--
-- price_per_kg_ajustado y precio_por_g_proteina se calculan sobre el
-- peso COMESTIBLE cuando edible_fraction esta informada -- pagar por
-- 1 kg de envase con hueso no es pagar por 1 kg de alimento.
scored as (
  select
    *,
    coalesce(protein_100g_scraped, food_protein_100g) as protein_100g_usada,
    (protein_100g_scraped is null) as proteina_estimada,
    case
      when price_per_kg is null then null
      when edible_fraction is not null then round(price_per_kg / edible_fraction, 4)
      else price_per_kg
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
ranked as (
  select
    *,
    row_number() over (
      -- El "then false" colapsa la particion en una sola para
      -- alimentos no proteicos -- ahi no hay bloque medido/estimado
      -- que separar, un solo mejor candidato como siempre.
      partition by food_id, (case when food_protein_100g >= 10 then proteina_estimada else false end)
      order by
        (case when food_protein_100g >= 10 then precio_por_g_proteina else price_per_kg_ajustado end) asc nulls last,
        price asc
    ) as rn
  from scored2
),
chosen as (
  select
    *,
    (price_per_kg is null) as precio_por_kg_pendiente,
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
    -- kcal y kJ de la misma ficha deberian coincidir (kcal*4.184≈kJ)
    -- y a veces no -- señal de dato ausente disfrazado de cero (ver
    -- comentario de kj_100g_scraped en la tabla products), NO se
    -- corrige aqui, solo se marca.
    (
      kcal_100g_scraped is not null and kj_100g_scraped is not null
      and (
        (kcal_100g_scraped = 0 and kj_100g_scraped > 0)
        or abs(kcal_100g_scraped * 4.184 - kj_100g_scraped) > 0.10 * kj_100g_scraped
      )
    ) as kj_contradiction
  from ranked
  where rn = 1
)
select
  food_id,
  food_name,
  product_id,
  product_name,
  url,
  price,
  price_per_kg,
  edible_fraction,
  price_per_kg_ajustado,
  precio_por_kg_pendiente,
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
    case when precio_por_kg_pendiente then
      'falta confirmar el peso del envase (pack_size_g) para calcular €/kg'
    end,
    case when kj_contradiction then
      'kcal y kJ del producto se contradicen'
    end,
    case when proteina_estimada and food_protein_100g >= 10 then
      'sin proteina propia en la ficha -- €/g de proteina estimado con la proteina del food, no del producto (candidato "estimado", no "medido")'
    end,
    case when not proteina_estimada and food_protein_100g >= 10 then
      'proteina medida en la ficha de Dia (candidato "medido")'
    end,
    case when price_per_kg is not null and edible_fraction is null and food_protein_100g >= 10 then
      'peso comestible sin confirmar -- si el corte trae hueso o piel (rodajas, chuletas), el €/g de proteina real esta subestimado'
    end
  ], null) as motivos
from chosen
order by
  case
    when macro_check = 'desajuste' then 1
    when macro_check = 'sin_comprobar' or not nombre_solapa or kj_contradiction then 2
    else 3
  end,
  food_name,
  proteina_estimada;
