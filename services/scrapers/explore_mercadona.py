"""Sonda exploratoria del catalogo de Mercadona (tienda.mercadona.es).

NO es el scraper de produccion. Descarga una muestra pequena y
deliberadamente acotada (8 categorias, ver NOTES_mercadona.md) para
comparar contra Dia antes de decidir el diseño del esquema de
productos.

API JSON publica y sin autenticacion, descubierta en el bundle JS del
sitio (API_HOST: "//tienda.mercadona.es/api"). No requiere navegador
headless.

Conservador a proposito: 1 peticion por segundo, sin paralelizar,
User-Agent de navegador real. Limite duro de 150 peticiones totales
para esta sonda.

Ejecutar: uv run services/scrapers/explore_mercadona.py
"""

import json
import ssl
import time
import urllib.error
import urllib.request
from pathlib import Path

import certifi

API_BASE = "https://tienda.mercadona.es/api"
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
)

REQUEST_DELAY_SECONDS = 1.0
MAX_REQUESTS = 150

DATA_DIR = Path(__file__).parent / "data"
OUTPUT_FILE = DATA_DIR / "mercadona_sample.json"

SSL_CONTEXT = ssl.create_default_context(cafile=certifi.where())

# Categorias elegidas para la muestra (mismas 8 que en Dia), IDs
# confirmados navegando /api/categories/ a mano.
CATEGORIES = {
    "pollo": 38,
    "cerdo": 37,
    "arroz": 118,
    "pasta": 120,
    "patata": 854,
    "legumbres": 121,
    "fruta": 27,
    "lacteos": 72,
}

DETAIL_SAMPLE_PER_CATEGORY = 4

request_count = 0


def fetch_json(path: str) -> dict:
    global request_count
    if request_count >= MAX_REQUESTS:
        raise RuntimeError(f"Limite de {MAX_REQUESTS} peticiones alcanzado")

    url = f"{API_BASE}{path}"
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=30, context=SSL_CONTEXT) as response:
        request_count += 1
        return json.loads(response.read().decode("utf-8"))


def extract_products_from_category(category_json: dict) -> list[dict]:
    """La API anida sub-subcategorias con sus productos dentro de la
    respuesta de una categoria de nivel medio, todo en una sola
    peticion (sin paginacion aparente para el tamano de estas
    categorias)."""
    products = []
    for subcat in category_json.get("categories", []):
        products.extend(subcat.get("products", []))
    return products


def main() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    result: dict = {"categories": {}}

    for category_name, category_id in CATEGORIES.items():
        print(f"Categoria: {category_name} (id={category_id})")
        time.sleep(REQUEST_DELAY_SECONDS)
        try:
            category_json = fetch_json(f"/categories/{category_id}/")
        except (urllib.error.URLError, RuntimeError) as error:
            print(f"  ERROR: {error}")
            continue

        items = extract_products_from_category(category_json)
        print(f"  {len(items)} productos en el listado")

        details = {}
        for item in items[:DETAIL_SAMPLE_PER_CATEGORY]:
            time.sleep(REQUEST_DELAY_SECONDS)
            product_id = item["id"]
            try:
                details[product_id] = fetch_json(f"/products/{product_id}/")
                print(f"  detalle: {product_id} {item['display_name']}")
            except (urllib.error.URLError, RuntimeError) as error:
                print(f"  ERROR detalle {product_id}: {error}")

        result["categories"][category_name] = {
            "category_id": category_id,
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
    print(f"Peticiones usadas: {request_count}/{MAX_REQUESTS}")


if __name__ == "__main__":
    main()
