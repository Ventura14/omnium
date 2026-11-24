-- 20260911000000_shared_catalog.sql
-- Un segundo admin entra en el proyecto (2026-08-29): acceso total a
-- la base, igual que el primero. Decision del usuario. Con dos admins, RLS
-- deja de ser una barrera de seguridad entre ellos -- ver la nota
-- añadida a la regla 3 en CLAUDE.md -- y pasa a ser organizacion:
-- separar lo que es de cada uno (planes, peso, entrenamientos) de lo
-- que es del catalogo objetivo que comparten (alimentos, productos,
-- precios, recetas).
--
-- foods ya tenia la excepcion "user_id IS NULL = global", pero ese
-- patron se rompe con dos usuarios activos: si el segundo admin da de alta un
-- alimento, se guarda con SU user_id y el primero no lo veria -- el
-- catalogo se partiria en tres (global, de uno, del otro) en
-- vez de ser uno solo. Las 6 tablas de abajo pasan a permitir
-- SELECT/INSERT/UPDATE/DELETE a cualquier authenticated, sin mirar
-- user_id -- son solo dos admins de confianza en la misma casa, no
-- un control de acceso real.
--
-- user_id se renombra a created_by en estas 6 tablas -- no una
-- decision cosmetica. Si se hubiera dejado el nombre user_id con una
-- politica que ya no lo usa para nada, quien mire el esquema rapido
-- (el autor dentro de un mes, un colaborador nuevo) puede asumir por
-- el patron de las tablas personales que sigue gobernando acceso
-- aqui tambien -- exactamente la misma familia de trampa que la
-- regla 15 (un dato que no dice la verdad de un vistazo, aunque este
-- documentado en otro sitio). created_by es solo trazabilidad --
-- quien creo la fila -- nunca control de acceso en estas 6 tablas.
-- default auth.uid() como red de seguridad si algun script futuro
-- olvida pasarlo a mano.
--
-- created_by en NULL para una fila insertada por un script que se
-- conecta directo a Postgres (SUPABASE_DB_URL, sin sesion de
-- usuario -- load_dia_products.py, insert_bedca.py) es correcto y
-- esperado, no un dato que falta: auth.uid() no tiene nada que
-- devolver fuera de una sesion autenticada. NULL aqui significa "lo
-- metio un script, no una persona" -- informacion honesta, no se
-- "arregla" rellenandolo a mano.
--
-- Por eso las 5 columnas que hoy son NOT NULL (todas salvo foods,
-- que ya era nullable) pasan a nullable en esta migracion -- sin
-- eso, cualquier script que inserte sin sesion (todos los de
-- services/scrapers y services/nutrition) fallaria en cuanto
-- created_by intentara quedar en NULL.

-- foods
drop policy "owner_all" on foods;
alter table foods rename column user_id to created_by;
alter table foods rename constraint foods_user_id_fkey to foods_created_by_fkey;
alter table foods alter column created_by set default auth.uid();
create policy "shared_catalog" on foods
  for all to authenticated
  using (true) with check (true);

-- foods_source_ref_unique incluia user_id en la clave -- comprobado
-- ANTES de este cambio que no hay duplicados hoy (source, source_ref)
-- (select ... group by ... having count(*) > 1, cero filas): con un
-- solo usuario la vieja constraint ya lo impedia dentro de ese
-- usuario, asi que el cambio de clave no puede fallar contra datos
-- existentes. Un alimento de BEDCA (source_ref = su f_id) es UNO,
-- igual que un canal es uno -- verificado con una insercion real
-- (no releyendo la definicion) que created_by=NULL y created_by=uuid
-- con el MISMO source_ref no colisionaban bajo la constraint vieja:
-- NULLS NOT DISTINCT resuelve NULL-contra-NULL, no NULL-contra-uuid.
-- Sin created_by en la clave ya no hay NULLs que comparar, asi que
-- NULLS NOT DISTINCT tambien sobra -- dejarlo seria ruido.
drop index foods_source_ref_unique;
create unique index foods_source_ref_unique
  on foods (source, source_ref)
  where source_ref is not null;

