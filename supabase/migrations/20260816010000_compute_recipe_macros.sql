-- 20260816010000_compute_recipe_macros.sql
-- Recalculo de macros por racion "al vuelo" mientras se edita una
-- receta (antes de guardar, sin recipe_id todavia). El calculo de
-- macros vive en Postgres, nunca en TypeScript (CLAUDE.md, regla 1):
-- esta funcion es la misma aritmetica que la vista recipe_macros,
-- pero contra un borrador en memoria en vez de filas guardadas.

create or replace function compute_recipe_macros(
  p_food_ids uuid[],
  p_grams numeric[],
  p_servings integer
)
returns table (
  kcal_per_serving numeric,
  protein_per_serving numeric,
  carbs_per_serving numeric,
  fat_per_serving numeric
)
language sql
stable
as $$
  select
    round(sum(g.grams * f.kcal_100g    / 100) / p_servings, 1),
    round(sum(g.grams * f.protein_100g / 100) / p_servings, 1),
    round(sum(g.grams * f.carbs_100g   / 100) / p_servings, 1),
    round(sum(g.grams * f.fat_100g     / 100) / p_servings, 1)
  from unnest(p_food_ids, p_grams) as g(food_id, grams)
  join foods f on f.id = g.food_id
  where p_servings > 0;
$$;

grant execute on function compute_recipe_macros(uuid[], numeric[], integer) to authenticated;
