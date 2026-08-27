-- 20260906000000_shopping_check_store_zones.sql
-- Fase 5c (frontend /compra, direccion C). Dos piezas nuevas de
-- esquema: el estado de "marcado" de la lista de la compra, y la
-- zona de tienda para agrupar por donde se recorre el super.

-- packs_checked, no un boolean: el check es por alimento y guarda la
-- CANTIDAD vigente en el momento de marcar. Si despues se edita una
-- receta y packs_to_buy cambia, comparar packs_checked contra el
-- packs_to_buy actual distingue "marcado y sigue valiendo" de
-- "marcado pero ya no vale" -- un boolean de dos estados convertiria
-- ese tercer caso en una mentira silenciosa del contador de dinero
-- llevado. Sexto caso de la regla 15 (CLAUDE.md).
--
-- La clave compuesta (plan_id, food_id) resuelve por si sola el
-- riesgo de que un check "resucite": un check vive dentro de SU
-- plan_id, y la UI siempre consulta el plan actual -- el check de la
-- semana 1 nunca puede leerse consultando la semana 4, son filas
-- distintas por construccion, no hace falta limpieza aparte.
create table shopping_check (
  plan_id uuid not null references meal_plans(id) on delete cascade,
  food_id uuid not null references foods(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  packs_checked numeric(6,2) not null,
  checked_at timestamptz not null default now(),
  primary key (plan_id, food_id)
);

alter table shopping_check enable row level security;

create policy "shopping_check_select_own" on shopping_check
  for select to authenticated
  using (user_id = auth.uid());

create policy "shopping_check_insert_own" on shopping_check
  for insert to authenticated
  with check (user_id = auth.uid());

create policy "shopping_check_update_own" on shopping_check
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "shopping_check_delete_own" on shopping_check
  for delete to authenticated
  using (user_id = auth.uid());

-- Catalogo de zonas de tienda, con el orden de recorrido explicito --
-- una tabla, no un CASE, para que el orden se corrija con un UPDATE
-- en vez de una migracion (va a cambiar en cuanto se calibre contra
-- la tienda real del usuario, ver NOTES_shopping_list.md).
--
-- zone_order 1-6 es una SUPOSICION de recorrido generico de
-- supermercado (fresco al entrar, panaderia, mostradores,
-- refrigerado, pasillos secos), NO medida contra la Dia real del
-- usuario. Lo unico que no es suposicion es que 'congelados' va el
-- ultimo: se descongela si se coge antes que el resto.
--
-- Sin user_id: los NOMBRES de zona son universales, pero zone_order
-- es especifico de una tienda concreta -- con un usuario da igual,
-- el dia que haya mas de uno habra que separarlo por user_id. RLS
-- activado igualmente (regla 3, ninguna tabla sin RLS desde el
-- primer dia) con una politica de solo lectura, porque es catalogo,
-- no dato del usuario.
create table store_zones (
  zone text primary key,
  zone_order integer not null,
  label text not null
);

alter table store_zones enable row level security;

create policy "store_zones_select_authenticated" on store_zones
  for select to authenticated
  using (true);

insert into store_zones (zone, zone_order, label) values
  ('verdura_fruta', 1, 'Verdura y fruta'),
  ('panaderia', 2, 'Panadería'),
  ('carne_pescado', 3, 'Carne y pescado'),
  ('charcuteria', 4, 'Charcutería'),
  ('lacteos', 5, 'Lácteos'),
  ('despensa', 6, 'Despensa'),
  ('congelados', 7, 'Congelados');

-- Propiedad del FOOD, no del product -- "Pollo, pechuga" es siempre
-- carne y pescado sin importar que SKU de Dia gane esa semana.
-- Nullable, sin default: un alimento sin zona se muestra "sin
-- clasificar" en vez de caer en una zona por defecto (regla 15).
alter table foods add column store_zone text references store_zones(zone);
