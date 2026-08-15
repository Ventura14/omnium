-- 20260815090000_grant_table_privileges.sql
-- 0001_core.sql crea tablas y políticas RLS pero nunca concede privilegios
-- a los roles de PostgREST. Sin GRANT, toda query falla con
-- "permission denied for table X" antes de que RLS entre a evaluar nada.
--
-- No se concede a "anon": la app exige login en todas las rutas
-- (ver middleware.ts), no hay caso de uso anónimo todavía.

grant usage on schema public to authenticated, service_role;

grant all on all tables in schema public to authenticated, service_role;
grant all on all sequences in schema public to authenticated, service_role;
grant all on all routines in schema public to authenticated, service_role;

-- Para que las tablas que se creen en migraciones futuras hereden esto
-- automáticamente, sin tener que repetir este archivo cada vez.
alter default privileges in schema public
  grant all on tables to authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to authenticated, service_role;
alter default privileges in schema public
  grant all on routines to authenticated, service_role;
