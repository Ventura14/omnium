-- 20260817020000_carbs_convention_source.sql
-- Distingue clasificaciones de carbs_convention por regla aritmetica
-- (20260816060000_carbs_convention_backfill.sql, automatica, la
-- inmensa mayoria de filas) de las que el usuario fija a mano
-- contrastando contra un valor externo (etiqueta, USDA...), sin
-- pasar por la regla ni por Atwater. Una futura reclasificacion
-- automatica debe respetar 'manual' y no pisarla.
--
-- Preparada y SIN APLICAR (regla dura 10, CLAUDE.md).

alter table foods add column carbs_convention_source text not null default 'rule'
  check (carbs_convention_source in ('rule', 'manual'));
