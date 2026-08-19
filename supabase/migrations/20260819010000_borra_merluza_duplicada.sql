-- 20260819010000_borra_merluza_duplicada.sql
-- PROPUESTA, no ejecutar sin otra luz verde explicita.
--
-- "Merluza con patata al horno" (3 raciones, 334.0 kcal/racion,
-- ppk 10.09) y la nueva "Merluza al horno con patatas" (2 raciones,
-- 778.2 kcal/racion, ppk 7.21) son nombres casi identicos con macros
-- que difieren en mas del doble -- una trampa real en cualquier
-- desplegable: se puede elegir una creyendo que es la otra y comerse
-- la mitad de lo que se cree.
--
-- La nueva SUSTITUYE a la vieja (que era la version de racion
-- pequeña, la que habia que agrandar). Verificado antes de proponer
-- este borrado: 'Merluza con patata al horno' tiene CERO referencias
-- en meal_plan_slots y CERO en cook_session_recipes -- el borrado no
-- rompe nada. recipe_ingredients cae solo via ON DELETE CASCADE (a
-- diferencia de foods, que usa ON DELETE RESTRICT).

delete from recipes where name = 'Merluza con patata al horno';