-- products
drop policy "owner_all" on products;
alter table products rename column user_id to created_by;
alter table products rename constraint products_user_id_fkey to products_created_by_fkey;
alter table products alter column created_by drop not null;
alter table products alter column created_by set default auth.uid();
create policy "shared_catalog" on products
  for all to authenticated
  using (true) with check (true);

-- channels
drop policy "owner_all" on channels;
alter table channels rename column user_id to created_by;
alter table channels rename constraint channels_user_id_fkey to channels_created_by_fkey;
alter table channels alter column created_by drop not null;
alter table channels alter column created_by set default auth.uid();
create policy "shared_catalog" on channels
  for all to authenticated
  using (true) with check (true);

-- channels_user_id_store_channel_key incluia user_id -- permitia que
-- los dos admins tuvieran CADA UNO su propia fila "dia/presencial",
-- dos canales que deberian ser el mismo. "Dia presencial" es UNO, no
-- uno por admin -- mismo argumento que foods_source_ref_unique.
-- Comprobado sin duplicados (store, channel) antes del cambio.
alter table channels drop constraint channels_user_id_store_channel_key;
alter table channels add constraint channels_store_channel_key
  unique (store, channel);

-- channel_fees -- las comisiones dependen de la direccion de
-- entrega, y hoy es correcto compartirlas mientras los dos admins
-- compartan direccion de entrega. Si alguno de los dos
-- se muda, esta tabla deja de ser un catalogo compartido de verdad
-- y esta suposicion hay que revisarla.
drop policy "owner_all" on channel_fees;
alter table channel_fees rename column user_id to created_by;
alter table channel_fees alter column created_by drop not null;
alter table channel_fees alter column created_by set default auth.uid();
create policy "shared_catalog" on channel_fees
  for all to authenticated
  using (true) with check (true);

-- exercises (catalogo, vacia hoy)
drop policy "owner_all" on exercises;
alter table exercises rename column user_id to created_by;
alter table exercises rename constraint exercises_user_id_fkey to exercises_created_by_fkey;
alter table exercises alter column created_by drop not null;
alter table exercises alter column created_by set default auth.uid();
create policy "shared_catalog" on exercises
  for all to authenticated
  using (true) with check (true);

-- recipes -- compartidas y editables por los dos, decision explicita
-- del usuario: comparten cocina,
-- duplicar "Pollo al horno con patatas" por usuario no tiene
-- sentido, y el batch del domingo probablemente acabe siendo
-- conjunto. CONTRAPARTIDA ACEPTADA: si uno edita los gramos de un
-- ingrediente, los macros del otro cambian -- no hay copia por
-- usuario. Con dos personas que hablan entre si es manejable; si
-- dentro de un mes resulta molesto, la solucion es "copiar receta"
-- (fork) para el que quiera su propia variante, no repartir esta
-- tabla por usuario.
drop policy "owner_all" on recipes;
alter table recipes rename column user_id to created_by;
alter table recipes rename constraint recipes_user_id_fkey to recipes_created_by_fkey;
alter table recipes alter column created_by drop not null;
alter table recipes alter column created_by set default auth.uid();
create policy "shared_catalog" on recipes
  for all to authenticated
  using (true) with check (true);

-- product_prices y recipe_ingredients NO se comparten solas por
-- compartir su tabla padre -- verificado en dry-run, no asumido: sus
-- politicas EXISTS comprobaban products.user_id/recipes.user_id
-- CONTRA auth.uid() (asi es como funcionaban su ranura de acceso, no
-- una referencia al permiso de la tabla padre), y ese predicado sigue
-- ahi tras el rename de columna, ahora contra created_by -- product
-- s.created_by = auth.uid() sigue siendo falso para cualquiera que no
-- sea quien creo esa fila concreta, aunque products ya sea de lectura
-- abierta. Sin este arreglo, un ajeno veria productos pero 0 precios
-- -- se quedan igual de rotas que si nunca se hubiera tocado nada.
drop policy "owner_all" on product_prices;
create policy "shared_catalog" on product_prices
  for all to authenticated
  using (true) with check (true);

drop policy "owner_all" on recipe_ingredients;
create policy "shared_catalog" on recipe_ingredients
  for all to authenticated
  using (true) with check (true);

-- store_zones ya era de solo lectura para todo authenticated desde
-- que se creo (20260906000000) -- sin cambio.
