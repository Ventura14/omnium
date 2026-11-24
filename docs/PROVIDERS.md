# Proveedores: tiendas y canales de compra

Este documento dice **qué hay hoy, qué es genérico y qué está fijado a una tienda**, y cómo añadir la tuya. Está escrito contando lo que el código hace de verdad, no lo que sería bonito que hiciera.

## Estado actual

| Pieza | Estado |
|---|---|
| **Dia** (tienda presencial / web) | Implementado: scraper (`services/scrapers/dia.py`), carga a BD (`load_dia_products.py`), fotos (`dia_images.py`). |
| **Glovo sobre Dia** (canal con recargo y comisiones) | Implementado: `load_glovo_channel.py`. Las tarifas del script son las medidas para una dirección concreta; **cámbialas por las tuyas** (ver más abajo). |
| Mercadona, Carrefour, Lidl | Solo sondeadas, sin cargador. Hallazgos en `services/scrapers/NOTES_*.md` y `COMPARATIVA_tiendas.md`. |
| Clase `StoreAdapter` | **No existe.** Dia es un módulo plano. Es el objetivo de diseño, no la realidad. |

## Qué es genérico (no asume ninguna tienda)

El esquema de precios (`supabase/migrations/20260825000000_capa_de_precios.sql` y posteriores) guarda `store` y `channel` como texto libre:

- **`channels`** `(store, channel, markup_pct)`: una vía de compra. `store` = `'dia'`, `'mercadona'`...; `channel` = `'presencial'`, `'glovo'`, `'ubereats'`, `'web'`. `markup_pct` es el recargo sobre el precio base de la tienda (NULL si el canal *es* la base).
- **`products`**: un SKU real, enlazado al `food` genérico del que es una instancia. El `food` aporta los macros; el producto aporta precio y formato.
- **`product_prices`**: una observación de precio en un canal. `source` es `'scraped'`, `'estimated'` o `'manual'` y **es la columna más importante**: un precio de Glovo calculado aplicando un porcentaje al de la tienda es una *estimación*, no una observación.
- **`channel_fees`**: comisiones por canal (entrega, servicio, pedido mínimo...), con suelo, porcentaje y techo.

## Qué está fijado a Dia (limitaciones reales)

Hoy, rellenar esas tablas para otra tienda **no basta**, porque estas piezas filtran por `store = 'dia'` a mano:

- Las vistas `cheapest_dia_proposal`, `shopping_list`, `plan_prorated_cost` y `plan_cost_summary` (la definición vigente de cada una está en la migración más reciente que la recrea).
- Los scripts `load_dia_products.py`, `load_glovo_channel.py` y `dia_images.py` (`STORE = "dia"`).
- La interfaz (`/compra`) pinta lo que esas vistas devuelven.

**Qué haría falta para soportar otra tienda de forma limpia** (no está hecho): una tabla de ajustes con la tienda principal, una migración que recree esas vistas leyéndola en vez del literal `'dia'`, y renombrar `cheapest_dia_proposal`. Es un cambio acotado pero toca vistas que usa la app, así que conviene hacerlo con datos reales delante. Si lo necesitas, abre una issue.

No uses el truco de guardar tu tienda con el slug `dia`: funciona de rebote pero miente en los datos.

## Tu cesta de la compra

Qué busca el scraper no está en el código: es `services/scrapers/basket.json` (fuera de git), un objeto `{ "término de búsqueda": "nombre exacto del alimento" }`.

```bash
cp services/scrapers/basket.example.json services/scrapers/basket.json
```

- Cada valor tiene que ser el `name` exacto de un alimento de `foods` (y, en la práctica, uno `is_staple`).
- **Legumbres y conservas** (reglas 8 y 12 de `CLAUDE.md`): busca el término que dice el estado (`lentejas secas`), nunca el genérico. El scraper no infiere si lo encontrado está seco, cocido o escurrido.
- Sin `basket.json`, los scripts usan `basket.example.json` y lo avisan.

## Comisiones de tu plataforma de reparto

`load_glovo_channel.py` lleva una lista `FEES` con las tarifas de Glovo **medidas en una dirección y un día concretos**. Las comisiones dependen de la dirección, del pedido y de si tienes suscripción, así que **las tuyas serán distintas**: ábrela y sustituye los números (`fee_type, suelo, porcentaje, techo, pedido mínimo`) por el desglose que Glovo te enseña antes de pagar. Ese desglose es lo que hace honesta la comparación tienda vs. reparto.

## Cómo añadir una tienda

1. **Sondea antes de construir.** ¿Hay endpoint JSON o hay que leer HTML? ¿Hay protección anti-bot? Apunta lo que encuentres en `services/scrapers/NOTES_<tienda>.md`, como hicieron Dia y Mercadona.
2. **Escribe el scraper** `services/scrapers/<tienda>.py`. Reglas innegociables:
   - **Regla 9:** máximo 1 petición por segundo, sin paralelizar, backoff exponencial ante 403/429, y parar del todo si el bloqueo persiste. Nunca reintentar en bucle.
   - Deja la salida en `services/scrapers/data/<tienda>_cesta.json` (ignorado por git: son datos de terceros) con la forma de Dia: `{"terms": {término: {"candidates": [{name, sku_id, brand, price, price_per_unit, measure_unit, format_raw, url, macros_100g}]}}}`.
3. **Escribe el cargador** `load_<tienda>_products.py`, modelado en `load_dia_products.py`:
   - crea el `channel` (`insert ... on conflict (store, channel) do nothing`);
   - un `product` por candidato, enlazado al `food` por la cesta;
   - `pack_size_g` **siempre NULL** (regla 8: el peso del título y el contenido neto no son lo mismo; lo confirma una persona);
   - `price_per_kg` solo cuando la tienda ya lo da en kilo; nada de inventar conversiones;
   - un `product_price` con `source = 'scraped'` y la fecha real de la observación.
4. **Cortes de carne y pescado** (regla 14): rodajas, chuletas o piezas con hueso/piel no son comparables por €/kg con filetes limpios. La fracción comestible se confirma a mano en `products.edible_fraction`, nunca se infiere del precio.
5. **Si la tienda es nueva en las vistas**, ver "Qué está fijado a Dia".

## Qué no hace este proyecto

- **Nunca confirma ni paga un pedido** (regla 16). Montar la cesta sí; pagar lo hace siempre una persona, viendo el desglose final.
- No distribuye datos de las tiendas. Los scrapers los descargan en tu máquina; respeta los términos de uso de cada tienda y su protección anti-bot.
