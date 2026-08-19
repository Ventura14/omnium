-- 20260818000000_remove_manual_test_rows.sql
-- PROPUESTA, no ejecutar sin otra luz verde explicita.
--
-- 'Tomate' y 'patatas' (source='manual', 2-4 kcal) son filas de
-- prueba de cuando se probo el formulario /foods a mano, antes de
-- que hubiera importador. Verificado (2026-08-18) que NO estan
-- referenciadas en recipe_ingredients (0 usos cada una) -- el DELETE
-- es seguro respecto al FK ON DELETE RESTRICT de
-- recipe_ingredients.food_id, no deberia fallar.
--
-- Son la causa de que el recuento de la tabla bailara entre 953 y 955
-- durante la investigacion de carbs_convention: 953 = solo BEDCA+
-- BEDCA2, 955 = + estas 2 filas manuales.

delete from foods
where id in (
  'f3911944-065b-4398-bff3-c1dbfd43e887', -- patatas (manual, 2 kcal)
  '5f0c4568-9633-43df-9938-107bde494984'  -- Tomate (manual, 4 kcal)
);
