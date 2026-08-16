# Comparativa de tiendas — diseño del esquema de productos

Sonda exploratoria (fase 2, viabilidad). Resume `NOTES_dia.md`,
`NOTES_mercadona.md`, `NOTES_carrefour.md` y `NOTES_lidl.md`.

**Aviso antes de la tabla:** de las 4 tiendas pedidas, solo **2 dieron
datos reales** — Dia y Mercadona. Carrefour Market está bloqueado por
completo (Cloudflare, HTTP 403 desde la home). Lidl no tiene el dato:
la alimentación no se vende por catálogo online en España, solo por
folleto semanal sin estructura de producto. La tabla de campos, por
tanto, compara Dia vs. Mercadona — meter columnas vacías de Carrefour
y Lidl no aportaría información, solo ruido.

## Tabla por campo

| Campo | Dia | Mercadona |
|---|---|---|
| **Nombre** | `display_name` (listado) / `primary_info.title` (ficha) — texto libre, incluye marca y formato mezclados ("Leche desnatada Dia Láctea 1 L") | `display_name` — texto más limpio, normalmente sin formato mezclado ("Arroz redondo Hacendado") |
| **Marca** | `brand` **solo en el listado**, no en la ficha individual | `brand` **solo en la ficha individual**, no en el listado |
| **Precio** | `prices.price` (listado y ficha) | `price_instructions.unit_price` (listado y ficha) |
| **Precio por unidad** | `prices.price_per_unit` + `prices.measure_unit` — **ya calculado** por Dia | `price_instructions.bulk_price`/`reference_price` + `reference_format` — **ya calculado**, y sobre el peso **escurrido** cuando aplica (ver más abajo) |
| **Gramaje del envase** | **No estructurado y no fiable.** `weight` en el listado viene siempre en `0`. Solo como texto libre dentro del nombre ("1 Kg", "650 g aprox.") o en `product_info.subtitle` de la ficha ("Contenido neto: 1L") — y ese subtitle no siempre está presente | **Estructurado**: `price_instructions.unit_size` + `size_format` (ej. `1.0` + `"kg"`) |
| **Formato / pack** | Solo inferible del texto del nombre ("pack 6 x 1 L") | Estructurado: `is_pack`, `pack_size`, `total_units`, más `packaging` en texto ("Paquete", "Tarro", "Bandeja") |
| **Nutrición** | **Sí, completa**, en la ficha individual (`nutritional_info`): kcal y kJ explícitos (sin ambigüedad de unidad), grasas, hidratos, proteínas, sal. No en el listado. No todos los productos la traen (fresco genérico no) | **No.** `nutrition_information` solo trae `allergens` e `ingredients` en texto libre — nunca macros, verificado en dos productos distintos |
| **Ingredientes** | Sí, en la ficha (`ingredients.text`), texto con marcado HTML simple | Sí, en la ficha (`nutrition_information.ingredients`), texto libre |
| **Código de barras** | **No encontrado** en ningún campo de listado ni ficha | **Sí, explícito**: `ean` en la ficha individual |
| **Stock** | `units_in_stock` (cantidad, en listado y ficha) | No hay cantidad; solo disponibilidad temporal (`published`, `unavailable_from`, `unavailable_weekdays`) |
| **Imagen** | `image` (listado, un thumbnail) / `images` (ficha, varias vistas) | `thumbnail` (listado) / `photos` con `zoom`/`regular`/`thumbnail` (ficha) |
| **Categoría** | `breadcrumb` en la ficha; implícita en la URL | `categories`, anidada con 3 niveles, en listado y ficha |

## Respuestas directas

**¿Qué campos están en las cuatro tiendas?** Ninguno — solo 2 de 4
dieron datos. Entre Dia y Mercadona, lo que coincide en ambas y es
candidato claro a **columna propia en `products`**: nombre, precio,
precio por unidad de medida, imagen, categoría. Todos existen en las
dos, aunque con distinta limpieza (el nombre de Dia mezcla marca y
formato en el mismo texto; el de Mercadona no).

