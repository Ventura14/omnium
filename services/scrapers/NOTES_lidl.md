# Notas de investigación — Lidl (lidl.es)

Sonda exploratoria (fase 2, viabilidad). Verificado el 2026-08-16.
Peticiones usadas: 5 de 150.

## Stack del sitio

No se pudo determinar en profundidad porque no hizo falta llegar tan
lejos (ver conclusión). Composición de página vía CDN edge (comentario
`<!-- empty_kam_esi -->` en el HTML, patrón ESI/Edge Side Includes),
consentimiento y A/B testing con OneTrust + Kameleoon. Nota técnica
propia, no del sitio: la respuesta viene con `content-encoding: gzip`
y hay que pedirla con `curl --compressed` — sin ese flag el body
llega como binario crudo y parece "vacío" al hacer grep, lo cual
casi me hace concluir erróneamente que la página no tenía contenido.

## Autenticación / bloqueo

- `robots.txt` (`https://www.lidl.es/robots.txt`): accesible, bloquea
  rutas de API interna (`/user-api/*`, `/cqe/*`) y parámetros de
  búsqueda/paginación (`search?q=`, `?offset=`, `id=`, `sort=`), pero
  no bloquea la navegación de catálogo en sí.
- CDN de seguridad **Myra** (`server: myracloud` en los headers) — un
  proveedor de protección DDoS/WAF alemán, común en el grupo Schwarz
  (Lidl/Kaufland). No se observó ningún bloqueo real en las 5
  peticiones de esta sonda; se menciona porque el CSP de la página
  referencia `friendlycaptcha.com`, señal de que un captcha existe en
  el sitio para algún flujo (probablemente login/checkout), aunque no
  se disparó navegando el catálogo público.
- No se observó ningún 403/429 en ningún momento.

## Endpoints / estructura de URLs

```
/c/<slug>/s<id>   -> secciones/categorias de contenido
/c/<slug>/a<id>   -> paginas de articulo/promocion
/h/<slug>/h<id>   -> categorias del catalogo "hard goods" (no alimentacion)
```

No se investigó ningún endpoint de API JSON — no hizo falta, el
bloqueador real fue estructural (ver más abajo), no técnico.

## El hallazgo real: Lidl España no vende alimentación por catálogo online

`/c/alimentacion/s10097705` (el enlace de navegación que en el propio
sitio dice "Alimentación") **redirige (301) a**
`/c/descubre-nuevas-ofertas-cada-semana-folletos-lidl/s10087402` —
una página de **folleto de ofertas semanal**, no un catálogo
permanente navegable por categoría con ficha de producto individual
como Dia o Mercadona.

Todo el árbol de navegación real del catálogo online (`/h/...`) es
**exclusivamente no-alimentación**: bricolaje, jardín, moda, hogar,
camping, herramientas, electrodomésticos (`monsieur-cuisine`),
mascotas... Ni una sola categoría de las 8 pedidas (pollo, cerdo,
arroz, pasta, patata, legumbres, fruta, lácteos) tiene equivalente en
esta navegación, porque **la alimentación en Lidl España no se
compra online** — se compra en tienda física, y el canal digital solo
muestra el folleto rotativo de ofertas de la semana (sin catálogo
estable, sin precio por unidad estructurado, sin fichas de producto
individuales navegables).

Esto no es un bloqueo anti-bot ni una protección técnica: es que el
dato que se pidió muestrear **no existe en este canal**, sea cual sea
la técnica usada para acceder a él.

## Formato de respuesta / gramaje / nutrición / anti-bot

No aplica — no hay catálogo de alimentación que muestrear.

## Categorías usadas para la muestra

Ninguna — no existe una categoría equivalente para ninguna de las 8
pedidas.

## Conclusión de la investigación

**No viable, por una razón distinta a Carrefour.** Carrefour bloquea
técnicamente el acceso (Cloudflare). Lidl simplemente **no tiene el
dato**: la alimentación no se vende por catálogo online navegable en
España, solo aparece en folletos de ofertas semanales sin estructura
de producto individual. Ni un scraper perfecto podría extraer de ahí
lo que se pidió (nombre/marca/precio/gramaje/nutrición por producto
estable), porque esa información no existe en ese formato en el sitio.

Siguiendo la instrucción de esta tarea ("si no es viable, documenta
por qué y para, no insistas"): parado aquí, sin explorar el folleto en
sí (que sería un formato completamente distinto — imagen/PDF, no
datos estructurados — y claramente fuera de lo que se pidió muestrear).
