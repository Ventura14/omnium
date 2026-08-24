-- 20260825000000_capa_de_precios.sql
-- Fase 7, capa de precios. Solo esquema -- la carga de productos/
-- precios desde la sonda de Dia va aparte, en un script (mismo
-- patron que insert_bedca.py: dato externo voluminoso, no cabe bien
-- en una migracion versionada).
--
-- channels: la via de compra de un product (vocabulario, CLAUDE.md).
-- markup_pct es el recargo del canal SOBRE el precio base de la
-- tienda -- null cuando el canal ES la base (presencial, tipicamente).

create table channels (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  store       text not null,   -- 'dia', 'mercadona', 'carrefour'...
  channel     text not null,   -- 'presencial', 'glovo', 'ubereats', 'web'
  markup_pct  numeric(5,2),
  notes       text,
  created_at  timestamptz not null default now(),
  unique (user_id, store, channel)
);

-- products: un SKU real de una tienda (vocabulario, CLAUDE.md), unido
-- al food generico del que es una instancia concreta -- food aporta
-- los macros, product aporta precio y formato, nunca al reves.
--
-- pack_size_g se queda NULL hasta que un humano lo confirme a mano.
-- Regla 8: el peso del titulo del producto y el contenido neto real
-- no son lo mismo y no hay señal estructural que los distinga -- no
-- se infiere de pack_size_raw, por eso esa columna es texto crudo sin
-- parsear y esta es un numero aparte, deliberadamente vacio.
-- kcal_100g_scraped: NO estaba en el diseño original -- se añade
-- porque, sin ella, el punto 4 (marcar candidatos cuyos macros se
-- separan >25% del food de BEDCA) es imposible de calcular en SQL: el
-- kcal que trae la ficha de Dia solo vivia en el JSON de la sonda, en
-- ningun sitio consultable. Es el minimo indicador defendible para
-- "es probablemente el mismo alimento" (el caso de merluza congelada,
-- 74 vs 107 kcal/100g entre candidatos, lo detecta bien) sin
-- persistir el desglose completo de macros de cada producto, que no
-- se pidio. Null cuando la ficha no traia nutritional_info.
--
-- kj_100g_scraped: se guarda aparte, sin fusionar con
-- kcal_100g_scraped ni usarla como fallback la una de la otra. Caso
-- real que lo justifica: una ficha de Dia declaro energy_value=0 con
-- energy_value_kj=205 (kcal y kJ de la MISMA ficha contradiciendose).
-- Un cero que en realidad significa "dato ausente", no "cero
-- calorias" -- la misma trampa que fiber_100g con default 0 en BEDCA.
-- Ninguna de las dos columnas se corrige por la otra: cada una es el
-- dato tal como lo publica Dia, y la vista marca la contradiccion en
-- vez de resolverla en silencio (ver cheapest_dia_proposal).
create table products (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  food_id             uuid references foods(id) on delete set null,
  store               text not null,
  name                text not null,
  url                 text,
  pack_size_raw       text,
  pack_size_g         numeric(10,2),
  price_per_kg        numeric(10,2),
  kcal_100g_scraped   numeric(7,2),
  kj_100g_scraped     numeric(7,2),
  created_at          timestamptz not null default now()
);

-- product_prices: una observacion de precio en un canal, en un
-- momento. `source` NO es decorativa, es la columna mas importante de
-- la tabla: un precio de Glovo calculado aplicando un porcentaje al
-- de Dia es una ESTIMACION, no una observacion. Si dentro de tres
-- meses 'scraped' y 'estimated' no se distinguen aqui, alguien tomara
-- una decision de dinero real creyendo que mira un precio real.
create table product_prices (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid not null references products(id) on delete cascade,
  channel_id   uuid not null references channels(id) on delete cascade,
  price        numeric(10,2) not null,
  observed_at  timestamptz not null,
  source       text not null check (source in ('scraped', 'estimated', 'manual'))
);

alter table channels enable row level security;
create policy owner_all on channels for all using (user_id = auth.uid());

alter table products enable row level security;
create policy owner_all on products for all using (user_id = auth.uid());

alter table product_prices enable row level security;
create policy owner_all on product_prices for all using (
  exists (select 1 from products p where p.id = product_id and p.user_id = auth.uid())
);

