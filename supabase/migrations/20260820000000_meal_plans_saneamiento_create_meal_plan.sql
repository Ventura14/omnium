-- 20260820000000_meal_plans_saneamiento_create_meal_plan.sql
-- Fase 4a, capa de Postgres. Sin UI todavia (4b).
--
-- 1) SANEAMIENTO de meal_plans:
--    target_kcal/target_protein tenian default 3000/155 -- constante
--    vieja (el plan bajo a 2700/155 el 17/08/2026, ver docs/PLAN.md) y
--    ademas duplicaba lo que ya vive en nutrition_targets. Que el plan
--    GUARDE su objetivo es correcto (un plan de agosto debe recordar
--    contra que objetivo se hizo), pero el valor no puede venir de una
--    constante escrita hace dias -- sin default, crear un plan obliga
--    a decidir el objetivo explicitamente (aqui, create_meal_plan lo
--    copia de nutrition_targets en el momento de crear el plan).
--
--    El check de isodow=1 hace cumplir "siempre lunes", que hasta
--    ahora solo vivia en un comentario.

alter table meal_plans alter column target_kcal drop default;
alter table meal_plans alter column target_protein drop default;

alter table meal_plans add constraint meal_plans_week_start_monday
  check (extract(isodow from week_start) = 1);

-- 2) create_meal_plan(p_week_start): crea el plan de una semana y sus
--    28 huecos vacios (7 dias x 4 ingestas). SECURITY INVOKER (por
--    defecto): corre con los permisos y RLS de quien la llama, igual
--    que compute_recipe_macros y search_foods -- ningun dato cruza
--    de un usuario a otro via esta funcion.
--
--    "Vigente" se resuelve contra p_week_start, no contra hoy, para
--    que replanificar una semana pasada recupere el objetivo que
--    aplicaba entonces. Esto NO habilita programar objetivos futuros:
--    las transiciones de fase se deciden por peso observado (Fase 6,
--    docs/PLAN.md -- "un calendario detallado de antemano seria
--    ficcion"), asi que nunca debe existir un nutrition_target con
--    fecha futura. Si alguna vez aparece uno, es una prediccion
--    disfrazada de dato, no un caso de uso valido de esta funcion.
--
--    NO genera slots 'breakfast': no hay desayuno en el modelo por defecto (CLAUDE.md,
--    restricciones alimentarias). Solo midmorning, lunch, snack,
--    dinner.
--
--    Falla con mensaje claro, no con un numero inventado, en dos
--    casos: semana que no empieza en lunes, o sin nutrition_target
--    vigente para esa fecha.

create or replace function create_meal_plan(p_week_start date)
returns uuid
language plpgsql
as $$
declare
  v_user_id uuid := auth.uid();
  v_target  nutrition_targets%rowtype;
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
    raise exception 'No hay ningun nutrition_target vigente para %. Crea uno en /objetivos antes de generar el plan.',
      p_week_start;
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

grant execute on function create_meal_plan(date) to authenticated;
