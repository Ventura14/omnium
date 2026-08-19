-- 20260823000000_alta_queso_fresco_batido.sql
-- Alta manual desde la etiqueta del envase (Mercadona, 500 g), no de
-- una tabla de composicion -- no existe en BEDCA (ver
-- NOTES_alimentos_pendientes_catalogo.md, ya se puede tachar esta
-- linea de la lista de pendientes).
--
-- fiber_100g = 0.00 es un dato REAL, no ausente: es un lacteo, no
-- tiene fibra que declarar. carbs_convention = 'total' (no 'net')
-- porque, aunque la regla general de etiquetas europeas (Reglamento
-- 1169/2011, declaran hidratos EXCLUYENDO fibra) manda 'net' por
-- defecto, aqui la excepcion de la propia regla aplica: sin fibra que
-- restar, 'net' y 'total' dan el mismo carbs_total_100g -- da igual
-- cual se marque, y 'total' es el valor mas simple.
--
-- Verificado antes de insertar contra foods_energy_check (formula
-- ahi, no repetida aqui): 4*8.00 + 4*3.50 + 9*0.10 = 46.9 kcal contra
-- 46 declaradas (2% de residual, dentro de margen). energy_impossible
-- no salta: 9*0.10 + 4*8.00 = 32.9, muy por debajo de 46*1.03=47.38.
--
-- Preparada y SIN APLICAR (regla dura 10, CLAUDE.md).

insert into foods (
  user_id, name, source, source_ref,
  kcal_100g, protein_100g, carbs_100g, fiber_100g, fat_100g,
  is_staple, carbs_convention, carbs_convention_source
)
select
  (select user_id from recipes limit 1),
  'Queso fresco batido 0% M.G.',
  'manual',
  null,
  46, 8.00, 3.50, 0.00, 0.10,
  true, 'total', 'manual';
