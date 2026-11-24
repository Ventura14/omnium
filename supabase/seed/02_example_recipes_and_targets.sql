-- 02_example_recipes_and_targets.sql
-- Datos de EJEMPLO para ver la app funcionando el primer dia: 5 recetas
-- y un objetivo nutricional. Todo es sintetico -- las recetas llevan el
-- prefijo "[Ejemplo]" para que se reconozcan y se borren de un vistazo,
-- y el objetivo se puede sobreescribir en /objetivos.
--
-- Requisitos, en este orden:
--   1. Haberte registrado en la app (/login): el seed asigna las recetas y
--      el objetivo al PRIMER usuario existente en auth.users.
--   2. Haber importado BEDCA y aplicado 01_staples.sql.
--
-- Idempotente: se puede ejecutar varias veces sin duplicar nada.
--
-- Cantidades TOTALES por receta, no por racion: recipe_macros y recipe_fit
-- dividen por `servings`. Regla dura 13 (CLAUDE.md): todo en crudo o seco
-- (la lenteja es 'seca, cruda': regla 12, legumbres con estado explicito).

do $seed$
declare
  uid uuid;
  missing text;
  -- Zona de las fechas de dominio: la fija apply_seed.py desde APP_TIMEZONE.
  tz text := coalesce(nullif(current_setting('app.timezone', true), ''), 'Europe/Madrid');
  monday date := date_trunc('week', (now() at time zone tz)::date)::date;
begin
  select id into uid from auth.users order by created_at limit 1;
  if uid is null then
    raise exception
      'No hay ningun usuario. Registrate en la app (/login) y vuelve a ejecutar el seed.';
  end if;

  create temp table _seed_recipes (
    name text, servings int, instructions text, suits meal_type[]
  ) on commit drop;
  insert into _seed_recipes values
    ('[Ejemplo] Arroz con pollo y verduras', 4,
     'Receta de ejemplo (batch de comida): borrala o editala.', '{lunch}'),
    ('[Ejemplo] Lentejas con verduras y huevo', 4,
     'Receta de ejemplo (batch de comida): borrala o editala.', '{lunch}'),
    ('[Ejemplo] Merluza con patatas al horno', 2,
     'Receta de ejemplo (cena, se cocina en el momento): borrala o editala.', '{dinner}'),
    ('[Ejemplo] Salteado de cerdo con arroz y brécol', 2,
     'Receta de ejemplo (cena, se cocina en el momento): borrala o editala.', '{dinner}'),
    ('[Ejemplo] Merienda de fruta, nueces y pan', 1,
     'Ingesta de ejemplo, no hay que cocinar nada: borrala o editala.', '{snack}');

  create temp table _seed_ingredients (
    recipe_name text, food_name text, grams numeric
  ) on commit drop;
  insert into _seed_ingredients values
    ('[Ejemplo] Arroz con pollo y verduras', 'Arroz', 480),
    ('[Ejemplo] Arroz con pollo y verduras', 'Pollo, pechuga, con piel, crudo', 700),
    ('[Ejemplo] Arroz con pollo y verduras', 'Pimiento rojo, crudo', 200),
    ('[Ejemplo] Arroz con pollo y verduras', 'Cebolla', 150),
    ('[Ejemplo] Arroz con pollo y verduras', 'Judía verde, cruda', 200),
    ('[Ejemplo] Arroz con pollo y verduras', 'Aceite de oliva virgen extra', 40),
    ('[Ejemplo] Lentejas con verduras y huevo', 'Lenteja, seca, cruda', 400),
    ('[Ejemplo] Lentejas con verduras y huevo', 'Zanahoria, cruda', 200),
    ('[Ejemplo] Lentejas con verduras y huevo', 'Cebolla', 150),
    ('[Ejemplo] Lentejas con verduras y huevo', 'Pimiento rojo, crudo', 150),
    ('[Ejemplo] Lentejas con verduras y huevo', 'Huevo de gallina fresco', 200),
    ('[Ejemplo] Lentejas con verduras y huevo', 'Aceite de oliva virgen extra', 30),
    ('[Ejemplo] Merluza con patatas al horno', 'Merluza, congelada, cruda', 500),
    ('[Ejemplo] Merluza con patatas al horno', 'Patata, cruda', 1000),
    ('[Ejemplo] Merluza con patatas al horno', 'Cebolla', 200),
    ('[Ejemplo] Merluza con patatas al horno', 'Aceite de oliva virgen extra', 24),
    ('[Ejemplo] Salteado de cerdo con arroz y brécol', 'Carne de cerdo de capa blanca, lomo, parte magra, crudo', 360),
    ('[Ejemplo] Salteado de cerdo con arroz y brécol', 'Arroz', 200),
    ('[Ejemplo] Salteado de cerdo con arroz y brécol', 'Brécol, crudo', 300),
    ('[Ejemplo] Salteado de cerdo con arroz y brécol', 'Pimiento rojo, crudo', 150),
    ('[Ejemplo] Salteado de cerdo con arroz y brécol', 'Aceite de oliva virgen extra', 20),
    ('[Ejemplo] Merienda de fruta, nueces y pan', 'Plátano', 120),
    ('[Ejemplo] Merienda de fruta, nueces y pan', 'Nuez, cruda, con cáscara', 25),
    ('[Ejemplo] Merienda de fruta, nueces y pan', 'Pan blanco, de barra', 60),
    ('[Ejemplo] Merienda de fruta, nueces y pan', 'Crema de cacahuete', 20);

  select string_agg(distinct i.food_name, '; ') into missing
  from _seed_ingredients i
  where (select count(*) from foods f where f.name = i.food_name) <> 1;
  if missing is not null then
    raise exception
      'Faltan alimentos en el catalogo (o estan duplicados): %. Importa BEDCA primero (ver README).',
      missing;
  end if;

  insert into recipes (created_by, name, servings, instructions, suits)
  select uid, r.name, r.servings, r.instructions, r.suits
  from _seed_recipes r
  where not exists (select 1 from recipes x where x.name = r.name);

  insert into recipe_ingredients (recipe_id, food_id, grams)
  select (select id from recipes where name = i.recipe_name),
         (select id from foods where name = i.food_name),
         i.grams
  from _seed_ingredients i
  on conflict do nothing;

  -- Objetivo de EJEMPLO, fechado en el lunes de esta semana (los objetivos
  -- se fechan en lunes: ver CLAUDE.md, Convenciones). Edita los valores en
  -- /objetivos con los tuyos.
  insert into nutrition_targets (user_id, effective_from, kcal, protein_g, fat_g, carbs_g, notes)
  values (uid, monday, 2500, 140, 75, 300,
          'EJEMPLO: sustituyelo por tu objetivo real en /objetivos.')
  on conflict (user_id, effective_from) do nothing;
end
$seed$;
