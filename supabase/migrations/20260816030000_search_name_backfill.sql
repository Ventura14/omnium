-- 20260816030000_search_name_backfill.sql
-- Recalcula search_name para las filas ya existentes con la funcion
-- normalize_search_name (20260816020000). El trigger ya cubre todo
-- INSERT/UPDATE futuro; esto es solo para las filas insertadas antes
-- de que existiera.
--
-- NO APLICAR sin confirmar antes el SELECT de previsualizacion.
--
-- "set name = name" es intencional, no un error de copia/pega: el
-- trigger foods_search_name_trigger recalcula search_name en TODO
-- UPDATE, sin mirar que columna cambio. Forzando un UPDATE (aunque
-- el valor de name no cambie) se dispara el trigger para las 955
-- filas sin repetir la logica de normalizacion aqui -- una sola
-- fuente de verdad (el trigger), tambien en el backfill.

update foods set name = name;
