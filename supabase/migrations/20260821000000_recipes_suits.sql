-- 20260821000000_recipes_suits.sql
-- Fase 4b necesita filtrar que recetas caben en cada hueco por SQL
-- (regla 1: nada de parsear texto libre de `instructions` en
-- TypeScript, eso seria logica de negocio en el frontend).
--
-- Reparto verificado contra las 14 recetas reales del catalogo antes
-- de escribir esta migracion (no es "5 comida / 5 cena / 4 viejas"
-- como se penso al pedirlo -- es 3 comida / 4 cena / 3 viejas, el
-- total sigue siendo 14):
--   COMIDA (3) -> {lunch}: Arroz con pollo y verduras,
--     Lomo de cerdo con arroz y champiñones,
--     Pollo al horno con patatas y pimientos
--   CENA (4) -> {dinner}: Merluza al horno con patatas,
--     Revuelto de champiñones con jamón y pan,
--     Salteado de lomo con arroz y brécol,
--     Salteado de ternera con patata y pimientos
--   Recetas viejas (3) -> {lunch,dinner}: Ensalada de atún,
--     Pasta con albóndigas, Pollo al curry con arroz
--   Media mañana (2) -> {midmorning}: casa, oficina
--   Merienda (2) -> {snack}: casa, oficina
--
-- Preparada y SIN APLICAR (regla dura 10, CLAUDE.md).

alter table recipes add column suits meal_type[] not null default '{}';

update recipes set suits = '{lunch}' where name in (
  'Arroz con pollo y verduras',
  'Lomo de cerdo con arroz y champiñones',
  'Pollo al horno con patatas y pimientos'
);

update recipes set suits = '{dinner}' where name in (
  'Merluza al horno con patatas',
  'Revuelto de champiñones con jamón y pan',
  'Salteado de lomo con arroz y brécol',
  'Salteado de ternera con patata y pimientos'
);

update recipes set suits = '{lunch,dinner}' where name in (
  'Ensalada de atún',
  'Pasta con albóndigas',
  'Pollo al curry con arroz'
);

update recipes set suits = '{midmorning}' where name in (
  'Media mañana: avena con leche, plátano y cacahuete',
  'Media mañana oficina: bocadillo de pavo y queso con fruta'
);

update recipes set suits = '{snack}' where name in (
  'Merienda: leche, fruta y nueces',
  'Merienda oficina: fruta, nueces y fiambre'
);