-- macros_source_note: acabamos de ver que los macros de un food
-- pueden venir de la etiqueta de UNA marca mientras el precio de un
-- product enlazado viene de OTRA -- en un queso fresco batido es
-- ruido menor (7.1 vs 8.0 g de proteina entre Mercadona y Granja
-- Rinya de Dia), pero entre un concentrado y un aislado de proteina
-- de suero hay 15 puntos de diferencia y seria un error de bulto.
alter table foods add column macros_source_note text;

update foods
set macros_source_note = 'Macros de la etiqueta de Mercadona (500 g). El producto equivalente en Dia es Granja Rinya 400 g, con 7.1 g de proteína en vez de 8.0.'
where name = 'Queso fresco batido 0% M.G.';

-- cheapest_dia_proposal: PROPUESTA a confirmar, no hecho -- el mas
-- barato por kilo no siempre es el mismo producto. Dos señales
-- independientes, cada una tapa el punto ciego de la otra:
--
-- macro_check compara kcal_100g_scraped del candidato contra
-- food.kcal_100g. Tres estados EXPLICITOS, no un boolean con null:
--   'ok'            -- comparadas, dentro del 25%
--   'desajuste'     -- comparadas, se separan >25%
--   'sin_comprobar' -- el candidato no trae ficha nutricional en Dia
-- 'sin_comprobar' NO significa correcto -- significa que la maquina
-- no puede opinar y hace falta mirar mas despacio, no menos. Un null
-- aqui se leeria como "sin problema" y NO lo es (leccion repetida en
-- este proyecto: plan_day_totals, los mensajes de create_meal_plan, y
-- ahora esto).
--
-- nombre_solapa es la segunda señal, barata e independiente:
-- normalize_search_name() sobre el nombre del producto y el del food,
-- partido en palabras (>1 caracter), ¿comparten alguna? Sin stemming
-- -- "pimientos" no solapa con "pimiento" por el plural y saltara sin
-- motivo real. Se acepta: el coste de un falso positivo es que un
-- humano mire una linea de mas: el de un falso negativo es comprar
-- zanahorias creyendo que son patatas (caso real, ver mas abajo).
--
-- precio_por_kg_pendiente=true cuando Dia no da el precio en KILO
-- (leche, aceite, huevos, clara de huevo -- litro o unidad). No se
-- excluyen de la propuesta: se muestran igual, con este aviso, a la
-- espera de que el usuario confirme products.pack_size_g a mano (un
-- brick de 1L, una docena de huevos) para poder calcular el €/kg
-- despues -- son constantes fisicas reales, no una inferencia.
--
-- motivos: array de texto explicando POR QUE salio marcado cada uno,
-- no solo que lo esta -- puede tener varias razones a la vez.
--
-- Un join a product_prices asume una sola observacion de precio por
-- producto (cierto para esta carga inicial) -- si algun dia hay mas
-- de una, esta vista necesita revisarse para elegir la mas reciente.
create or replace view cheapest_dia_proposal as
with base as (
  select
    p.id as product_id,
    p.food_id,
    p.name as product_name,
    p.url,
    pp.price,
    p.price_per_kg,
    p.kcal_100g_scraped,
    p.kj_100g_scraped,
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
-- coste por kilo -- caso real: la ternera salia 21.99 €/kg pero 4
-- veces mas cara por proteina que el lomo de cerdo, y en pescado el
-- mas barato por kilo trae mas agua/grasa y puede ser el mas caro por
-- proteina de verdad. Para el resto (verdura, fruta, aceite, arroz,
-- pan) sigue mandando €/kg: ahi no se compra proteina, se compra
-- volumen o energia.
scored as (
  select
    *,
    case
      when price_per_kg is not null and food_protein_100g > 0
        then round(price_per_kg / (food_protein_100g * 10), 4)
      else null
    end as precio_por_g_proteina
  from base
),
ranked as (
  select
    *,
    row_number() over (
      partition by food_id
      order by
        (case when food_protein_100g >= 10 then precio_por_g_proteina else price_per_kg end) asc nulls last,
        price asc
    ) as rn
  from scored
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
  precio_por_kg_pendiente,
  food_protein_100g,
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
    end
  ], null) as motivos
from chosen
order by
  case
    when macro_check = 'desajuste' then 1
    when macro_check = 'sin_comprobar' or not nombre_solapa or kj_contradiction then 2
    else 3
  end,
  food_name;
