-- 20260822010000_recipes_variant.sql
-- Aviso suave en /semana si una receta de variante CASA/OFICINA se
-- asigna a un dia equivocado (p. ej. una media
-- manana de oficina asignada a un dia que se trabaja desde casa). Deducirlo del
-- nombre en TypeScript seria fragil (regla 1: nada de parsear texto
-- libre); una columna explicita lo hace filtrable/comprobable por SQL.
--
-- Nullable a proposito: solo las 4 recetas de ingesta fija tienen
-- variante. Las de comida/cena (que valen cualquier dia) se quedan en
-- NULL -- no existe un tercer valor "cualquiera" en el CHECK porque
-- NULL ya significa exactamente eso.

alter table recipes add column variant text
  check (variant is null or variant in ('casa', 'oficina'));

update recipes set variant = 'casa' where name in (
  'Media mañana: avena con leche, plátano y cacahuete',
  'Merienda: leche, fruta y nueces'
);

update recipes set variant = 'oficina' where name in (
  'Media mañana oficina: bocadillo de pavo y queso con fruta',
  'Merienda oficina: fruta, nueces y fiambre'
);
