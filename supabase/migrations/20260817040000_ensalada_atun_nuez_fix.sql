-- 20260817040000_ensalada_atun_nuez_fix.sql
-- La Ensalada de atun usaba 'Nuez' (fila cuyo fat_100g, 63.28, no
-- reconcilia con kcal_100g via Atwater -- 638.7 esperado contra
-- 592.04 declarado). 'Nuez, cruda, con cascara' tiene el mismo
-- kcal/protein/carbs pero fat_100g=59.00, y si reconcilia (600.2
-- esperado, dentro del 10%). Cambia solo la grasa de la receta:
-- 31.9 -> 30.6 g/racion. kcal, proteina y carbohidratos no cambian
-- (son identicos entre ambas filas).
--
-- Preparada y SIN APLICAR (regla dura 10, CLAUDE.md).

update recipe_ingredients
set food_id = 'fdbaad69-e752-4a24-a7b0-3843328d52b5' -- Nuez, cruda, con cascara
where food_id = 'bcd56f73-8ec9-4516-9739-a4007a1da8b8' -- Nuez
  and recipe_id = (select id from recipes where name = 'Ensalada de atún');
