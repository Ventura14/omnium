-- 20260817030000_carbs_convention_manual_overrides.sql
-- Fija carbs_convention a mano para 5 alimentos del catalogo de
-- trabajo de la Fase 1 que la regla automatica dejo en 'unknown'.
-- Decidido por el usuario contrastando contra un valor externo de
-- referencia (no BEDCA, no Atwater) -- Atwater es una estimacion, no
-- una prueba, y no sirve para clasificar (ver
-- 20260816050000_carbs_convention.sql). carbs_convention_source
-- queda en 'manual' para que ninguna reclasificacion automatica
-- futura los pise.
--
-- Garbanzo, seco, crudo -> 'net', confirmado: carbs_100g (49.25) +
-- fiber_100g (14.97) = 64.22, que es el valor real de garbanzo seco;
-- como 'total' se quedaria un 22% corto. Coherente con la lenteja
-- seca, misma familia, tambien 'net'.
--
-- Preparada y SIN APLICAR (regla dura 10, CLAUDE.md). Depende de
-- 20260817020000_carbs_convention_source.sql.

update foods set carbs_convention = 'net', carbs_convention_source = 'manual'
where id = '9df0d438-cddd-412d-858a-1ebec418326c'; -- Garbanzo, seco, crudo

update foods set carbs_convention = 'total', carbs_convention_source = 'manual'
where id = 'c0778131-ee42-48b1-afa3-225656b8c628'; -- Avena, cruda

update foods set carbs_convention = 'total', carbs_convention_source = 'manual'
where id = 'a6490bd7-2903-45c3-95a4-766df7a371a0'; -- Pan blanco, de barra

update foods set carbs_convention = 'net', carbs_convention_source = 'manual'
where id = 'd93215ed-a441-4e8d-8115-0f0b0844a880'; -- Lenteja, seca, cruda

update foods set carbs_convention = 'net', carbs_convention_source = 'manual'
where id = 'ade3ad51-f98f-42d8-ace0-6667b479f94c'; -- Platano

update foods set carbs_convention = 'net', carbs_convention_source = 'manual'
where id = '953cf620-fb2b-4708-9006-2099b8df97aa'; -- Crema de cacahuete
