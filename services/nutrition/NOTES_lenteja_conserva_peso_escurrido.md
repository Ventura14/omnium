# Lenteja, en conserva: no es peso escurrido

Sin resolver a propósito (regla 8, CLAUDE.md). Documenta un hallazgo,
no lo corrige.

## El problema

`Lenteja, en conserva` (BEDCA, 73.69 kcal/100g, 6.28 g proteína/100g)
no encaja con lentejas de bote **escurridas**. Esos valores son
compatibles con el bote entero, líquido de gobierno incluido — las
lentejas de bote escurridas de verdad rondan **116 kcal y 9 g de
proteína por 100g** (referencia externa, no BEDCA).

Comparación directa dentro del propio catálogo: `Lenteja, seca, cruda`
tiene 308.86 kcal / 24.77 g proteína. Hidratada y escurrida (factor
~3, la misma física que ya documenta la regla 13), debería rondar los
100-115 kcal / 8-9 g proteína — coherente con la referencia externa de
116/9, no con los 73.69/6.28 que trae BEDCA para "en conserva".

## Consecuencia

Cualquier receta que pese lentejas de bote ya escurridas y las busque
contra esta fila **subestima** sus macros reales — el peso de la
receta es de producto escurrido, pero los valores por 100g de la fila
son de bote entero con líquido.

## Qué falta

Dar de alta "Lenteja de bote, escurrida" como alimento propio, con
fuente externa (no BEDCA, que no la tiene distinguida) — mismo patrón
que ya usa `carbs_convention_source='manual'` para overrides fijados
a mano.

## Pendiente, no bloqueante

Ninguna de las 7 recetas sembradas en la primera tanda de Fase 3 usa
lenteja en conserva. Esto no bloquea esa siembra.
