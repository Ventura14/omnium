-- 20260817050000_foods_is_staple_seed2.sql
-- Segunda tanda de is_staple = true: LACTEOS, VERDURA, FRUTA, GRASA.
-- Ninguna entrada hervida/asada/frita/en conserva entra (regla 13),
-- ni 'Nuez' (fila corrupta, ver 20260817040000), ni 'Aguacate
-- congelado' (kcal/grasa ~2x el fresco con mismos carbs/fibra,
-- sospechoso, sin resolver), ni 'Carne picada' (no especifica origen
-- de la carne).
--
-- Incluye 'Lechuga', que no iba en la lista original del usuario pero
-- SI esta sembrada como ingrediente de la Ensalada de atun -- dejarla
-- fuera del catalogo de trabajo mientras se usa en una receta activa
-- no tendria sentido. Señalado explicitamente, no es una eleccion
-- silenciosa.
--
-- Preparada y SIN APLICAR (regla dura 10, CLAUDE.md). Depende de
-- 20260817000000_foods_is_staple.sql (añade la columna).

update foods set is_staple = true
where id = any(array[
  '47b4ae93-8d61-4be4-939c-25d46336d833', -- Leche, desnatada, pasteurizada
  'bbcfa89b-bd88-4927-b456-5b4f7a723302', -- Queso rallado, generico
  '7a5cb371-4552-4b49-9ceb-f88fafa1a6e1', -- Cebolla
  '32236e48-424a-40dd-ac13-27b9b7580a84', -- Pimiento rojo, crudo
  '60bf5d20-a550-49c3-8f4a-dd2a7c9f6012', -- Calabacin
  '4aa15b52-0184-407c-9524-d453227486f4', -- Judia verde, cruda
  '11d8b6de-59ac-438b-8869-5bd999eea276', -- Espinaca, picada, congelada, cruda
  '17780a37-6242-496d-834f-ad4c66d6fa2a', -- Champiñon
  'e6d70cc0-0570-4727-ba95-99e17698e209', -- Lechuga (ver nota arriba)
  'ade3ad51-f98f-42d8-ace0-6667b479f94c', -- Platano
  'd9a7d5a4-13cf-400c-a54e-536745b0d8f8', -- Manzana
  'b04881d6-e131-4b28-81f1-c74855c0db8b', -- Aguacate (fresco, no congelado)
  '5f06d4e3-3fcf-4774-ad3e-e3f7bd04665d', -- Aceite de oliva virgen extra
  'fdbaad69-e752-4a24-a7b0-3843328d52b5', -- Nuez, cruda, con cascara
  '953cf620-fb2b-4708-9006-2099b8df97aa', -- Crema de cacahuete
  'b0aa39d2-d771-4be9-b4d0-52aee1f6fc8b', -- Zanahoria, cruda
  '6fcad584-6f33-4b5b-9c4e-164e3efa7d30'  -- Brecol, crudo
]::uuid[]);
