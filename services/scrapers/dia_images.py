"""Descarga las fotos de producto de los ganadores actuales de
shopping_list -- no del catalogo de 108 productos, solo los ~25 que
de verdad se pintan en /compra (menos peticiones, menos que
almacenar).

Dos fases, cada peticion HTTP respeta la regla dura 9 (1 req/seg,
sin paralelizar, backoff ante 403/429, parar del todo si el bloqueo
persiste -- nunca reintentar en bucle):

  1. Por cada producto ganador, pide su ficha (ya tenemos la URL
     guardada en products.url del scrape original) y extrae
     product["images"][0] -- la primera imagen es la vista "ISO"
     (estudio), confirmado con una sonda de un producto antes de
     escribir este script.
  2. Descarga esa imagen a services/scrapers/data/images/<product_id>.jpg.

NO sube a Supabase Storage -- eso necesita la API de Storage
(service role key o sesion autenticada), que este script no tiene
todavia (SUPABASE_DB_URL solo da Postgres). NO escribe nada en la
base de datos: deja los archivos en disco (services/scrapers/data/
images/) y un manifiesto JSON con product_id/image_url/local_path.
La subida a Storage y el UPDATE de products.image_url son un paso
aparte, posterior, con la credencial que falta.

Ejecutar: uv run services/scrapers/dia_images.py
"""

import json
import os
import re
import ssl
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

import certifi
import psycopg

BASE_URL = "https://www.dia.es"
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
)

REQUEST_DELAY_SECONDS = 1.0
MAX_RETRIES = 3
BACKOFF_BASE_SECONDS = 2.0

DATA_DIR = Path(__file__).parent / "data" / "images"

SSL_CONTEXT = ssl.create_default_context(cafile=certifi.where())
PAGE_CONTEXT_RE = re.compile(
    r'<script id="vike_pageContext" type="application/json">(.*?)</script>',
    re.DOTALL,
)

DB_URL_ENV_VAR = "SUPABASE_DB_URL"


class BlockedError(Exception):
    pass


def fetch(url: str) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    last_error = None
    for attempt in range(MAX_RETRIES):
        try:
            with urllib.request.urlopen(request, timeout=30, context=SSL_CONTEXT) as response:
                return response.read()
        except urllib.error.HTTPError as error:
            last_error = error
            if error.code not in (403, 429):
                raise
            wait = BACKOFF_BASE_SECONDS * (2**attempt)
            print(f"    HTTP {error.code}, intento {attempt + 1}/{MAX_RETRIES}, esperando {wait:.0f}s...", file=sys.stderr)
            time.sleep(wait)
    raise BlockedError(f"Bloqueado tras {MAX_RETRIES} intentos: {last_error}")


def get_image_path(product_url: str) -> str | None:
    html = fetch(product_url).decode("utf-8")
    match = PAGE_CONTEXT_RE.search(html)
    if not match:
        return None
    context = json.loads(match.group(1))
    product = context.get("INITIAL_STATE", {}).get("product", {})
    images = product.get("images") or []
    return images[0] if images else None


def main() -> None:
    db_url = os.environ.get(DB_URL_ENV_VAR)
    if not db_url:
        print(f"Falta la variable de entorno {DB_URL_ENV_VAR}", file=sys.stderr)
        sys.exit(1)

    DATA_DIR.mkdir(parents=True, exist_ok=True)

    with psycopg.connect(db_url) as conn:
        with conn.cursor() as cur:
            cur.execute("select id from meal_plans where week_start = '2026-09-07'")
            plan_id = cur.fetchone()[0]
            cur.execute(
                """
                select distinct p.id, p.name, p.url
                from shopping_list sl
                join cheapest_dia_proposal cdp
                  on cdp.food_id = sl.food_id and cdp.product_name = sl.product_name
                join products p on p.id = cdp.product_id
                where sl.plan_id = %s and not sl.needs_manual_check
                order by p.name
                """,
                (plan_id,),
            )
            winners = cur.fetchall()

        print(f"{len(winners)} productos ganadores a procesar\n")

        with_image = 0
        without_image = 0
        results = []

        for product_id, name, url in winners:
            print(f"{name}")
            time.sleep(REQUEST_DELAY_SECONDS)
            try:
                image_path = get_image_path(url)
            except BlockedError as error:
                print(f"  BLOQUEADO: {error}", file=sys.stderr)
                print("\nSonda detenida por bloqueo -- no se completaron todos los productos.")
                break
            except (urllib.error.URLError, ValueError) as error:
                print(f"  ERROR obteniendo ficha: {error}", file=sys.stderr)
                without_image += 1
                results.append((product_id, name, None, None))
                continue

            if not image_path:
                print("  sin imagen en la ficha")
                without_image += 1
                results.append((product_id, name, None, None))
                continue

            image_url = BASE_URL + image_path
            time.sleep(REQUEST_DELAY_SECONDS)
            try:
                image_bytes = fetch(image_url)
            except BlockedError as error:
                print(f"  BLOQUEADO descargando imagen: {error}", file=sys.stderr)
                print("\nSonda detenida por bloqueo -- no se completaron todos los productos.")
                break
            except (urllib.error.URLError, ValueError) as error:
                print(f"  ERROR descargando imagen: {error}", file=sys.stderr)
                without_image += 1
                results.append((product_id, name, image_url, None))
                continue

            local_path = DATA_DIR / f"{product_id}.jpg"
            local_path.write_bytes(image_bytes)
            with_image += 1
            results.append((product_id, name, image_url, str(local_path)))
            print(f"  OK -> {local_path.name} ({len(image_bytes)} bytes)")

        manifest_path = DATA_DIR.parent / "dia_images_manifest.json"
        with open(manifest_path, "w", encoding="utf-8") as f:
            json.dump(
                [
                    {"product_id": str(pid), "name": name, "image_url": iu, "local_path": lp}
                    for pid, name, iu, lp in results
                ],
                f,
                ensure_ascii=False,
                indent=2,
            )

        print(f"\nCon imagen: {with_image}")
        print(f"Sin imagen: {without_image}")
        print(f"Manifiesto: {manifest_path}")


if __name__ == "__main__":
    main()
