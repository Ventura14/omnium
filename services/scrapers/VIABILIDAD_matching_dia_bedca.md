# Viabilidad del matching BEDCA ↔ productos de Dia

Sonda exploratoria (fase 2, no implementación). 20 productos de Dia
casados a mano contra los 953 alimentos de `foods` (fuente BEDCA) ya
en la base de datos. Ver `NOTES_dia.md` para cómo se obtuvieron los
datos de Dia.

## Resultado global

| Categoría | Cantidad |
|---|---|
| Match evidente | **11 / 20** |
| Ambiguo (candidato existe, pero requiere criterio) | **8 / 20** |
| Sin equivalente razonable | **1 / 20** |

**Dato que cambia la lectura del número:** de los 8 ambiguos, **4 no
eran ambigüedad real de BEDCA — eran fallos de mi búsqueda de apoyo
por texto exacto** (singular/plural, acentos). "Patatas" no encontraba
`Patata, cruda`; "Melón" con tilde no encontraba `Melón` (mi primera
pasada normalizaba mal los acentos). Al corregir la búsqueda, ambos
resultaron ser matches evidentes. Esto es la prueba más directa de
todo el informe de que la similitud de texto exacta se queda corta
incluso en los casos "fáciles".

## Detalle de los 20

| Producto Dia | Veredicto | Candidato BEDCA | Por qué |
|---|---|---|---|
| Pechuga de pollo entera formato familiar | **Evidente** | Pollo, pechuga, con piel, crudo | Coincidencia directa de corte |
| Longaniza fresca | **Evidente** | Longaniza | Coincidencia directa |
| Arroz largo Dia Arrozona | **Evidente** | Arroz | BEDCA no distingue variedades |
| Arroz redondo SOS | **Evidente** | Arroz | Idem |
| Pajaritas vegetales Dia Al Diante | **Evidente** | Pasta alimenticia, con vegetales, cruda | BEDCA sí distingue "con vegetales" aunque no la forma |
| Zanahoria 1 Kg | **Evidente** | Zanahoria, cruda | Directo |
| Patatas granel 1 Kg aprox. | **Evidente** | Patata, cruda | Directo (tras corregir singular/plural) |
| Fabada asturiana Dia Al Punto | **Evidente**\* | Fabada | Existe candidato directo |
| Nectarina bandeja 750 g | **Evidente** | Nectarina | Directo |
| Melón piel de sapo unidad | **Evidente** | Melón | Directo (tras corregir acentos) |
| Leche semidesnatada Dia Láctea 1 L | **Evidente** | Leche, semidesnatada, pasteurizada | Directo |
| Jamoncitos de pollo | Ambiguo | Pollo, muslo, con piel, crudo (probable) | "Jamoncito" es término comercial, no anatómico — hace falta saber que jamoncito ≈ muslo pequeño |
| Pechugas fileteadas | Ambiguo | Pollo, pechuga, con piel, crudo (probable) | "Fileteadas" sugiere sin piel/hueso; BEDCA no tiene esa variante exacta |
| Cerdo a tacos | Ambiguo | Sin corte anatómico especificado | Falta la parte del cerdo (cabezada/chuleta/jamón/lomo difieren mucho en grasa) — dato ausente del nombre, no solo de vocabulario |
| Escalopín de lomo marinado Elpozo | Ambiguo | Cerdo, lomo, crudo (aproximado) | "Marinado" cambia sodio/composición real vs el genérico crudo |
| Filete de lomo tierno marinado | Ambiguo | Cerdo, lomo, crudo (aproximado) | Mismo problema que el anterior |
| Macarrones Dia Al Diante | Ambiguo | Pasta alimenticia, cruda | BEDCA no tiene "macarrones"; solo existe si sabes que es un TIPO de pasta alimenticia |
| Garbanzos cocidos Dia Vegecampo | Ambiguo | Garbanzo, hervido **o** Garbanzo, en conserva | Dos candidatos razonables, hay que elegir |
| Patatas para freír 2 Kg | Ambiguo | Patata, cruda | El nombre sugiere un USO futuro ("para freír"), no el estado real (crudo). Un matching literal podría emparejar mal con "Patata, frita" |
| Cuartos traseros de pollo | **Sin equivalente** | — | Corte compuesto (muslo+pierna con hueso) que BEDCA no modela como unidad; solo tiene las partes por separado |

\* Fabada es un plato preparado industrial compuesto (legumbre +
embutido + caldo). Existe un candidato BEDCA razonable, pero para
platos compuestos la equivalencia nutricional exacta es más
cuestionable que para alimentos simples — lo cuento como "evidente"
en el sentido de "hay un candidato correcto obvio", no en el sentido
de "los macros van a coincidir de cerca".

## Patrones que rompen el matching

1. **Vocabulario comercial vs técnico.** "Jamoncito" ≠ "muslo",
   "escalopín" ≠ "lomo". El vendedor nombra por corte de venta, BEDCA
   nombra por anatomía. Ninguna normalización de texto (acentos,
   plurales, minúsculas) arregla esto — hace falta comprensión
   semántica real.
