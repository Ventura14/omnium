# Roadmap Omnium

Cerrado el 16/08/2026. Objetivos actualizados el 17/08/2026.

Documento vivo.

## El problema que resuelve la app

No es "llevar la cuenta de lo que como". Es cumplir un objetivo diario de calorías y proteína (por ejemplo, ganar músculo sin engordar grasa) con comida real, a un coste razonable y sin decidir cada día qué cocinar. Todo lo demás -catalogo, precios, scrapers- es instrumental.

## El hallazgo que reordena el plan

Con pocas ingestas al día y un objetivo calórico alto, los platos se vuelven enormes e insostenibles durante meses; repartir el objetivo en más ingestas (media mañana, merienda) lo hace viable. El reparto concreto de kcal, proteína y grasa por ingesta es configuración de cada usuario, no una constante del sistema.

La merienda deja de ser "ocasional" y pasa a ser estructural, y puede apoyarse en un batido de proteína whey (~40 g de whey con leche desnatada son ~42 g de proteína en un vaso). Es un cambio de hábito que sostiene el plan, y no lo arregla ninguna línea de código.

Los objetivos de cada fase (kcal, proteína, grasa, carbohidratos) viven en `nutrition_targets`. Principio: al bajar calorías, la proteína no se toca; es el número que decide si lo que se gana es músculo o grasa.

## El arquetipo de plato para volumen limpio

Con un presupuesto de grasa diario limitado, la grasa es el recurso escaso: las calorias tienen que venir del carbohidrato. Plato objetivo:

  base de arroz, patata o legumbre (120-180 g en seco)
  + proteina magra (180-220 g)
  + verdura
  + 10-15 g de grasa añadida
  = ~900 kcal / 50 g proteina / 125 g HC / 20 g grasa

Contraste: la pasta con albondigas da 1.019 kcal pero 49,2 g de grasa, el 62 % del presupuesto diario en un plato. La carne picada generica del catalogo trae 15,22 g de proteina y 20,50 g de grasa; se sustituye por lomo de cerdo magro (24,90 / 2,50) o solomillo de ternera (20,19 / 3,06).

## Fases

### Fase 1 - Catalogo de trabajo  [CERRADA cuando se confirme el push — ver detalle abajo]

Aislar los alimentos que se comen de verdad y verificarlos a mano contra fuente externa, en vez de arreglar 953. Resultado: 34 alimentos de trabajo, 0 en zona ciega de convencion de carbohidratos, 0 energeticamente imposibles. Criterio de salida cambiado a mitad de fase (detalle completo debajo).

Pendientes que NO bloquean: whey, pasta sin gluten, maiz dulce en conserva y queso fresco batido no existen en BEDCA — son productos comerciales y entran a mano desde etiqueta.

**Estado real (2026-08-18): preparado, pendiente de aplicar.** Lo de
arriba describe el estado que tendrá cloud tras el `supabase db push`
de las migraciones `20260817000000` a `20260817060000` (y el commit
correspondiente) — no lo ejecuta este documento. Hasta que se
confirme el push, esto describe un objetivo, no un hecho.

#### El criterio de salida cambió a mitad de fase — por qué

El plan original de esta fase era "cada alimento del catálogo de
trabajo reconcilia su `kcal_100g` declarado contra Atwater dentro de
un 10% de margen" (`residual_pct <= 10`). Se sustituyó por
`energy_impossible` (`9×grasa + 4×proteína > kcal_100g × 1.03`) porque
se demostró que el margen porcentual falla en los dos extremos:

- **Deja pasar datos rotos de verdad.** La fila `Nuez` (con
  `fat_100g=63.28`, luego corregida a `Nuez, cruda, con cáscara`,
  `fat_100g=59.00`, en la Ensalada de atún) tiene un residual del
  9.6% — por debajo del umbral del 10%, se habría colado.
- **Marca como sospechosos alimentos sanos.** Las 8 hortalizas crudas
  del catálogo de trabajo (cebolla, pimiento, calabacín, judía verde,
  espinaca, champiñón, lechuga, zanahoria) superan el 10% de residual
  sin que haya ningún error: su `kcal_100g` es tan bajo (15-30
  kcal/100g) que una desviación absoluta de pocas kcal —dentro de
  cualquier margen de medición o redondeo de tabla nutricional— se ve
  enorme en porcentaje.

`energy_impossible` en cambio comprueba una imposibilidad aritmética,
no una desviación: si solo la grasa y la proteína ya superan la
energía declarada (con un margen del 3% para el redondeo de BEDCA a 2
decimales y la variación real de los factores de Atwater entre
alimentos — la grasa real va de 8.37 a 9.02 kcal/g según el alimento,
no siempre 9), no es una estimación desviada, es que dos términos
positivos no caben en el total.

