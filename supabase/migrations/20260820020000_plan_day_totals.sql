-- 20260820020000_plan_day_totals.sql
-- La pieza que faltaba: plan_balance cuadra raciones por receta
-- ("¿cociné bastante pollo?"), pero no responde al criterio de
-- salida de la Fase 3 ("¿llega el martes al objetivo de kcal?"). Una fila por
-- plan_id + slot_date.
--
-- CRITICO -- meals_out y slots_vacios no son adorno: un dia con una
-- comida fuera muestra un deficit de ~900 kcal que NO es un fallo del
-- plan, es que no sabemos que comio. Sin estas dos columnas la vista
-- MIENTE POR OMISION: un dia perfectamente cubierto (comida fuera +
-- el resto planificado) se ve identico a un dia roto de verdad. Quien
-- lea kcal_gap sin mirar meals_out/slots_vacios a la vez saca la
-- conclusion equivocada.
--
-- Solo cuentan hacia kcal/protein/fat/carbs los slots con recipe_id
-- Y sin eating_out: si un slot tiene receta asignada pero se marca
-- eating_out despues, esa racion deja de sumar -- se come fuera, no
-- lo que dice el slot.

create or replace view plan_day_totals as
select
  mps.plan_id,
  mps.slot_date,
  round(sum(case when mps.recipe_id is not null and not mps.eating_out
                 then mps.servings * rm.kcal_per_serving else 0 end), 1) as kcal,
  round(sum(case when mps.recipe_id is not null and not mps.eating_out
                 then mps.servings * rm.protein_per_serving else 0 end), 1) as protein,
  round(sum(case when mps.recipe_id is not null and not mps.eating_out
                 then mps.servings * rm.fat_per_serving else 0 end), 1) as fat,
  round(sum(case when mps.recipe_id is not null and not mps.eating_out
                 then mps.servings * rm.carbs_per_serving else 0 end), 1) as carbs,
  mp.target_kcal,
  mp.target_protein,
  round(
    sum(case when mps.recipe_id is not null and not mps.eating_out
             then mps.servings * rm.kcal_per_serving else 0 end) - mp.target_kcal
  , 1) as kcal_gap,
  round(
    sum(case when mps.recipe_id is not null and not mps.eating_out
             then mps.servings * rm.protein_per_serving else 0 end) - mp.target_protein
  , 1) as protein_gap,
  count(*) filter (where mps.eating_out) as meals_out,
  count(*) filter (where mps.recipe_id is null and not mps.eating_out) as slots_vacios
from meal_plan_slots mps
join meal_plans mp on mp.id = mps.plan_id
left join recipe_macros rm on rm.recipe_id = mps.recipe_id
group by mps.plan_id, mps.slot_date, mp.target_kcal, mp.target_protein;
