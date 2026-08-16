-- 20260816020000_search_name_normalize.sql
-- search_name se calculaba en dos sitios con dos algoritmos distintos
-- (import_bedca.py quitaba puntuacion, lib/search-name.ts no, pese a
-- decir que lo hacia) -- la columna tenia dos convenciones
-- incompatibles segun de donde viniera la fila. A partir de ahora se
-- calcula en UN solo sitio: Postgres, via trigger, ignorando siempre
-- lo que mande el cliente.
--
-- Esta migracion es segura de aplicar sola: crea la funcion y el
-- trigger, pero no toca ninguna fila existente. El backfill de las
-- filas ya insertadas va en una migracion aparte
-- (20260816030000_search_name_backfill.sql), a la espera de
-- confirmacion antes de aplicarse.

create extension if not exists unaccent;

-- unaccent() es STABLE en el catalogo de Postgres (depende del
-- diccionario), no IMMUTABLE. Envolverla en una funcion propia
-- marcada IMMUTABLE es el patron estandar para poder usarla en
-- triggers/indices sin que Postgres se queje -- el diccionario de
-- unaccent no cambia en la practica.
--
-- Esa marca IMMUTABLE es tecnicamente falsa, pero hoy no tiene
-- exposicion: la funcion solo se invoca desde el trigger en tiempo de
-- escritura, no hay ningun indice funcional sobre ella, asi que
-- Postgres nunca cachea su resultado. Si algun dia se crea
-- `create index on foods (normalize_search_name(name))`, esa mentira
-- empieza a importar de verdad.
--
-- [^a-z0-9]+ es una lista blanca ASCII, no una lista de puntuacion:
-- por eso el simbolo de grado (°, categoria Unicode "So") se cuela y
-- una coma (categoria "Po") no. Es deliberado, no un descuido: usar
-- [[:punct:]] aqui habria sido una mentira peor, porque su
-- comportamiento depende de la colacion de la base de datos --
-- rompiendo la propia garantia de IMMUTABLE que se busca con este
-- wrapper.
create or replace function normalize_search_name(input text)
returns text
language sql
immutable
set search_path = public
as $$
  select trim(
    regexp_replace(
      unaccent(lower(coalesce(input, ''))),
      '[^a-z0-9]+', ' ', 'g'
    )
  );
$$;

create or replace function foods_set_search_name()
returns trigger
language plpgsql
as $$
begin
  new.search_name := normalize_search_name(new.name);
  return new;
end;
$$;

drop trigger if exists foods_search_name_trigger on foods;

create trigger foods_search_name_trigger
  before insert or update on foods
  for each row
  execute function foods_set_search_name();
