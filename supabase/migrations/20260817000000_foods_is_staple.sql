-- 20260817000000_foods_is_staple.sql
-- is_staple marca los alimentos elegidos como "catalogo de trabajo"
-- de la Fase 1 (arroz blanco, pechuga de pollo, etc.) entre las
-- variantes disponibles del mismo alimento en BEDCA.
--
-- Regla central de la Fase 1: el agente PROPONE candidatos, nunca
-- ELIGE. Ya nos mordio elegir por nuestra cuenta una vez ("Pollo,
-- pechuga, con piel" resulto tener macros de pechuga CON piel, no sin
-- ella, cuando la receta asumia pechuga sin piel). is_staple lo marca
-- el usuario a mano, fila a fila, nunca una migracion ni un script.
--
-- Preparada y SIN APLICAR (regla dura 10, CLAUDE.md): el agente no
-- ejecuta `supabase db push` por iniciativa propia.

alter table foods add column is_staple boolean not null default false;
