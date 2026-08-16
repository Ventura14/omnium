# Notas de investigación — Mercadona (tienda.mercadona.es)

Sonda exploratoria (fase 2, viabilidad). Verificado el 2026-08-16.
Peticiones usadas: ~54 de 150.

## Stack del sitio

React SPA (Create React App: bundle `main.<hash>.js`, `<div id="root">`)
**sin SSR**: el HTML inicial no trae ningún dato, solo el esqueleto y
el bundle. Todo el catálogo se sirve desde una **API JSON pública
propia**, sin autenticación, en un host distinto (`tienda.mercadona.es`,
la web principal es `www.mercadona.es`). El usuario ya sabía que
existía; se confirmó extrayendo `API_HOST` directamente del bundle JS
del sitio en vez de asumir la URL de memoria.

**No hace falta navegador headless.** La API responde JSON directo a
peticiones HTTP simples.

## Autenticación / bloqueo

- `robots.txt` (`https://www.mercadona.es/robots.txt`): `Disallow:`
  vacío — todo permitido.
- Ninguna señal de protección anti-bot (sin Cloudflare, sin Akamai, sin
  cookies de fingerprinting) en ninguna de las ~54 peticiones de esta
  sonda.
- No requiere API key ni token. El único header no estándar visto en
  el bundle es `x-version: v532` (versión del cliente), pero las
  peticiones funcionan igual sin él.
- No se observó ningún 403/429/challenge en ningún momento.

## Endpoints descubiertos

```
GET https://tienda.mercadona.es/api/categories/
    -> arbol de categorias, 3 niveles (padre / medio / hoja)

GET https://tienda.mercadona.es/api/categories/{id}/
    -> SOLO funciona para categorias de nivel "medio" (ej. 29=Verdura).
       Devuelve las subcategorias hoja con sus productos ya anidados.
       Para IDs de categoria hoja (ej. 854=Patata) da 404 -- sus
       productos vienen dentro de la respuesta del padre, no tienen
       endpoint propio.

GET https://tienda.mercadona.es/api/products/{id}/
    -> ficha de producto individual completa
```

## Estructura de URLs (frontend, no API)

`https://tienda.mercadona.es/product/{id}/{slug}` — URL "de compartir"
(`share_url` en la respuesta de la API), no hizo falta visitarla para
nada, todo el dato viene de la API.

## Paginación

**No se observó paginación en las categorías de esta muestra** (la de
más productos, lácteos, trajo 118 productos en una sola respuesta sin
parámetro de página). El endpoint raíz `/api/categories/` sí tiene la
forma estándar de Django REST Framework (`count`, `next`, `previous`,
`results`) pero con `next: null` siempre en lo probado — no se llegó a
ver un caso con más de una página.

## Formato de respuesta — listado de categoría

Cada categoría "hoja" trae un array `products` anidado dentro de la
categoría "medio":

```json
{
  "id": "5044",
  "slug": "arroz-redondo-hacendado-paquete",
  "display_name": "Arroz redondo Hacendado",
  "packaging": "Paquete",
  "share_url": "https://tienda.mercadona.es/product/5044/...",
  "thumbnail": "https://prod-mercadona.imgix.net/images/....jpg?...",
  "categories": [{"id": 13, "name": "Arroz, legumbres y pasta", ...}],
  "price_instructions": {
    "bulk_price": "1.15",
    "unit_price": "1.15",
    "size_format": "kg",
    "reference_price": "1.150",
    "reference_format": "kg",
    "drained_weight": null,
    "is_pack": false,
    "pack_size": null,
    "unit_size": 1.0
  }
}
```

**No hay `brand` ni `ean` en el listado** — solo en la ficha
individual. Tampoco hay info nutricional en el listado.

## Formato de respuesta — ficha de producto individual

Bastante más rica que el listado:

