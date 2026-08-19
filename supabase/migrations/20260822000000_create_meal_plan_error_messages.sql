-- 20260822000000_create_meal_plan_error_messages.sql
-- create_meal_plan distinguia un solo caso de "sin objetivo vigente"
-- para dos situaciones muy distintas: no existe ningun
-- nutrition_target, o existen pero todos empiezan DESPUES de la
-- semana pedida (le paso al usuario real: fecho su objetivo el
-- 19/08, abrio /semana en la semana del 17, y el mensaje generico
-- "crea uno en /objetivos" le habria hecho crear un duplicado que no
-- hacia falta).
--
-- Ahora se distingue: si no hay NINGUN nutrition_target, el mensaje
-- sigue siendo "crea uno". Si hay alguno pero el mas antiguo empieza
-- despues de p_week_start, el mensaje dice cual es esa fecha y que
-- hacer -- planificar una semana posterior, o ajustar la fecha del
-- objetivo. Un error que dice que hacer vale el doble que uno que
-- dice que falta algo.
--
-- El resto de la funcion no cambia -- misma resolucion de "vigente"
-- contra p_week_start, no contra hoy, documentada en
-- 20260820000000_meal_plans_saneamiento_create_meal_plan.sql.
--
-- Preparada y SIN APLICAR (regla dura 10, CLAUDE.md).

create or replace function create_meal_plan(p_week_start date)
returns uuid
language plpgsql
as $$
declare
  v_user_id uuid := auth.uid();
  v_target  nutrition_targets%rowtype;
  v_earliest date;
  v_plan_id uuid;
  v_day     date;
  v_meal    meal_type;
begin
  if extract(isodow from p_week_start) <> 1 then
    raise exception 'week_start debe ser lunes (isodow=1); % es isodow=%',
      p_week_start, extract(isodow from p_week_start);
  end if;

  select * into v_target
  from nutrition_targets
  where user_id = v_user_id
    and effective_from <= p_week_start
  order by effective_from desc
  limit 1;

  if not found then
    select min(effective_from) into v_earliest
    from nutrition_targets
    where user_id = v_user_id;

    if v_earliest is null then
      raise exception 'No hay ningun nutrition_target para este usuario. Crea uno en /objetivos antes de generar el plan.';
    else
      raise exception 'Tu objetivo mas antiguo empieza el %, posterior a esta semana (%). Planifica una semana posterior o ajusta la fecha del objetivo.',
        v_earliest, p_week_start;
    end if;
  end if;

  insert into meal_plans (user_id, week_start, target_kcal, target_protein)
  values (v_user_id, p_week_start, v_target.kcal, v_target.protein_g)
  returning id into v_plan_id;

  for v_day in
    select d::date
    from generate_series(p_week_start::timestamp, (p_week_start + 6)::timestamp, interval '1 day') as d
  loop
    foreach v_meal in array array['midmorning', 'lunch', 'snack', 'dinner']::meal_type[]
    loop
      insert into meal_plan_slots (plan_id, slot_date, meal)
      values (v_plan_id, v_day, v_meal);
    end loop;
  end loop;

  return v_plan_id;
end;
$$;
