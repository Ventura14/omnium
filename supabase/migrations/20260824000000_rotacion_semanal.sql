-- 20260824000000_rotacion_semanal.sql
-- Fase 4c, solo capa de Postgres. Una dieta no son 28 decisiones
-- sueltas cada domingo: es un patron que se repite. La rotacion es
-- ese patron, para que una semana nueva nazca ya montada en vez de
-- vacia.
--
-- weekday en isodow (1=lunes..7=domingo), coherente con work_location
-- (que ya lo usa). Mezclar isodow con el dow nativo de Postgres
-- (0=domingo) en la misma base seria la misma trampa que mezclar
-- convenciones de carbohidratos -- un solo estandar, documentado aqui
-- y alli.
--
-- EXTENSION FUTURA, no implementada aqui a proposito: rotacion
-- multisemana (ciclos de 2-3 semanas para mas variedad). Con 3
-- recetas de comida sembradas no hay material todavia para que sirva
-- de algo, y un `cycle_week` que siempre vale 1 es complejidad sin
-- uso. Si algun dia hace falta, añadir esa columna y extender
-- apply_rotation para elegir el ciclo segun la semana del plan.

create table meal_rotations (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

-- Solo puede haber UNA rotacion por defecto por usuario -- sin esto,
-- "la rotacion por defecto" seria ambigua y create_meal_plan elegiria
-- una al azar.
create unique index meal_rotations_one_default_per_user
  on meal_rotations (user_id) where is_default;

create table meal_rotation_slots (
  rotation_id uuid not null references meal_rotations(id) on delete cascade,
  weekday     integer not null check (weekday between 1 and 7), -- isodow
  meal        meal_type not null,
  recipe_id   uuid references recipes(id) on delete set null,
  servings    numeric(5,2) not null default 1 check (servings > 0),
  eating_out  boolean not null default false,
  primary key (rotation_id, weekday, meal)
);

alter table meal_rotations enable row level security;
create policy owner_all on meal_rotations for all using (user_id = auth.uid());

alter table meal_rotation_slots enable row level security;
create policy owner_all on meal_rotation_slots for all using (
  exists (select 1 from meal_rotations mr where mr.id = rotation_id and mr.user_id = auth.uid())
);

-- save_week_as_rotation: vuelca los 28 slots de un plan ya montado a
-- una rotacion nueva, mapeando slot_date -> isodow. Si p_make_default,
-- desmarca la rotacion por defecto anterior ANTES de insertar la
-- nueva (en ese orden -- insertar primero chocaria con el indice
-- unico parcial mientras la vieja siga marcada).
create or replace function save_week_as_rotation(
  p_plan_id uuid,
  p_name text,
  p_make_default boolean default false
)
returns uuid
language plpgsql
as $$
declare
  v_user_id uuid := auth.uid();
  v_rotation_id uuid;
begin
  if p_make_default then
    update meal_rotations set is_default = false
    where user_id = v_user_id and is_default;
  end if;

  insert into meal_rotations (user_id, name, is_default)
  values (v_user_id, p_name, p_make_default)
  returning id into v_rotation_id;

  insert into meal_rotation_slots (rotation_id, weekday, meal, recipe_id, servings, eating_out)
  select v_rotation_id,
         extract(isodow from mps.slot_date)::integer,
         mps.meal,
         mps.recipe_id,
         mps.servings,
         mps.eating_out
  from meal_plan_slots mps
  where mps.plan_id = p_plan_id;

  return v_rotation_id;
end;
$$;

grant execute on function save_week_as_rotation(uuid, text, boolean) to authenticated;

-- apply_rotation: rellena los slots de un plan desde una rotacion,
-- emparejando por (isodow del slot_date, meal). SOBRESCRIBE lo que
-- hubiera -- misma decision que copyPreviousDay (app/semana/actions.ts)
-- y por el mismo motivo: mejor que el usuario sepa que va a pasar
-- antes de que pase, no que lo descubra.
create or replace function apply_rotation(p_plan_id uuid, p_rotation_id uuid)
returns integer
language plpgsql
as $$
declare
  v_count integer;
begin
  update meal_plan_slots mps
  set recipe_id  = mrs.recipe_id,
      servings   = mrs.servings,
      eating_out = mrs.eating_out
  from meal_rotation_slots mrs
  where mrs.rotation_id = p_rotation_id
    and mps.plan_id = p_plan_id
    and mrs.weekday = extract(isodow from mps.slot_date)
    and mrs.meal = mps.meal;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function apply_rotation(uuid, uuid) to authenticated;

-- create_meal_plan: igual que antes (20260822000000), mas un paso al
-- final -- si el usuario tiene una rotacion por defecto, se aplica
-- nada mas crear los 28 huecos vacios. Sin rotacion por defecto, se
-- comporta exactamente igual que hasta ahora: no rompe nada.
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
  v_default_rotation_id uuid;
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

  select id into v_default_rotation_id
  from meal_rotations
  where user_id = v_user_id and is_default
  limit 1;

  if v_default_rotation_id is not null then
    perform apply_rotation(v_plan_id, v_default_rotation_id);
  end if;

  return v_plan_id;
end;
$$;
