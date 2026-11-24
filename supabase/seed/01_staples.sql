-- 01_staples.sql
-- Marca `is_staple = true` en un catalogo de trabajo de ejemplo: 35
-- alimentos basicos de BEDCA (bases, proteina, lacteos, verdura, fruta,
-- grasas). `is_staple` es la marca de "catalogo de trabajo": alimentos
-- verificados que sirven de base para las recetas. La app no lo exige;
-- es la convencion del proyecto (CLAUDE.md, reglas 12 y 13). Elegir los
-- tuyos es decision tuya: esto es solo un punto de partida.
--
-- Es una lista de PARTIDA, no una norma: cambiala. Para quitar o anadir
-- un alimento basta con editarlo en /foods, o con un UPDATE como este.
--
-- Regla dura 13 (CLAUDE.md): todos son CRUDOS o SECOS. Nunca anadas aqui
-- una entrada "hervida" o "cocida": trae los macros en base seca.
--
-- Requiere haber importado BEDCA antes (ver README, paso "Catalogo de
-- alimentos"). Identifica los alimentos por su nombre exacto en BEDCA,
-- que es unico; si falta alguno, aborta con la lista de los que faltan.

do $seed$
declare
  wanted text[] := array[
    -- bases
    'Arroz', 'Patata, cruda', 'Avena, cruda', 'Pan blanco, de barra',
    'Lenteja, seca, cruda', 'Garbanzo, seco, crudo',
    -- proteina
    'Pollo, pechuga, con piel, crudo', 'Pollo, muslo, con piel, crudo',
    'Carne de cerdo de capa blanca, lomo, parte magra, crudo',
    'Ternera, solomillo, sin grasa, crudo',
    'Huevo de gallina fresco', 'Huevo de gallina, clara, cruda',
    'Atún, al natural', 'Merluza, congelada, cruda', 'Bacalao, crudo',
    'Sardina, enlatada, en escabeche',
    'Pavo, fiambre, bajo en grasa', 'Jamón cocido, categoría s/e',
    -- lacteos
    'Leche, desnatada, pasteurizada', 'Queso rallado, genérico',
    -- verdura
    'Cebolla', 'Pimiento rojo, crudo', 'Calabacín', 'Judía verde, cruda',
    'Espinaca, picada, congelada, cruda', 'Champiñon', 'Lechuga',
    'Zanahoria, cruda', 'Brécol, crudo',
    -- fruta
    'Plátano', 'Manzana', 'Aguacate',
    -- grasas
    'Aceite de oliva virgen extra', 'Nuez, cruda, con cáscara',
    'Crema de cacahuete'
  ];
  missing text;
begin
  select string_agg(w, '; ') into missing
  from unnest(wanted) as w
  where (select count(*) from foods f where f.name = w) <> 1;

  if missing is not null then
    raise exception
      'Faltan alimentos en el catalogo (o estan duplicados): %. Importa BEDCA primero (ver README).',
      missing;
  end if;

  update foods set is_staple = true where name = any(wanted);
end
$seed$;
