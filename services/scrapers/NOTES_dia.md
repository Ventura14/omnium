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

No todos los productos van a tener `nutritional_info` completo (algunos
frescos como fruta suelta probablemente no lo traigan) — no se verificó
sistemáticamente en esta sonda, solo en la muestra de 20 productos del
informe de viabilidad.

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
