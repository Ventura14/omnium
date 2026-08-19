-- 20260822020000_work_location.sql
-- "Que dias toca oficina" vivia hardcodeado en TypeScript
-- (app/semana/page.tsx::expectedVariant) -- logica de negocio en el
-- frontend (regla 1) Y un dato del usuario que va a cambiar (hoy
-- unos dias, mas adelante otro patron). Se declara UNA vez
-- aqui, como dato.
--
-- NO se llama "work_schedule": esa tabla la trabaja los 5 dias, solo
-- que 2 desde la oficina. Un nombre tipo "horario de trabajo" es
-- compatible con "dia que trabaja" y con "dia que va a la oficina" --
-- si alguien lo lee al reves, la vista no falla, avisa exactamente
-- lo contrario (marca como error las asignaciones correctas), y un
-- aviso invertido enseña a ignorarlo, peor que no tener aviso. La
-- columna `location` explicita el significado en el propio dato, no
-- en un comentario que alguien puede no leer.
--
-- Sin sembrar los dias reales: son datos reales del usuario (regla 4,
-- CLAUDE.md, seeds sinteticos jamas datos reales), igual que
-- nutrition_targets y body_metrics -- entran a mano, no por
-- migracion.

create table work_location (
  user_id uuid not null references auth.users(id) on delete cascade,
  weekday integer not null check (weekday between 1 and 7), -- isodow: 1=lunes .. 7=domingo
  location text not null check (location in ('casa', 'oficina')),
  primary key (user_id, weekday)
);

alter table work_location enable row level security;
create policy owner_all on work_location for all using (user_id = auth.uid());

-- meal_plan_slot_details: mismo dato que meal_plan_slots + el nombre
-- y la variante de la receta asignada, mas variant_mismatch ya
-- calculado -- la comparacion "que ubicacion toca hoy" vive aqui, en
-- SQL, no en el componente. El componente solo pinta el booleano.
--
-- variant_mismatch es false si la receta no tiene variante (recetas
-- de comida/cena, que valen cualquier dia) o si el usuario no tiene
-- NINGUNA fila en work_location todavia -- sin dato, no se avisa de
-- nada, no se inventa un patron por defecto. Con al menos una fila,
-- cada dia de la semana toma su location explicita si existe, o
-- 'casa' si no hay fila para ese weekday (la mayoria de dias no
-- tienen excepcion).
create or replace view meal_plan_slot_details as
select
  mps.id,
  mps.plan_id,
  mps.slot_date,
  mps.meal,
  mps.recipe_id,
  mps.servings,
  mps.eating_out,
  r.name as recipe_name,
  r.variant as recipe_variant,
  case
    when r.variant is null then false
    when not exists (select 1 from work_location wl where wl.user_id = auth.uid()) then false
    else r.variant <> coalesce(
      (select wl.location from work_location wl
       where wl.user_id = auth.uid()
         and wl.weekday = extract(isodow from mps.slot_date)),
      'casa'
    )
  end as variant_mismatch
from meal_plan_slots mps
left join recipes r on r.id = mps.recipe_id;
