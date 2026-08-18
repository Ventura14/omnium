-- 20260818010000_recipe_fit.sql
-- Fase 2: validador de arquetipo. Una vista, nada mas -- no diseña
-- recetas ni toca el planificador.
--
-- Devuelve el DESVIO, no un veredicto: nada de booleano
-- "cumple/no cumple". El planificador y el usuario deciden con estos
-- numeros; la vista solo informa.
--
-- protein_gap y fat_excess son absolutos (g por racion) y sirven para
-- ver de un vistazo cuanto falta o sobra. PERO dependen del tamaño de
-- la racion: un plato bueno servido pequeño los suspende, y uno malo
-- servido grande los aprueba -- no sirven para COMPARAR recetas entre
-- si, solo para leer una receta ya elegida.
--
-- protein_per_100kcal y fat_pct_kcal son RATIOS, independientes del
-- tamaño de la racion, y son las que de verdad ordenan bien entre
-- recetas distintas. El arquetipo de la Fase 1 (~900 kcal / 50 g
-- proteina / 20 g grasa, ver docs/PLAN.md) corresponde a
-- protein_per_100kcal = 5.6 y fat_pct_kcal = 20%.
--
-- nullif(kcal_per_serving,0) evita division por cero si alguna receta
-- llegara con 0 kcal por racion (no deberia pasar con datos reales,
-- pero recipe_macros no lo impide por si sola).

create or replace view recipe_fit as
select
  recipe_id,
  r.name,
  rm.servings,
  rm.kcal_per_serving,
  rm.protein_per_serving,
  rm.fat_per_serving,
  rm.carbs_per_serving,
  round(rm.protein_per_serving - 35, 1) as protein_gap,
  round(rm.fat_per_serving - 22, 1) as fat_excess,
  round(100 * rm.protein_per_serving / nullif(rm.kcal_per_serving, 0), 2) as protein_per_100kcal,
  round(100 * 9 * rm.fat_per_serving / nullif(rm.kcal_per_serving, 0), 1) as fat_pct_kcal
from recipe_macros rm
join recipes r on r.id = rm.recipe_id;
