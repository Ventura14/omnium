-- 20260815100000_foods_source_ref_nulls_not_distinct.sql
-- El indice unico original trata cada NULL de user_id como distinto
-- (comportamiento estandar de Postgres), asi que dos filas BEDCA con
-- el mismo source_ref y user_id NULL no chocan entre si: el
-- importador duplicaria alimentos en cada ejecucion.
-- NULLS NOT DISTINCT hace que Postgres SI trate los NULL como iguales
-- a efectos de unicidad, permitiendo el upsert idempotente real.

drop index if exists foods_user_id_source_source_ref_idx;

create unique index foods_source_ref_unique
  on foods (user_id, source, source_ref)
  nulls not distinct
  where source_ref is not null;