**¿Qué campos existen solo en algunas?** Candidatos a **`jsonb`** en
vez de columna propia, porque su presencia es parcial y su forma
cambia entre fuentes:
- Nutrición completa (macros): solo Dia, y no en todos sus productos.
- `ean`: solo Mercadona.
- Gramaje estructurado (`unit_size`/`size_format`): solo Mercadona: en
  Dia hay que parsear texto libre, con las limitaciones ya descritas.
- Peso escurrido explícito (`drained_weight`): solo Mercadona.
- Info de pack (`pack_size`, `total_units`): solo Mercadona de forma
  estructurada.
- Stock como cantidad: solo Dia (`units_in_stock`); Mercadona solo da
  disponible/no disponible.
- Marca: existe en ambas pero **en sitios distintos** (listado en Dia,
  ficha en Mercadona) — si se quiere marca en el listado agregado hay
  que ir a buscarla al otro endpoint según la tienda, no es uniforme.

**¿Alguna tiene el problema del peso escurrido de las conservas?**
Las dos lo tienen como *dato real* (cualquier tienda que venda
conservas lo tiene), pero solo **Dia tiene el problema sin resolver**:
el peso del nombre es el escurrido, "Contenido neto" es el envase
total, y no hay ninguna señal que lo distinga — hay que comparar ambos
campos a mano (ver `VIABILIDAD_matching_dia_bedca.md`).
**Mercadona ya lo resuelve**: `drained_weight` es un campo explícito y
separado de `unit_size` (envase total), y su `reference_price`
(precio por unidad) está calculado **sobre el escurrido**, no sobre el
envase. Ejemplo real verificado: Garbanzo cocido Hacendado,
`unit_size: 0.57` (kg, envase) vs `drained_weight: 0.4` (kg,
escurrido), `reference_price: 2.00 €/kg` = `0.80€ / 0.4kg` (usa el
escurrido).

**¿Alguna trae código de barras?** Sí: **Mercadona**, campo `ean` en
la ficha de producto individual (ej. `8480000050441`). Dia no lo
expone en ningún campo visto. Esto hace de Mercadona la fuente natural
para cualquier cruce por EAN — tanto entre tiendas como contra Open
Food Facts, que indexa por EAN/GTIN. Un mismo producto de marca
nacional (no marca blanca) debería tener el mismo EAN en Mercadona y
en OFF, lo que da una vía de matching **exacta**, sin ambigüedad de
texto, complementaria al matching semántico por nombre que ya se
evaluó contra BEDCA.

**¿El precio por unidad viene calculado o hay que derivarlo?**
**Viene calculado en las dos.** Dia: `prices.price_per_unit` +
`prices.measure_unit`. Mercadona: `price_instructions.bulk_price` /
`reference_price` + `reference_format`. Ninguna de las dos obliga a
derivarlo a mano — la diferencia importante no es *si* viene
calculado, sino *sobre qué base* cuando hay peso escurrido de por
medio (ver pregunta anterior): Dia lo calcula sobre el envase
completo siempre (sin distinguir escurrido); Mercadona lo calcula
sobre el escurrido cuando `drained_weight` no es null.

## Implicación para el diseño del esquema

- **Columnas propias en `products`** (presentes y limpias en ambas
  fuentes activas): nombre, precio, precio por unidad + su unidad de
  medida, imagen, categoría/breadcrumb.
- **`jsonb` de origen** (o tabla `product_details` aparte) para lo que
  varía por tienda: nutrición, `ean`, gramaje estructurado, peso
  escurrido, info de pack, stock. Forzar estos campos a columnas
  fijas obligaría a dejarlos NULL en la mitad de las filas según la
  tienda de origen, y a mezclar convenciones distintas (Dia sin
  distinguir escurrido, Mercadona sí) en la misma columna sin poder
  saber cuál se usó.
- **`ean` merece tratamiento especial**, no solo como un campo más
  del jsonb: es la única vía de matching *exacto* entre fuentes que
  apareció en esta sonda. Vale la pena una columna propia nullable
  con índice, separada del resto de metadata específica de tienda,
  para poder cruzar por ella directamente en SQL sin tener que entrar
  al jsonb.
- **Carrefour y Lidl no entran en el diseño por ahora** — no hay datos
  que modelar. Si Carrefour se retoma más adelante será con una
  inversión distinta (headless + stealth), no con el mismo patrón de
  cliente HTTP simple que Dia/Mercadona.
