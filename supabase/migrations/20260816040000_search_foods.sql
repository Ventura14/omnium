-- 20260816040000_search_foods.sql
-- Reemplaza el buscador de app/recetas/actions.ts (antes: un solo
-- ILIKE sobre la cadena completa, normalizada en TypeScript) por una
-- funcion en Postgres: normaliza la consulta con la misma
-- normalize_search_name que usa la columna, la parte en palabras y
-- exige que TODAS aparezcan (AND), en cualquier orden -- asi
-- "pechuga pollo" y "pollo pechuga" encuentran lo mismo.
--
-- Los tokens de una sola letra se descartan al partir la consulta.
-- No es un problema del normalizador (que "s/e" normalice a "s e" es
-- correcto: son las letras que hay). El problema es que un token de
-- longitud 1 en la consulta, buscado como ILIKE '%x%', casa con casi
-- cualquier fila -- ruido, no ambiguedad de datos. Se corrige en el
-- tokenizador de la busqueda, no en como se guarda search_name.

create or replace function search_foods(query text)
returns table (
  id uuid,
  name text,
  source_detail text,
  kcal_100g numeric,
  protein_100g numeric,
  carbs_100g numeric,
  fat_100g numeric
)
language sql
stable
as $$
  with words as (
    select w
    from unnest(string_to_array(normalize_search_name(query), ' ')) as w
    where length(w) >= 2
  )
  select f.id, f.name, f.source_detail, f.kcal_100g, f.protein_100g, f.carbs_100g, f.fat_100g
  from foods f
  where exists (select 1 from words)
    and not exists (
      select 1 from words where f.search_name not ilike '%' || words.w || '%'
    )
  order by f.source_detail asc nulls last, f.name asc
  limit 20;
$$;

grant execute on function search_foods(text) to authenticated;
