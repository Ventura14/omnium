# Notas de investigación — Carrefour Market (carrefour.es)

Sonda exploratoria (fase 2, viabilidad). Verificado el 2026-08-16.

**Peticiones usadas: 3 de 150.** Parada inmediata por bloqueo, tal
como indican los límites duros de esta tarea.

## Stack del sitio

No se pudo determinar. `robots.txt` es accesible y revela pistas
(sitemaps separados para `sitemap-food` y `sitemap-bodega`, rutas
`/browse/*` y `/c?...` para navegación de catálogo, parámetros de
filtro tipo `F-*Z*Z*`) que sugieren una plataforma de e-commerce
convencional con navegación facetada, pero no se pudo confirmar nada
más allá de eso.

No hay un dominio separado para "Carrefour Market" — es una sección
dentro de `carrefour.es`, el mismo dominio que el hipermercado
general.

## Autenticación / bloqueo

**Bloqueado por Cloudflare Bot Management en todo el dominio.**

1. `GET /robots.txt` → **200 OK**, contenido servido normal (robots.txt
   suele quedar exento de la protección).
2. `GET /crs/cdn-static/sitemap-food/index.xml` → bloqueado, página de
   Cloudflare "Attention Required! / Sorry, you have been blocked".
3. `GET /` (home, para comprobar si era ese endpoint concreto o todo
   el dominio) → **HTTP 403**, misma página de Cloudflare. Headers:
   `server: cloudflare`, cookie `__cf_bm` (la firma estándar de
   Cloudflare Bot Management, distinta de un simple rate-limit).

El bloqueo llegó en la segunda petición real (la primera después de
robots.txt) con un User-Agent de navegador normal y sin ningún patrón
de volumen — no es un límite de frecuencia, es un bloqueo por
fingerprinting (TLS/HTTP2, JS challenge, o similar) que un cliente
HTTP simple sin motor de JS no puede superar.

Siguiendo la regla explícita de esta tarea ante un 403/429/challenge:
**se paró aquí, sin reintentar, sin rotar User-Agent, sin buscar
evasión.**

## Endpoints descubiertos

Ninguno confirmado — no se llegó a ver ninguna respuesta con
contenido real más allá de `robots.txt`.

## Estructura de URLs

No confirmado. Por `robots.txt` se intuye navegación vía `/browse/*`
y `/c?...` (parámetros de filtro/orden), pero sin poder cargar una
página real no se puede confirmar el patrón.

## Formato de respuesta

No aplica — no se obtuvo ninguna respuesta con datos.

## Categorías usadas para la muestra

No aplica — no se llegó a esta fase.

## Conclusión de la investigación

**No viable con peticiones HTTP simples.** Cloudflare Bot Management
bloquea el dominio completo desde la primera petición de contenido
real (todo excepto `robots.txt`). Un scraper de producción necesitaría
como mínimo un navegador headless con fingerprinting realista
(Playwright/Puppeteer con stealth), y probablemente seguiría siendo
frágil — Cloudflare Bot Management es de los sistemas anti-bot más
agresivos del mercado, no un simple rate-limit que se resuelva con
pausas. Coincide con lo que ya anotaba `PLAN.md` (§2.3): "Carrefour
Market — accesible pero con protección anti-bot intermitente"; en esta
sonda concreta no fue ni siquiera intermitente, fue inmediato.

**Viable: NO**, con las herramientas usadas en esta sonda (peticiones
HTTP simples sin navegador). Requeriría una inversión mucho mayor
(headless + stealth) que no está justificada sin antes confirmar que
Mercadona o Lidl no cubren ya la necesidad.
