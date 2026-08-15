"""Sonda exploratoria del catalogo de Dia (dia.es).

NO es el scraper de produccion. Descarga una muestra pequena y
deliberadamente acotada (8 categorias, ver NOTES_dia.md) para evaluar
si el matching contra BEDCA es viable, antes de construir nada mas.

Formato del sitio (verificado, ver NOTES_dia.md): Vue + Vike con
server-side routing -- cada pagina trae el estado completo embebido
en un <script id="vike_pageContext" type="application/json">. No hace
falta navegador headless ni llamar a las APIs internas del sitio.

Conservador a proposito: una peticion cada vez (sin paralelizar),
pausa entre peticiones, User-Agent de navegador real y honesto. El
sitio usa Akamai Bot Manager (ver NOTES_dia.md); esta sonda no lo
pone a prueba con volumen alto.

Ejecutar: uv run services/scrapers/explore_dia.py
"""

import json
import re
import ssl
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

import certifi

BASE_URL = "https://www.dia.es"
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
)

REQUEST_DELAY_SECONDS = 1.0

DATA_DIR = Path(__file__).parent / "data"
OUTPUT_FILE = DATA_DIR / "dia_sample.json"

SSL_CONTEXT = ssl.create_default_context(cafile=certifi.where())

# Categorias elegidas para la muestra pedida (pollo, cerdo, arroz,
# pasta, patata, legumbres, fruta, lacteos). Ver NOTES_dia.md para el
# razonamiento de cada eleccion (algunas mezclan algo de ruido, p.ej.
# "patatas y zanahorias" incluye zanahorias, no hay una subcategoria
# de patata sola en el sitio).
CATEGORIES = {
    "pollo": "/carnes/pollo/c/L2202",
    "cerdo": "/carnes/cerdo/c/L2014",
    "arroz": "/arroz-pastas-y-legumbres/arroz/c/L2042",
    "pasta": "/arroz-pastas-y-legumbres/macarrones-espaguetis-y-pastas-secas/c/L2044",
    "patata": "/verduras/patatas-y-zanahorias/c/L2028",
    "legumbres": "/arroz-pastas-y-legumbres/garbanzos-y-alubias/c/L2191",
    "fruta": "/frutas/frutas-de-temporada/c/L2040",
    "lacteos": "/huevos-leche-y-mantequilla/leche/c/L2051",
}

# El listado de categoria (plp_items) ya da nombre/marca/precio/URL
# para TODOS los productos con pocas peticiones (una por pagina de 20).
# Para el formato exacto del envase y saber si trae info nutricional
# hace falta la ficha individual -- eso si es una peticion por
# producto, por eso se limita a una muestra por categoria en vez de
# visitar el catalogo entero.
DETAIL_SAMPLE_PER_CATEGORY = 4

PAGE_CONTEXT_RE = re.compile(
    r'<script id="vike_pageContext" type="application/json">(.*?)</script>',
    re.DOTALL,
)


def fetch_html(path: str) -> str:
    url = path if path.startswith("http") else f"{BASE_URL}{path}"
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=30, context=SSL_CONTEXT) as response:
        return response.read().decode("utf-8")


def extract_page_context(html: str) -> dict:
    match = PAGE_CONTEXT_RE.search(html)
    if not match:
        raise ValueError("No se encontro vike_pageContext en el HTML")
    return json.loads(match.group(1))


def fetch_category_page(category_path: str, page: int) -> dict:
    html = fetch_html(f"{category_path}?page={page}")
    return extract_page_context(html)


def fetch_category_all_pages(category_path: str) -> list[dict]:
    context = fetch_category_page(category_path, 1)
    state = context["INITIAL_STATE"]
    items = list(state["l2"]["plp_items"])
    total_pages = state["pagination"]["pagination"]["total_pages"]

    for page in range(2, total_pages + 1):
        time.sleep(REQUEST_DELAY_SECONDS)
        context = fetch_category_page(category_path, page)
        items.extend(context["INITIAL_STATE"]["l2"]["plp_items"])

    return items


def fetch_product_detail(product_url: str) -> dict:
    html = fetch_html(product_url)
    context = extract_page_context(html)
    return context["INITIAL_STATE"]["product"]


def main() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    result: dict = {"categories": {}}

    for category_name, category_path in CATEGORIES.items():
        print(f"Categoria: {category_name} ({category_path})")
        time.sleep(REQUEST_DELAY_SECONDS)
        try:
            items = fetch_category_all_pages(category_path)
        except (urllib.error.URLError, ValueError, KeyError) as error:
            print(f"  ERROR listando {category_name}: {error}", file=sys.stderr)
            continue
        print(f"  {len(items)} productos en el listado")

        details = {}
        for item in items[:DETAIL_SAMPLE_PER_CATEGORY]:
            time.sleep(REQUEST_DELAY_SECONDS)
            try:
                details[item["sku_id"]] = fetch_product_detail(item["url"])
                print(f"  detalle: {item['sku_id']} {item['display_name']}")
            except (urllib.error.URLError, ValueError, KeyError) as error:
                print(f"  ERROR detalle {item['sku_id']}: {error}", file=sys.stderr)

        result["categories"][category_name] = {
            "path": category_path,
            "items": items,
            "details": details,
        }

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    total_items = sum(len(c["items"]) for c in result["categories"].values())
    total_details = sum(len(c["details"]) for c in result["categories"].values())
    print(f"\nGuardado: {OUTPUT_FILE}")
    print(f"Total productos en listados: {total_items}")
    print(f"Total fichas de detalle descargadas: {total_details}")


if __name__ == "__main__":
    main()