```json
{
  "id": "5044",
  "ean": "8480000050441",
  "brand": "Hacendado",
  "is_variable_weight": false,
  "is_bulk": false,
  "details": {
    "legal_name": "Arroz Redondo",
    "description": "Arroz redondo Hacendado",
    "storage_instructions": "...",
    "usage_instructions": "..."
  },
  "nutrition_information": {
    "allergens": "...",
    "ingredients": "Arroz"
  },
  "price_instructions": { "...": "igual que en el listado" }
}
```

**`nutrition_information` NUNCA trae macros** (kcal, proteína,
carbohidratos, grasa) — se comprobó en dos productos distintos (arroz
simple y leche semidesnatada, de los más simples y estandarizados
posibles) y en ambos solo trae `allergens` e `ingredients` en texto
libre. A diferencia de Dia, **Mercadona no expone valores
nutricionales estructurados vía esta API**, aunque el envase físico
seguro que los lleva impresos.

## Código de barras

**Sí, y explícito: campo `ean`** en la ficha de producto individual
(`"ean": "8480000050441"`). Es el hallazgo más importante de esta
tienda para el diseño del esquema — es la clave natural para cruzar
el mismo producto entre tiendas y contra Open Food Facts (que indexa
por EAN/GTIN).

## Gramaje del envase y precio por unidad

**El mejor de las tiendas investigadas hasta ahora, con diferencia.**
Todo viene en `price_instructions`, estructurado, sin necesidad de
parsear texto libre:

- `unit_size` + `size_format`: tamaño del envase con su unidad
  (`1.0` + `"kg"`, o `0.57` + `"kg"` para un tarro de 570 g).
- `is_pack` + `pack_size` + `total_units`: si es un pack, cuántas
  unidades y de qué tamaño cada una.
- `drained_weight`: **peso escurrido explícito**, no null en
  conservas. Ejemplo real (Garbanzo cocido Hacendado, tarro):
  `unit_size: 0.57` (envase total) vs `drained_weight: 0.4`
  (escurrido).
- `reference_price` / `reference_format`: precio por unidad de medida
  **ya calculado por Mercadona** — y en el mismo ejemplo, `0.80€ /
  0.4kg = 2.00€/kg`, es decir, **el `reference_price` está calculado
  sobre el peso escurrido, no sobre el envase total** (`bulk_price`
  usa el envase total: `0.80€ / 0.57kg = 1.40€/kg`). Mercadona ya
  resuelve internamente la misma trampa que documentamos con Dia.

## Categorías usadas para la muestra

| Pedido | Categoría Mercadona | id |
|---|---|---|
| pollo | Carne > Aves y pollo | 38 |
| cerdo | Carne > Cerdo | 37 |
| arroz | Arroz, legumbres y pasta > Arroz | 118 |
| pasta | Arroz, legumbres y pasta > Pasta y fideos | 120 |
| patata | Fruta y verdura > Verdura > Patata | 854 |
| legumbres | Arroz, legumbres y pasta > Legumbres | 121 |
| fruta | Fruta y verdura > Fruta | 27 |
| lácteos | Huevos, leche y mantequilla > Leche y bebidas vegetales | 72 |

Nota: "Aves y pollo" (38) mezcla pollo y pavo — los 4 primeros
productos de la muestra de detalle salieron ser todo pavo, por orden
de aparición, no por selección deliberada.

Nota: "patata" (854) es un caso especial de la estructura de 3
niveles — no tiene endpoint propio, sus productos vinieron anidados
al consultar el nivel medio (29, Verdura) y filtrar la subcategoría.

## Conclusión de la investigación

**Viable, y con diferencia la fuente de mejor calidad estructural de
las investigadas hasta ahora.** API JSON pública real, sin
autenticación, sin protección anti-bot, con EAN y con el peso
escurrido ya resuelto — pero sin macros nutricionales, que es
exactamente lo que Dia sí trae. Las dos tiendas se complementan más
que se solapan.
