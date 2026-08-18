-- 20260817060000_foods_energy_check.sql
-- foods_energy_check: compara kcal_100g (reportado) contra kcal
-- derivado de Atwater, para detectar filas cuyos macros no cuadran
-- con su propia energia declarada (ver
-- services/nutrition/NOTES_energia_vs_macros.md -- esto NO resuelve
-- esa decision pendiente, solo mide el desajuste para poder marcarlo).
--
-- Vista, no columna: es dato derivado de columnas que cambian
-- (carbs_convention, y por tanto carbs_total_100g), asi que nunca
-- debe quedarse obsoleta -- se recalcula en cada consulta.
--
-- FORMULA, y por que:
-- kcal_atwater = 4*protein_100g
--              + 4*(carbs_total_100g - coalesce(fiber_100g,0))   -- carbohidrato digerible
--              + 2*coalesce(fiber_100g,0)                        -- fibra, a su propia tasa
--              + 9*fat_100g
--
-- Usa SIEMPRE carbs_total_100g, nunca carbs_100g (regla del
-- comentario en 20260816050000_carbs_convention.sql). Usar carbs_100g
-- fue exactamente el bug que este mismo chequeo tenia: en 'Aguacate'
-- (carbs_100g=0.40, fiber_100g=6.30, carbs_total_100g=6.70) daba
-- 15.1% de residual con carbs_100g -- un falso "NO RECONCILIA" -- y
-- 5.9% con carbs_total_100g, dentro del margen.
--
-- OJO con sumar la fibra dos veces: carbs_total_100g YA incluye la
-- fibra (para filas 'net', es carbs_100g + fiber_100g). Si se suma
-- 4*carbs_total_100g y ADEMAS +2*fiber_100g sin restar antes la
-- fibra del primer termino, la fibra cuenta dos veces y el resultado
-- se infla: para 'Aguacate' esa version rota da 153.4 kcal (12.6% de
-- residual, peor que ambas alternativas correctas). Por eso el primer
-- termino resta coalesce(fiber_100g,0) antes de multiplicar por 4.
--
-- nullif(kcal_100g,0) evita division por cero en las 8 filas de
-- kcal_100g=0 (aguas, sal, infusiones, refrescos -- ver
-- 20260816060000_carbs_convention_backfill.sql): su residual_pct
-- sale NULL, no error, y un NULL no dispara ningun filtro de "> 10%".
--
-- POR QUE residual_pct NO ES LA PUERTA (solo informacion):
-- falla en los dos extremos, con denominador (kcal_100g) chico o
-- grande.
--   - 'Nuez' (fila corrupta que dio origen a
--     20260817040000_ensalada_atun_nuez_fix.sql): 9*63.28+4*14 =
--     625.5 kcal solo entre grasa y proteina, ya por encima de las
--     592.04 kcal declaradas -- imposible sumando solo dos de los
--     tres terminos positivos. Su residual_pct con la formula
--     completa es 9.6%: PASARIA un umbral del 10%.
--   - 'Lechuga': residual_pct=18.9%, muy por encima de ese mismo
--     umbral, y sin embargo 9*0.60+4*1.13=9.92 < 15.57 kcal
--     declaradas -- no hay imposibilidad, solo un kcal_100g tan bajo
--     que cualquier desviacion absoluta pequeña se ve enorme en
--     porcentaje.
-- La puerta real es energy_impossible: si grasa+proteina SOLAS ya
-- superan la energia declarada (con margen, ver abajo), no es una
-- estimacion desviada, es una imposibilidad aritmetica -- la misma
-- familia que fiber_100g > carbs_100g. Atwater es una estimacion, no
-- una prueba (mismo principio que 20260816050000_carbs_convention.sql).
--
-- PERO a diferencia de fiber > carbs (una tautologia sin coeficientes:
-- la fibra es subconjunto de los carbohidratos por definicion), la
-- desigualdad de energia usa los factores 9 y 4 de Atwater, que son
-- promedios redondeados, no constantes exactas por alimento -- la
-- grasa real varia entre 8.37 y 9.02 kcal/g segun el alimento, la
-- proteina entre 3.87 y 4.27. Prueba: el aceite de oliva virgen extra
-- es grasa practicamente pura (fat_100g=100.00, protein_100g=0.00) y
-- su propio fabricante/BEDCA declara 884.32 kcal/100g, no 900 -- osea
-- 8.84 kcal/g, no 9. Con la desigualdad estricta (sin tolerancia) UN
-- ACEITE PURO FALLA POR CONSTRUCCION, siempre, sea cual sea la marca:
-- no es un dato malo, es que el factor 9 es un promedio.
--
-- Por eso energy_impossible lleva tolerancia -- y tiene que ser
-- RELATIVA, no absoluta: el error nace de los coeficientes y escala
-- con la magnitud del alimento. Un margen absoluto (ej. 5 kcal) es a
-- la vez demasiado estrecho para el aceite (100 g de grasa pura
-- acumula mucho error absoluto) y demasiado ancho para un alimento de
-- baja densidad calorica. Con 3% relativo:
--   Huevo de gallina fresco    +0.95   vs umbral  4.47  -> pasa
--   Queso rallado, generico    +3.33   vs umbral 11.80  -> pasa
--   Aceite de oliva virgen ext +15.68  vs umbral 26.53  -> pasa
--   'Nuez' (fila corrupta)     +33.5   vs umbral 17.76  -> LA CAZA
-- 3% y no 2%: con 2% el aceite pasa por solo 2 kcal (demasiado justo
-- para el margen real de redondeo BEDCA a 2 decimales + variacion de
-- los factores de Atwater), y la Nuez se sigue cazando con holgura de
-- sobra en ambos casos. Por debajo de 3% el error es indistinguible
-- del ruido; la Nuez, con casi el doble de exceso que el umbral, no lo
-- es.

create or replace view foods_energy_check as
select
  id as food_id,
  name,
  kcal_100g,
  round(
    4*protein_100g
    + 4*(carbs_total_100g - coalesce(fiber_100g, 0))
    + 2*coalesce(fiber_100g, 0)
    + 9*fat_100g
  , 1) as kcal_atwater,
  round(
    abs(kcal_100g - (
      4*protein_100g
      + 4*(carbs_total_100g - coalesce(fiber_100g, 0))
      + 2*coalesce(fiber_100g, 0)
      + 9*fat_100g
    )) / nullif(kcal_100g, 0) * 100
  , 1) as residual_pct,
  round(
    abs(kcal_100g - (
      4*protein_100g
      + 4*(carbs_total_100g - coalesce(fiber_100g, 0))
      + 2*coalesce(fiber_100g, 0)
      + 9*fat_100g
    ))
  , 1) as residual_abs,
  (9*fat_100g + 4*protein_100g) > kcal_100g * 1.03 as energy_impossible
from foods;
