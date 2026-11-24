-- 20260915000000_views_security_invoker_regression.sql
-- Regresion de la regla dura 17, detectada por el Security Advisor de
-- Supabase ("Security Definer View", CRITICAL) el 2026-10-07.
--
-- 20260912000000_channel_aware_pricing hace drop ... cascade y
-- recrea cuatro vistas SIN security_invoker: cheapest_dia_proposal,
-- shopping_list, plan_prorated_cost y plan_cost_summary (esta ultima
-- cae por el cascade). Eso deshace, para esas cuatro, el arreglo de
-- 20260910000000_rls_audit_fixes: vuelven a ejecutarse con los
-- permisos de postgres (rolbypassrls) y cualquier authenticated ve
-- las listas y costes de los planes de todos los usuarios.
--
-- Comprobado contra cloud antes de escribir esto: las cuatro vistas
-- tienen reloptions vacio, y el resto de vistas de public si tienen
-- security_invoker=true. anon no tiene SELECT sobre ninguna de las
-- cuatro, asi que no hubo exposicion publica.
--
-- El archivo 20260912000000 ya se ha corregido para crear las vistas
-- con security_invoker, pero en cloud ese SQL ya se ejecuto (sin
-- quedar registrado en supabase_migrations.schema_migrations), asi
-- que hace falta esta migracion aparte para arreglar lo que hay hoy.
-- alter view ... set es idempotente: no hace nada si ya estaba bien.
--
-- Leccion: un drop view + create view pierde las opciones de la
-- vista. Toda vista recreada lleva "with (security_invoker = true)"
-- en el propio create, no en un alter posterior que se puede olvidar.

alter view cheapest_dia_proposal set (security_invoker = true);
alter view shopping_list set (security_invoker = true);
alter view plan_prorated_cost set (security_invoker = true);
alter view plan_cost_summary set (security_invoker = true);