Las 8 hortalizas **siguen por encima del 10% de residual** y ahora
pasan la puerta de salida sin problema. `residual_pct` se queda en
`foods_energy_check` como **información, no como criterio de cierre**.
Que quede escrito aquí explícitamente: dentro de unos meses, sin este
párrafo, parecería que se aflojó el listón para poder cerrar la fase.
Al revés: el listón nuevo es más estricto donde importa (caza datos
rotos que el antiguo dejaba pasar) y más permisivo solo donde el
umbral antiguo estaba midiendo mal (alimentos de baja densidad
calórica).

#### Regla central de la fase

El agente propone candidatos del catálogo BEDCA con sus macros y
banderas; el usuario elige cuál marcar `is_staple`. Precedente del
porqué: "Pollo, pechuga, con piel, crudo" se usó una vez sin verificar
y resultó tener los macros de la pechuga CON piel, no sin ella, cuando
la receta asumía sin piel.

### Fase 2 - Validador de arquetipo

Vista recipe_fit en Postgres: por racion, si cumple >= 35 g proteina, <= 22 g grasa y la banda de kcal de su ingesta. Devuelve el DESVIO, no un booleano.

SALIDA: las 4 recetas actuales puntuadas. Prediccion: sobreviven el curry y la pasta con lomo en lugar de picada; la ensalada de atun y la merluza tal como estan, no.

### Fase 3 - Recetario que cubre la semana

El usuario aporta platos que le apetezca comer, tomados de fuentes reales (webs de recetas), no inventados. El sistema calcula y dice que falta. Nota de enfoque: las recetas de internet estan optimizadas para el sabor, no para los macros; de ellas se toma el PLATO y la tecnica, y los gramos se ajustan para cumplir el arquetipo. Casi ninguna cumplira tal cual esta escrita, y eso no es un problema: es el trabajo.

Dos tipos con restricciones distintas: platos de COMIDA (batch del domingo, tienen que aguantar 5-6 dias) y platos de CENA (se cocinan entre semana, admiten pescado fresco y verdura que no sobrevive al domingo).

Restricciones duras: las que declare cada usuario (alimentos excluidos, preferidos, a reducir). Legumbres siempre con estado explicito (regla de legumbres).

SALIDA: siete dias completos donde cada dia cumple los minimos y maximos de `nutrition_targets`. No se pasa a la Fase 4 sin esto: es el criterio que mide si la app sirve.

### Fase 4 - Planificador semanal

cook_sessions produce raciones el domingo, meal_plan_slots las consume, plan_balance cuadra ambos. Produccion y consumo desacoplados.

SALIDA: una semana real planificada, cocinada un domingo y comida. Si sobran o faltan raciones, el modelo esta mal.

### Fase 5 - Lista de la compra

Agregacion de gramos por alimento desde la sesion de cocina.

SALIDA: una lista impresa que funciona en el Dia de abajo sin correcciones a mano.

### Fase 6 - Fases del plan de 12 meses

Registros en nutrition_targets, no un documento. Transiciones por peso real desde body_metrics, nunca por calendario:
  - ganancia > 0,4 kg/semana durante 3 semanas -> bajar 150 kcal
  - ganancia < 0,1 kg/semana durante 3 semanas -> subir 150 kcal

Funcion de Postgres que lee body_metrics y PROPONE el ajuste. Propone, no aplica.

SALIDA: /objetivos muestra la propuesta con su justificacion.

### Fase 7 - Precios

Solo aqui. Scraper de Dia (1 req/seg, backoff, Akamai) y de Mercadona (API publica, trae EAN). Macros que falten en Mercadona, via Open Food Facts por EAN. Matching por embeddings con pantalla de confirmacion manual, sin LLM en el camino critico. Conservas: peso escurrido siempre confirmado a mano.

SALIDA: el planificador ordena las recetas por coste por gramo de proteina.

## Fuera de alcance

Cobee y Glovo (previsto en channels, se añade sin refactor). Entrenamiento y Strava (despues de nutricion; solo export manual GPX/FIT, nunca la API, sus terminos lo prohiben). Finanzas. Carrefour (Cloudflare, reevaluar tras un mes de uso). Lidl (no vende alimentacion online en España). Spec-kit y frameworks de spec-driven development: evaluado el 17/08/2026 y descartado — resuelve ambiguedad de intencion, y los fallos reales de este proyecto han sido defectos silenciosos de datos que ninguna especificacion previa detecta.

## Regla de alcance

Si aparece un bug de datos durante una fase, se anota en un NOTES_ y se sigue, SALVO que impida calcular una receta. El 16/08/2026 se gastaron cuatro rebanadas en infraestructura correcta y necesaria, con avance cero en el objetivo real. No vuelve a pasar.
