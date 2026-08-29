-- 20260910000000_rls_audit_fixes.sql
-- Primera auditoria de RLS con un segundo usuario real (por
-- suplantacion de auth.uid() en una transaccion, no por lectura de
-- politicas) antes de abrir el proyecto a un segundo admin. Nunca se habia
-- probado con dos usuarios. Dos fallos confirmados en vivo.

-- 1. channel_fees nunca tuvo RLS activado (relrowsecurity = false,
-- sin ninguna politica) -- no una politica mal escrita, RLS
-- directamente ausente desde que se creo la tabla
-- (20260830000000_channel_fees.sql). Confirmado en vivo: un uuid sin
-- relacion con el usuario veia las 4 filas completas. Mismo patron
-- que el resto de tablas (owner_all, user_id = auth.uid()).
alter table channel_fees enable row level security;

create policy "owner_all" on channel_fees
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- 2. Las 10 vistas de la app nunca tuvieron security_invoker. Sin
-- el, Postgres las ejecuta con los privilegios del DUEÑO de la
-- vista -- aqui, 'postgres', que tiene BYPASSRLS. Confirmado en vivo
-- con el mismo uuid ajeno: 9 de las 10 devolvian datos reales de
-- su propietario (plan semanal completo, objetivos de kcal/proteina, coste
-- de la compra) a una sesion sin ninguna relacion con su cuenta.
--
-- Grants verificados ANTES de aplicar esto: 'authenticated' ya tiene
-- SELECT en las 10 tablas base de las que dependen estas vistas
-- (recipes, recipe_ingredients, foods, meal_plan_slots, meal_plans,
-- cook_sessions, cook_session_recipes, products, product_prices,
-- work_location) -- son las que Supabase concede por defecto a toda
-- tabla nueva. Con security_invoker, la vista pasa a necesitar esos
-- grants sobre las tablas subyacentes, no solo sobre la vista misma
-- -- si faltara alguno, el propietario veria 0 filas en vez de un error de
-- permisos, cambiando una fuga por una pantalla vacia sin
-- explicacion. No falta ninguno.
alter view recipe_macros set (security_invoker = true);
alter view recipe_fit set (security_invoker = true);
alter view plan_day_totals set (security_invoker = true);
alter view plan_balance set (security_invoker = true);
alter view cheapest_dia_proposal set (security_invoker = true);
alter view plan_prorated_cost set (security_invoker = true);
alter view shopping_list set (security_invoker = true);
alter view plan_cost_summary set (security_invoker = true);
alter view foods_energy_check set (security_invoker = true);
alter view meal_plan_slot_details set (security_invoker = true);

-- shopping_list daba 0 filas en la prueba de suplantacion ANTES de
-- este fix, pero no por estar protegida -- por el orden accidental
-- de su consulta. Documentado aqui para que nadie lo lea como "esta
-- vista ya estaba bien" y reabra el agujero al reescribirla.
comment on view shopping_list is
  'Antes de 20260910000000, esta vista carecia de security_invoker '
  'igual que las otras 9 de la auditoria, pero una prueba de '
  'suplantacion con un uuid ajeno daba 0 filas -- no por estar '
  'protegida, sino porque su unica referencia a una tabla real '
  '(meal_plans) va seguida de un CROSS JOIN LATERAL a '
  'plan_cook_batches(), una funcion SECURITY INVOKER (no DEFINER) '
  'cuyas consultas internas si respetaban auth.uid() -- el lateral '
  'join daba 0 filas por cada plan aunque meal_plans en si mismo '
  'estuviera expuesto. Proteccion accidental por la forma concreta '
  'de la consulta, no por diseño: si se reescribe esta vista sin '
  'pasar por una funcion invoker, el agujero vuelve. Con '
  'security_invoker=true ya no depende de ese accidente.';
