"""Sonda de la cesta real del usuario en Dia (dia.es), por BUSQUEDA de
termino -- no es el scraper de produccion.

Distinto de explore_dia.py (esa sonda navegaba por categoria; esta
busca por termino libre, que es como el usuario compara precios de
verdad). NO se investigo antes el endpoint de busqueda de Dia (ver
NOTES_dia.md, "no se investigo el contrato... porque no hizo falta"),
asi que el patron de URL de busqueda es una hipotesis a verificar en
la primera peticion real, no un hecho confirmado.

Regla dura 9 (CLAUDE.md), sin excepcion: 1 peticion/segundo, SIN
paralelizar, backoff exponencial ante 403/429 con un limite duro de
reintentos, y si el bloqueo persiste, PARAR del todo -- no seguir con
el siguiente termino, no reintentar en bucle. Akamai Bot Manager
protege el sitio; esta sonda es deliberadamente conservadora.

Solo lee y guarda JSON crudo. Nada de escritura en base de datos,
nada de matching, nada de parsear el gramaje a numero (regla 8: las
conservas mienten, y el texto libre de Dia es un problema aparte).

Ejecutar: uv run services/scrapers/dia.py
"""

import json
import re
import ssl
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

import certifi

from basket import load_basket

BASE_URL = "https://www.dia.es"
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
)

REQUEST_DELAY_SECONDS = 1.0
MAX_CANDIDATES_PER_TERM = 5

# Backoff ante 403/429: 3 intentos como mucho, nunca en bucle. Si el
# tercero tambien falla, se para la sonda entera -- un bloqueo real de
# Akamai no se resuelve reintentando mas fuerte.
MAX_RETRIES = 3
BACKOFF_BASE_SECONDS = 2.0

DATA_DIR = Path(__file__).parent / "data"
OUTPUT_FILE = DATA_DIR / "dia_cesta.json"

SSL_CONTEXT = ssl.create_default_context(cafile=certifi.where())

# Los terminos a buscar salen de la cesta (basket.json), no del codigo.

PAGE_CONTEXT_RE = re.compile(
    r'<script id="vike_pageContext" type="application/json">(.*?)</script>',
    re.DOTALL,
)


class BlockedError(Exception):
    """Akamai (u otro) bloqueo persistente tras agotar MAX_RETRIES."""


def fetch_html(url: str) -> str:
    """Una peticion, con backoff ante 403/429 hasta MAX_RETRIES. Si se
    agotan los intentos, lanza BlockedError -- el llamador debe parar
    la sonda entera, no seguir con el siguiente termino."""
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    last_error = None
    for attempt in range(MAX_RETRIES):
        try:
            with urllib.request.urlopen(request, timeout=30, context=SSL_CONTEXT) as response:
                return response.read().decode("utf-8")
        except urllib.error.HTTPError as error:
            last_error = error
            if error.code not in (403, 429):
                raise
            wait = BACKOFF_BASE_SECONDS * (2**attempt)
            print(
                f"    HTTP {error.code}, intento {attempt + 1}/{MAX_RETRIES}, "
                f"esperando {wait:.0f}s...",
                file=sys.stderr,
            )
            time.sleep(wait)
    raise BlockedError(f"Bloqueado tras {MAX_RETRIES} intentos: {last_error}")


def extract_page_context(html: str) -> dict:
    match = PAGE_CONTEXT_RE.search(html)
    if not match:
        raise ValueError("No se encontro vike_pageContext en el HTML")
    return json.loads(match.group(1))


def find_product_list(node, _depth: int = 0) -> list[dict] | None:
    """Busca recursivamente el primer array de productos dentro del
    JSON de la pagina -- no se conoce a priori la clave exacta que usa
    la pagina de busqueda (a diferencia de la de categoria,
    l2.plp_items, nunca antes investigada para busqueda). Un
    "producto" se reconoce por su forma documentada en NOTES_dia.md:
    un dict con sku_id y display_name.
    """
    if _depth > 8:
        return None
    if isinstance(node, list):
        if node and all(
            isinstance(item, dict) and "sku_id" in item and "display_name" in item
            for item in node
        ):
            return node
        for item in node:
            found = find_product_list(item, _depth + 1)
            if found is not None:
                return found
    elif isinstance(node, dict):
        for value in node.values():
            found = find_product_list(value, _depth + 1)
            if found is not None:
                return found
    return None


