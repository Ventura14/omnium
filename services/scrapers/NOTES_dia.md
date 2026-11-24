# Notas de investigación — web de Dia (dia.es)

Sonda exploratoria (fase 2, viabilidad). Verificado contra el sitio real
el 2026-08-15, no contra documentación de terceros.

## Stack del sitio

Vue + [Vike](https://vike.dev/) (antes vite-plugin-ssr) con **server-side
routing**: el HTML de cada página viene con los datos ya renderizados en
servidor, no hace falta ejecutar JS ni interceptar llamadas AJAX. Cada
página incluye un `<script id="vike_pageContext" type="application/json">`
con todo el estado inicial como JSON.

Esto es la pieza clave: **no hace falta un navegador headless**. `curl` +
parseo de ese único `<script>` es suficiente.

## Autenticación / bloqueo

- `robots.txt` (`https://www.dia.es/robots.txt`) menciona **Algolia**
  varias veces ("Reduce Algolia hits without affecting positioning"),
  pero no hay llamadas a Algolia visibles desde el cliente — el buscador
  interno usa un backend propio (`search-back`, ver más abajo) que
  probablemente llama a Algolia server-side.
- El sitio usa **Akamai Bot Manager**: las respuestas traen cookies
  `_abck` y `bm_sz` (firma clásica de Akamai). No se observó ningún
  bloqueo ni challenge en ~15 peticiones de prueba con `curl` y un
  User-Agent de navegador normal, pero es una protección por
  comportamiento/fingerprinting, no un límite numérico — un volumen alto
  y sostenido probablemente sí la dispare. No se puso a prueba ese
  límite en esta sonda (deliberadamente: "sé conservador").
- No se encontraron headers de rate-limit explícitos (`X-RateLimit-*`,
  `Retry-After`).
- No hace falta login ni token para navegar el catálogo público.

## Endpoints descubiertos

El propio HTML expone la tabla de endpoints del backend
(`INITIAL_STATE.endpoints` en el JSON embebido), pensada para que el
frontend los llame vía AJAX en navegación posterior (no hace falta
para esta sonda, ya que el SSR ya trae los datos, pero queda documentado
para referencia futura):

```
pdp            https://www.dia.es/api/v1/pdp-back           (ficha de producto)
search         https://www.dia.es/api/v1/search-back         (buscador)
commonAggregator https://www.dia.es/api/v1/common-aggregator
cart           https://www.dia.es/api/v1/cart
list           https://www.dia.es/api/v1/list-back
```

No se investigó el contrato de estos endpoints porque no hizo falta:
el HTML renderizado ya trae todo.

## Estructura de URLs

- Página de categoría/listado: `/<categoria>/<subcategoria>/c/<id>`
  (ej. `/huevos-leche-y-mantequilla/leche/c/L2051`)
- Página de producto individual: `/<categoria>/<subcategoria>/p/<sku_id>`
  (ej. `/huevos-leche-y-mantequilla/leche/p/607`)
- Paginación de categoría: parámetro de query `?page=N` sobre la URL de
  categoría (probado hasta la página 2, funciona). También existe una
  variante de URL "bonita" `.../pag-N/c/<id>` que aparece en los enlaces
  del propio HTML, pero no se probó — `?page=N` es más simple de
  construir y ya confirmado.
- El árbol completo de categorías (id, nombre, subcategorías) está en
  `INITIAL_STATE.header.categoriesData.categories` de cualquier página,
  incluida la home. No hace falta adivinar IDs de categoría a mano.

## Formato de respuesta — listado de categoría

`INITIAL_STATE.l2.plp_items` es un array con un objeto por producto:

```json
{
  "brand": "Dia Láctea",
  "display_name": "Leche semidesnatada Dia Láctea pack 6 x 1 L",
  "object_id": "504P6",
  "sku_id": "504P6",
  "prices": {
    "currency": "EUR",
    "measure_unit": "LITRO",
    "price": 5.04,
    "price_per_unit": 0.84,
    "discount_percentage": 0,
    "is_promo_price": false
  },
  "url": "/huevos-leche-y-mantequilla/leche/p/504P6",
  "image": "/product_images/504P6/504P6_ISO_0_ES.jpg",
  "weight": 0,
  "units_in_stock": 968
}
```

`INITIAL_STATE.pagination.pagination` trae `page_number`, `page_size`
(20) y `total_pages` — no hace falta adivinar cuántas páginas hay.

**`weight` viene siempre en 0** en el listado (no fiable ahí). El
formato/gramaje real solo aparece como texto libre dentro de
`display_name` ("pack 6 x 1 L", "1 L"...) o en la ficha de producto
individual (ver abajo, `product_info.subtitle`).

## Formato de respuesta — ficha de producto individual

`INITIAL_STATE.product` trae mucho más, incluida **información
nutricional completa por 100g/100ml** — no esperaba encontrar esto:

```json
{
  "primary_info": {"title": "Leche desnatada Dia Láctea 1 L"},
  "product_info": {
    "product": "Leche desnatada UHT",
    "subtitle": "Contenido neto: 1L"
  },
  "prices": {"price": 0.82, "price_per_unit": 0.82, "measure_unit": "LITRO"},
  "nutritional_info": {
    "nutritional_values": {
      "energy_value": 34, "energy_value_kj": 145,
      "measure_unit": "kcal", "measure_unit_kj": "kJ",
      "values": [
        {"title": "Grasas", "value": 0.3, "value_per_100_g": 0.3, "measure_unit": "g"},
        {"title": "Hidratos de Carbono", "value": 4.8, "value_per_100_g": 4.8, "measure_unit": "g"},
        {"title": "Proteínas", "value": 3.2, "value_per_100_g": 3.2, "measure_unit": "g"},
        {"title": "Sal", "value": 0.1, "value_per_100_g": 0.1, "measure_unit": "g"}
      ]
    }
  },
  "manufacturer_contact": {"manufacturer_contact_name": "Lactalis P., S.L."},
  "ingredients": {"text": "..."}
}
```

`energy_value`/`energy_value_kj` vienen **ambos ya en la misma unidad
que usamos** (kcal directo, sin necesidad de convertir) — a diferencia
de BEDCA, aquí no hay ambigüedad de unidad porque trae los dos valores
explícitos.

**CORRECCIÓN (2026-08-24):** lo anterior afirmaba "sin ambigüedad" y
es falso — no hay ambigüedad de UNIDAD, pero sí puede haber
contradicción de VALOR. Caso real: "Claras de huevo pasteurizadas
Ovonatur 500 ml" trae `energy_value: 0` con `energy_value_kj: 205` en
la misma ficha — 205 kJ / 4.184 ≈ 49 kcal, coherente con sus propios
macros (Atwater: 4×10.5 + 4×0.5 + 9×0.3 = 46.7), así que el `0` es un
dato ausente disfrazado de medición, no "cero calorías" de verdad. Que
`energy_value` y `energy_value_kj` existan los dos NO garantiza que
digan lo mismo. Cualquier importador que lea esta ficha debe comprobar
que `energy_value × 4.184 ≈ energy_value_kj` antes de confiar en
`energy_value` a solas (ver `cheapest_dia_proposal`, columna
`kj_contradiction`, que ya lo hace).

Verificado en la sonda de búsqueda por término (2026-08-24,
`dia.py`, no `explore_dia.py`): cada entrada de `values` puede traer
un `items` anidado con el desglose ("Grasas" trae "de las cuales
saturadas", "Hidratos de Carbono" trae "de los cuales azúcares") que
no aparecía en la muestra de categoría de más arriba — el nivel top
(Grasas/Hidratos de Carbono/Proteínas/Sal) es el mismo, pero hay más
detalle disponible del que se documentó aquí en su momento.

**Convención de carbohidratos:** Dia es una etiqueta europea
(Reglamento 1169/2011) — "Hidratos de Carbono" declara EXCLUYENDO
fibra, igual que cualquier etiqueta europea (ver CLAUDE.md, tabla de
vocabulario). Si algún día se ingieren estos macros a `foods`, entran
con `carbs_convention = 'net'`.

No todos los productos van a tener `nutritional_info` completo (algunos
frescos como fruta suelta probablemente no lo traigan) — no se verificó
sistemáticamente en esta sonda, solo en la muestra de 20 productos del
informe de viabilidad.

**El formato del corte cambia la fracción comestible (2026-08-24):**
en "merluza congelada", "Rodajas de merluza argentina" gana por
€/kg (7.62) y hasta por €/g de proteína real (0.0423) sobre "Filetes
... sin piel" (8.73 €/kg, 0.0553 €/g) — pero una rodaja es un corte
transversal con espina y piel, cuya porción comestible ronda el
70-80% del peso del paquete. Al 75%, su coste real por kilo de
pescado comible sube a ~10.16 €/kg, más caro que los filetes. La
señal está en los propios macros: 107 kcal/100g contra 74-82 de los
filetes no es que la rodaja sea más grasa, es que se está
promediando pescado con hueso. Ninguna columna de `cheapest_dia_proposal`
detecta esto todavía — es un punto ciego conocido, no resuelto.
Misma trampa que el peso escurrido de las conservas (regla 8), en
otro envase: el peso del paquete no es el peso del alimento.

## Categorías usadas para la muestra

| Pedido | Categoría Dia | URL |
|---|---|---|
| pollo | Carnes > Pollo | `/carnes/pollo/c/L2202` |
| cerdo | Carnes > Cerdo | `/carnes/cerdo/c/L2014` |
| arroz | Arroz, pastas y legumbres > Arroz | `/arroz-pastas-y-legumbres/arroz/c/L2042` |
| pasta | Arroz, pastas y legumbres > Macarrones, espaguetis y pastas secas | `/arroz-pastas-y-legumbres/macarrones-espaguetis-y-pastas-secas/c/L2044` |
| patata | Verduras > Patatas y zanahorias | `/verduras/patatas-y-zanahorias/c/L2028` |
| legumbres | Arroz, pastas y legumbres > Garbanzos y alubias | `/arroz-pastas-y-legumbres/garbanzos-y-alubias/c/L2191` |
| fruta | Frutas > Frutas de temporada | `/frutas/frutas-de-temporada/c/L2040` |
| lácteos | Huevos, leche y mantequilla > Leche | `/huevos-leche-y-mantequilla/leche/c/L2051` |

"Patatas y zanahorias" y "Leche" mezclan algo de ruido (zanahorias no
pedidas; "lácteos" pedido es más amplio que solo leche, no incluye
quesos/yogures) pero son las subcategorías más cercanas a lo pedido sin
inventar una categoría que no existe en el sitio.

## Conclusión de la investigación

Viable sin navegador headless, sin necesidad de las APIs internas
(`search-back`, `pdp-back`) descubiertas — el SSR ya trae todo. Riesgo
real: Akamai Bot Manager en volumen alto sostenido, no probado aquí a
propósito.

## Imágenes de producto (2026-08-29)

`product.images` en la ficha individual (`INITIAL_STATE.product`, no
en el listado de categoría) es un array de rutas relativas, la
primera es la vista "ISO" (estudio) — confirmado con una sonda de un
producto antes de escribir `dia_images.py`. No estaba en el JSON del
scrape original (`dia.py`, solo guardaba `macros_100g`), hizo falta
un segundo paso dirigido solo a los ganadores de `shopping_list` (23
productos, no los 108 del catálogo completo).

**Descargadas, redimensionadas a 240px y guardadas en `public/products/`
del repo — NO en Supabase Storage.** Decisión explícita, no la
opción por defecto: Storage exigía una `SUPABASE_SERVICE_ROLE_KEY`
que no existe en este entorno, y la alternativa de escribir con la
`anon key` (ya pública por diseño) habría dejado el bucket abierto a
escritura de cualquiera. Se descartó por riesgo de seguridad, no se
implementó ni se ofreció como atajo.

`public/products/` gana hoy por tamaño: 23 imágenes a 240px son
~400 KB en total (9.7 MB en crudo a resolución completa, medido
antes de decidir). Origen del mismo servidor que la página — una
dependencia externa menos justo en el escenario que importa (súper
con mala cobertura). Las originales a resolución completa se
guardan fuera del repo, en `services/scrapers/data/images/`
(gitignored), por si algún día hace falta otro tamaño sin volver a
pedírselo a Dia.

**Coste real de esta decisión, no ocultarlo:** los ganadores de
`shopping_list` cambian (patata, huevos y lomo lo han hecho varias
veces en este mismo proyecto) — con `public/`, cada cambio de
ganador necesita descargar la foto nueva y desplegar, no solo
actualizar una fila. Se acepta porque ese cambio YA pasa por
revisión humana explícita en este proyecto (`chosen_by_user`,
`pack_size_g`, `edible_fraction`) — la foto nueva viaja en un commit
que de todos modos iba a existir.

**Criterio de reversión a Storage, para cuando deje de tener
sentido:** si el catálogo de productos crece mucho más allá de los
~25 actuales, o si algún día las fotos se actualizan sin revisión
humana (un cron sin confirmación manual, por ejemplo), Storage gana
— desacopla la foto del deploy. No es una decisión para siempre, es
la correcta al tamaño de hoy (regla dura 6, CLAUDE.md).

`products.image_url` guarda la URL de ORIGEN en dia.es, no la ruta
donde se sirve — sirve para comprobar en el futuro si la foto sigue
siendo la misma sin re-rastrear el catálogo, y para re-descargar si
hace falta. Nullable: sin foto, sin fila con hueco reservado (el
usuario señaló que un cuadro gris vacío ocupa sitio sin aportar).

Si el repo se abre alguna vez como open source, `public/products/`
hay que vaciarlo antes — son imágenes de Dia, no del proyecto. Es un
paso de checklist de esa migración, no un impedimento para hacerlo
ahora.

## Primera validación contra tickets de compra reales (2026-09-08)

Se contrastaron dos tickets reales de un Dia (dos compras de
septiembre de 2026) -- primera vez que los precios
y pesos raspados se contrastan contra una compra de verdad, no solo
contra lo que la web de Dia publica.

**Precios: 4 de 6 exactos.** Coinciden al céntimo: huevos L 3,05 €,
manzana roja 2,19 €, plátano 1,50 €/kg, cinta de lomo adobada
7,49 €/kg. Difieren: arroz extra (1,20 € web vs 1,15 € ticket) y
escalopín de lomo marinado (3,99 € web vs 4,49 € ticket) -- sin
investigar la causa (¿oferta puntual? ¿cambio de precio entre el
scrape y la compra?), solo constatado. 4 de 6 es una señal razonable
para la comparación Dia/Glovo, que descansa entera en estos precios.

**Un aviso sobre interpretar diferencias de precio: no asumir que es
el mismo producto.** Se llegó a leer 6,99 € → 6,49 €/kg de pechuga
de pollo como una bajada de precio -- era falso. Son dos SKUs
distintos comprados en semanas distintas ("Pechugas enteras de
pollo 700 g" a 6,99 €/kg, "Pechuga entera formato familiar 1.3 Kg" a
6,49 €/kg). Un mismo nombre coloquial ("pechuga de pollo") puede
tapar dos productos con precio distinto -- comprobar el SKU/nombre
exacto antes de comparar precios entre fechas.

**La alerta de "el aprox. se queda corto" no tiene evidencia: retirada
(2026-09-14).** Las cuatro comparaciones que aquí figuraban durante
tres semanas ("declarado" 700/1300/900/1000 g contra "pesado real"
601/894/802/900 g) medían algo que no era lo que decían medir: los
cuatro artículos se venden A PESO (confirmado contra la columna
PRECIO KG de los tickets originales del 01/09 y 08/09) -- la caja
cobra exactamente lo que marca la balanza, así que un peso real por
debajo del "aprox." no es dinero perdido, es solo una pieza más
ligera que la media. 9 de 9 artículos pesados en los tres tickets
acumulados (01/09, 08/09, 13/09) resultaron ser a peso. Sigue sin
comprobar si algún envase de PRECIO FIJO con peso "aprox." se queda
corto de verdad -- ahí sí habría dinero de por medio. El escalopín de
lomo marinado es el candidato obvio para comprobarlo (precio fijo,
4,49 €, se compra casi cada semana) en cuanto se pese uno en casa.
