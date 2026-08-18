-- 20260817010000_foods_is_staple_seed.sql
-- Marca is_staple = true en los 17 alimentos elegidos por el usuario
-- como catalogo de trabajo de la Fase 1, tras revisar los candidatos
-- propuestos por categoria (BASES, PROTEINA -- LACTEOS, VERDURA,
-- FRUTA, GRASA en migraciones posteriores, misma mecanica).
--
-- Todos son CRUDOS o SECOS (regla dura 13, CLAUDE.md): ninguna entrada
-- "hervido"/"asado"/"cocido" entra en el set de trabajo, porque esas
-- traen los macros en base seca, no por 100 g de producto cocinado.
--
-- IDs verificados por nombre exacto contra cloud (2026-08-17), cada
-- uno con un unico match en la tabla -- sin ambiguedad de source.
--
-- Preparada y SIN APLICAR (regla dura 10, CLAUDE.md): el agente no
-- ejecuta `supabase db push` por iniciativa propia. Depende de que
-- 20260817000000_foods_is_staple.sql (que añade la columna) se
-- aplique primero.

update foods set is_staple = true
where id = any(array[
  '4b0297c9-4913-4577-ba41-73739d874ebb', -- Arroz
  '2c9921b9-ea02-485a-bff7-8c19636b7c84', -- Patata, cruda
  'c0778131-ee42-48b1-afa3-225656b8c628', -- Avena, cruda
  'a6490bd7-2903-45c3-95a4-766df7a371a0', -- Pan blanco, de barra
  'd93215ed-a441-4e8d-8115-0f0b0844a880', -- Lenteja, seca, cruda
  '9df0d438-cddd-412d-858a-1ebec418326c', -- Garbanzo, seco, crudo
  '71f332b9-077e-4363-a7b3-9deb493989f8', -- Pollo, pechuga, con piel, crudo
  '92773fdd-213f-422e-ade5-04c9ffd97a0b', -- Pollo, muslo, con piel, crudo
  '147a05b4-f22d-4b54-8cb7-740cf9e67fd9', -- Carne de cerdo capa blanca, lomo, parte magra, crudo
  '426f3a73-5d1c-4454-8c3d-6af31d879c0c', -- Ternera, solomillo, sin grasa, crudo
  '86cb76b0-a6f3-4b54-8631-197d8b268bd5', -- Huevo de gallina fresco
  '60d1bb6e-1ea7-4ec7-bd1e-871e091be2e6', -- Huevo de gallina, clara, cruda
  '538d0a21-e55b-465c-8f3a-34bfdd29c32d', -- Atun, al natural
  '309e690e-6b83-423f-8cba-f160fba4dc28', -- Merluza, congelada, cruda
  '864452e8-3ff3-4419-8ad0-87bd693cc517', -- Bacalao, crudo
  '77ca868f-9866-4dff-898a-1848ff3bd5c1', -- Sardina, enlatada, en escabeche
  '934d11bd-d941-4fd1-9b29-51cca772e2c5'  -- Pavo, fiambre, bajo en grasa
]::uuid[]);
