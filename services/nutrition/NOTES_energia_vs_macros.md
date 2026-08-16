# Energía reportada vs. energía derivada de macros

Sin resolver a propósito. Documenta dos fuentes de discrepancia entre
`kcal_100g` y el resto de una receta, para no repetir la investigación
la próxima vez que aparezca un número raro.

## 1. `kcal_100g` es un dato reportado, no derivado

BEDCA reporta `kcal_100g` como un valor medido/tabulado por alimento,
igual que `protein_100g`, `carbs_100g`, `fat_100g` y `fiber_100g`. No
se deriva de esos cuatro con la fórmula de Atwater (`4*proteína +
4*carbohidratos + 9*grasa [+ 2*fibra]`) en ningún punto del pipeline
de importación (`import_bedca.py`) ni de consumo (`recipe_macros`,
`compute_recipe_macros`).

En algunas filas, el valor reportado y el que saldría de aplicar
Atwater a los otros cuatro campos no coinciden. Ejemplo verificado
contra cloud (2026-08-16), fila `Nuez` (BEDCA2, `source_ref` distinto
de `Nuez, cruda, con cáscara`, que es otra fila):

| Campo | Valor |
|---|---|
| `kcal_100g` (reportado) | 592.04 |
| `protein_100g` | 14.00 |
| `carbs_100g` | 3.30 |
| `fat_100g` | 63.28 |
| `fiber_100g` | 5.20 |
| Atwater sin fibra (`4*14 + 4*3.3 + 9*63.28`) | 638.7 |
| Atwater con fibra (`+ 2*5.2`) | 649.1 |

Diferencia con lo reportado: ~47-57 kcal (~8-10%). No es un caso
aislado — no se ha cuantificado cuántas filas del catálogo se desvían
así ni por cuánto; esto solo documenta que el fenómeno existe y que es
real, verificado con una fila concreta, no un artefacto de redondeo de
un decimal.

## 2. Consecuencia: una receta puede no cuadrar consigo misma

`recipe_macros` y `compute_recipe_macros` suman `kcal_100g` reportado
por un lado, y `protein_100g`/`carbs_total_100g`/`fat_100g` reportados
por otro, cada uno independiente. Si una receta usa una fila como
`Nuez` en cantidad significativa, las kcal totales de la receta y las
que "deberían" salir de sumar sus macros (vía Atwater) pueden no
coincidir. Ninguna de las dos cifras es más correcta por diseño: ambas
vienen de la misma fuente (BEDCA), simplemente BEDCA no garantiza que
sean internamente consistentes entre sí.

## 3. Decisión pendiente (NO tomada aquí)

¿La energía de una receta debe sumar `kcal_100g` reportado (estado
actual), o derivarse de los macros vía Atwater? Ninguna opción es
obviamente correcta:

- Sumar lo reportado es fiel a la fuente, pero puede no cuadrar con
  "4×proteína + 4×carbohidratos + 9×grasa" si el usuario hace esa
  cuenta a mano.
- Derivar vía Atwater fuerza consistencia interna, pero sustituye un
  dato medido por una estimación — el mismo tipo de inferencia que se
  evitó a propósito para `carbs_convention` (ver
  `20260816050000_carbs_convention.sql`).

## 4. Bug real y no relacionado, encontrado durante esta investigación

`compute_recipe_macros` recibe `p_food_ids uuid[]` y `p_grams
numeric[]` como dos arrays separados y los combina con `unnest(p_food_ids,
p_grams)`. Si los dos arrays llegan con longitudes distintas (un
desajuste en el frontend al construir la llamada, por ejemplo), Postgres
rellena el array más corto con `NULL` en las posiciones que faltan en
vez de lanzar un error. Una fila con `food_id = NULL` no matchea el
`join foods f on f.id = g.food_id` y se descarta en silencio: la
función devuelve macros más bajos de lo real, sin ningún error visible
ni al frontend ni en logs. No se ha corregido: documentado aquí para no
perderlo, no forma parte del trabajo de `carbs_convention`.