def search_term(term: str) -> list[dict]:
    """Hipotesis a verificar en la primera peticion real: pagina de
    busqueda SSR en /search?q=<termino>, mismo patron vike_pageContext
    que las paginas de categoria. Si esto no funciona, hay que mirar
    el HTML crudo a mano antes de intentar otra URL -- no adivinar en
    bucle."""
    url = f"{BASE_URL}/search?q={urllib.parse.quote(term)}"
    html = fetch_html(url)
    context = extract_page_context(html)
    products = find_product_list(context)
    return products or []


def summarize_candidate(product: dict) -> dict:
    prices = product.get("prices", {})
    return {
        "name": product.get("display_name"),
        "sku_id": product.get("sku_id"),
        "brand": product.get("brand"),
        "price": prices.get("price"),
        "price_per_unit": prices.get("price_per_unit"),
        "measure_unit": prices.get("measure_unit"),
        "format_raw": product.get("display_name"),  # el gramaje solo aparece como texto libre aqui o en la ficha; no se parsea (regla 8)
        "url": BASE_URL + product["url"] if product.get("url") else None,
    }


def fetch_macros(product_url: str) -> dict | None:
    """Ficha individual: puede traer nutritional_info completo (ver
    NOTES_dia.md). No todos los productos lo traen -- None si no."""
    html = fetch_html(product_url)
    context = extract_page_context(html)
    product = context.get("INITIAL_STATE", {}).get("product", {})
    nutritional = product.get("nutritional_info", {}).get("nutritional_values")
    return nutritional


def main() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    result: dict = {"terms": {}}
    terms_with_results = 0
    terms_without_results = 0
    blocked_at = None

    for term in load_basket():
        print(f"Buscando: {term!r}")
        time.sleep(REQUEST_DELAY_SECONDS)
        try:
            products = search_term(term)
        except BlockedError as error:
            print(f"  BLOQUEADO: {error}", file=sys.stderr)
            blocked_at = term
            break
        except (urllib.error.URLError, ValueError) as error:
            print(f"  ERROR: {error}", file=sys.stderr)
            result["terms"][term] = {"error": str(error), "candidates": []}
            terms_without_results += 1
            continue

        if not products:
            print("  0 resultados")
            terms_without_results += 1
            result["terms"][term] = {"candidates": []}
            continue

        terms_with_results += 1
        candidates = [summarize_candidate(p) for p in products[:MAX_CANDIDATES_PER_TERM]]

        for candidate in candidates:
            if not candidate["url"]:
                continue
            time.sleep(REQUEST_DELAY_SECONDS)
            try:
                candidate["macros_100g"] = fetch_macros(candidate["url"])
            except BlockedError as error:
                print(f"  BLOQUEADO (ficha de {candidate['name']}): {error}", file=sys.stderr)
                blocked_at = term
                break
            except (urllib.error.URLError, ValueError) as error:
                candidate["macros_100g"] = None
                print(f"  ERROR ficha {candidate['name']}: {error}", file=sys.stderr)
        else:
            result["terms"][term] = {"candidates": candidates}
            print(f"  {len(candidates)} candidatos")
            continue
        # Se llego aqui via el break de dentro del bucle de candidatos -> bloqueo real
        result["terms"][term] = {"candidates": candidates}
        break

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    print(f"\nGuardado: {OUTPUT_FILE}")
    print(f"Terminos con resultados: {terms_with_results}")
    print(f"Terminos sin resultados: {terms_without_results}")
    if blocked_at:
        print(f"BLOQUEADO en el termino: {blocked_at!r} -- sonda detenida, no se completaron los 24.")


if __name__ == "__main__":
    main()
