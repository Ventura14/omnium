-- 20260816060000_carbs_convention_backfill.sql
-- Clasifica carbs_convention con las DOS reglas demostrables, nada
-- mas. El resto se queda en 'unknown' (el default) -- no se adivina
-- por Atwater ni por ninguna otra inferencia.
--
-- fiber_100g > carbs_100g   -> 'net'   (prueba aritmetica: solo es
--                               posible si carbs no incluye la fibra)
-- fiber_100g is null or < 0.5 -> 'total' (la distincion entre sumar
--                               o no una fibra despreciable es menos
--                               de 2 kcal/100g, no cambia nada real)
--
-- carbs_total_100g no necesita backfill propio: es GENERATED STORED,
-- se recalcula sola en cuanto este UPDATE toca carbs_convention.
--
-- Preview confirmado (2026-08-16), contado con la MISMA clausula WHERE
-- que el UPDATE de abajo (where carbs_convention = 'unknown' -- hoy
-- son todas las filas, porque nada se ha clasificado todavia):
-- net=54 (26 BEDCA + 28 BEDCA2), total=546 (267 BEDCA + 277 BEDCA2 +
-- 2 manual), unknown=355 (137 BEDCA + 218 BEDCA2).
-- 54+546+355 = 955, cuadra con el total real de la tabla (no 953 --
-- ese numero omitia sin querer las 2 filas source='manual').
--
-- El WHERE hace el UPDATE idempotente: reejecutarlo no reclasifica
-- filas que un usuario ya haya corregido a mano tras el backfill.

update foods
set carbs_convention = case
  when fiber_100g > carbs_100g then 'net'
  when fiber_100g is null or fiber_100g < 0.5 then 'total'
  else 'unknown'
end
where carbs_convention = 'unknown';
