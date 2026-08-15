-- 20260815120000_foods_source_detail.sql
-- Subfuente dentro de `source`. Para BEDCA distingue 'BEDCA' de 'BEDCA2':
-- BEDCA2 es el 55% del dataset importado y de calidad distinta,
-- se quiere poder filtrar por el sin cruzar contra food_origin.csv.
-- Nullable y sin CHECK: no todas las fuentes tienen subdivision.

alter table foods add column source_detail text;