2. **Preparaciones que alteran la composición.** "Marinado" es el caso
   más claro: el producto NO es el alimento base, es el alimento base
   + adobo (más sodio, distinta grasa). Match aproximado razonable,
   pero no exacto.
3. **Información ausente del nombre, no solo mal escrita.** "Cerdo a
   tacos" no dice de qué parte del cerdo — y la parte importa mucho
   nutricionalmente (127 kcal el jamón magro vs 253 kcal la cabezada
   con grasa, en los propios datos de BEDCA). Esto no es un problema
   de matching, es un problema de que el dato no está en ningún
   sitio accesible del producto.
4. **Nombre por forma en vez de por composición.** BEDCA agrupa toda
   la pasta seca simple bajo "Pasta alimenticia, cruda" sin distinguir
   macarrones/espaguetis/pajaritas — la forma no aporta información
   nutricional, pero rompe cualquier matching literal por nombre.
5. **Nombre por uso futuro, no por estado actual.** "Patatas para
   freír" sigue siendo patata cruda; el nombre sugiere una
   preparación que el producto todavía no tiene.
6. **Variantes morfológicas simples.** Singular/plural y acentos
   bastaron para que mi propia búsqueda de apoyo (texto exacto)
   fallara en 2 de 20 casos que en realidad eran evidentes. Esto es
   la señal más fuerte del informe: si a mí, revisando a mano y
   sabiendo lo que buscaba, se me escaparon por esto, un matching en
   producción basado en texto exacto los va a fallar sistemáticamente.

## Gramaje del envase: ¿extraíble del nombre?

**Sí, mayormente, pero con matices que hay que codificar explícitamente:**

- El patrón más común (`"1 Kg"`, `"500 g"`, `"750 g"`) es extraíble
  con una regex simple sobre `display_name`/`primary_info.title`.
- **`weight` en el listado de categoría (`plp_items`) viene siempre
  en 0** — no es una fuente fiable, hay que sacarlo del texto sí o sí.
- Multiplicadores de pack (`"pack 6 x 1 L"`) necesitan parsear y
  multiplicar, no son un número único.
- El sufijo `"aprox."` señala que el peso es estimado (producto fresco
  pesado en tienda, no un envase con gramaje fijo de fábrica) — hay
  que distinguirlo del peso exacto de un envase industrial, porque
  cambia cuánto confiar en el número para calcular `price_per_100g`.
- **Trampa real encontrada:** en "Garbanzos cocidos Dia Vegecampo 400
  g", el `400 g` del título es el peso **escurrido** (lo que de verdad
  es garbanzo), pero `product_info.subtitle` dice "Contenido neto:
  540g" (envase completo, con el líquido de gobierno). El campo con
  nombre más "oficial" (`subtitle`, "Contenido neto") es el que **no**
  hay que usar para macros — la tabla nutricional del producto está
  expresada por 100 g de escurrido, no de envase total. Esto solo se
  descubre comparando ambos campos a mano; no hay ninguna señal
  estructural que lo indique.

## Recomendación

**No basta con similitud de texto** (ni siquiera con normalización de
acentos/plurales/stopwords). De los 20 casos, 8 dependen de relación
semántica (sinónimo, tipo-subtipo, o inferencia de que una preparación
no cambia el alimento base) que un matching léxico no captura sin más:
"macarrones" y "pasta alimenticia" no comparten ni una palabra.

**Embeddings (similitud semántica) cubrirían la mayoría de esos 8**:
sinónimos como jamoncito/muslo, plural/singular, tipo/subtipo como
macarrones/pasta, deberían quedar cerca en el espacio vectorial sin
tener que enumerar reglas a mano. Esto coincide con lo que ya estaba
planeado en `PLAN.md` (§5: "matching automático por embeddings + una
pantalla donde tú confirmas o corriges") — esta sonda no cambia el
plan, lo confirma con datos.

**Un LLM no hace falta como paso obligatorio para todos los
productos** — sería caro y lento a escala (cientos de productos por
categoría) para un problema que embeddings + un umbral de confianza
resuelven razonablemente bien. Donde sí puede ganarse su sitio es como
ayuda puntual en el resto tras el filtro de embeddings: casos como
"Cerdo a tacos" (falta información, no ambigüedad de vocabulario) o
"Garbanzos cocidos" (elegir entre dos candidatos razonables) — y aun
ahí, la salida correcta probablemente sea "pídele confirmación al
usuario" en vez de que el LLM decida solo, dado que el propio `PLAN.md`
ya asume una pantalla de confirmación manual como parte del diseño.

**En una frase:** embeddings + umbral de confianza + pantalla de
confirmación manual (tal como ya estaba planeado), sin LLM en el
camino crítico. El caso de "Cuartos traseros de pollo" (el único sin
equivalente de los 20) probablemente deba quedar marcado como "sin
match automático, requiere alta manual" en vez de forzar una
aproximación con baja confianza.
