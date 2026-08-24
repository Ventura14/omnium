"""Carga products/product_prices desde services/scrapers/data/dia_cesta.json.

Un product por candidato (hasta 5 por termino), enlazado al food
is_staple correspondiente cuando el termino de busqueda viene de la
cesta. pack_size_g se deja SIEMPRE en NULL -- regla 8, el peso del
titulo y el contenido neto real no son lo mismo, no se infiere.
price_per_kg solo se rellena cuando Dia ya lo da en KILO
(price_per_unit + measure_unit='KILO'); para leche (LITRO) o huevos
(por unidad) se deja NULL en vez de inventar una conversion.

kcal_100g_scraped, kj_100g_scraped y protein_100g_scraped se guardan
CADA UNA tal como las publica Dia, sin que una corrija a la otra -- a
veces kcal y kJ se contradicen dentro de la misma ficha (ver
comentario de la tabla products), y la vista cheapest_dia_proposal lo
marca en vez de resolverlo aqui. protein_100g_scraped es la proteina
REAL de ESE producto -- necesaria para comparar productos del mismo
food entre si (la proteina del food de BEDCA sirve para comparar
foods distintos, no productos del mismo food -- ver el comentario de
20260827000000_protein_100g_scraped.sql).

source='scraped' en cada product_price: es una observacion real de
esta sonda, con la fecha real de la sonda (mtime del JSON), no la
fecha en que se ejecuta este script.

NO idempotente a proposito (regla 6, un usuario, ejecucion puntual):
ejecutarlo dos veces duplica productos. Es una carga de una vez, no
un scraper periodico -- si algun dia lo es, se le añade su propio
on-conflict entonces, no antes de que haga falta.

Conexion: SUPABASE_DB_URL, igual que insert_bedca.py.

Ejecutar: uv run services/scrapers/load_dia_products.py
"""

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

import psycopg

DATA_FILE = Path(__file__).parent / "data" / "dia_cesta.json"
DB_URL_ENV_VAR = "SUPABASE_DB_URL"

STORE = "dia"
CHANNEL = "presencial"

# Termino de busqueda (dia.py) -> nombre exacto del food is_staple.
# Construido a mano contra la cesta real de 24 terminos -- no hay
# heuristica de matching aqui, es 1:1 conocido de antemano.
TERM_TO_FOOD = {
    "patata": "Patata, cruda",
    "leche desnatada": "Leche, desnatada, pasteurizada",
    "plátano": "Plátano",
    "queso fresco batido": "Queso fresco batido 0% M.G.",
    "lomo de cerdo": "Carne de cerdo de capa blanca, lomo, parte magra, crudo",
    "cebolla": "Cebolla",
    "pan de barra": "Pan blanco, de barra",
    "pechuga de pollo": "Pollo, pechuga, con piel, crudo",
    "pimiento rojo": "Pimiento rojo, crudo",
    "arroz": "Arroz",
    "manzana": "Manzana",
    "champiñón": "Champiñon",
    "merluza congelada": "Merluza, congelada, cruda",
    "pavo fiambre": "Pavo, fiambre, bajo en grasa",
    "avena": "Avena, cruda",
    "brócoli": "Brécol, crudo",
    "clara de huevo": "Huevo de gallina, clara, cruda",
    "solomillo de ternera": "Ternera, solomillo, sin grasa, crudo",
    "nueces": "Nuez, cruda, con cáscara",
    "aceite de oliva virgen extra": "Aceite de oliva virgen extra",
    "jamón cocido": "Jamón cocido, categoría s/e",
    "crema de cacahuete": "Crema de cacahuete",
    "queso rallado": "Queso rallado, genérico",
    "huevos": "Huevo de gallina fresco",
}


def main() -> None:
    db_url = os.environ.get(DB_URL_ENV_VAR)
    if not db_url:
        print(f"Falta la variable de entorno {DB_URL_ENV_VAR}", file=sys.stderr)
        sys.exit(1)

    data = json.loads(DATA_FILE.read_text(encoding="utf-8"))
    observed_at = datetime.fromtimestamp(DATA_FILE.stat().st_mtime, tz=timezone.utc)

    with psycopg.connect(db_url) as conn:
        with conn.cursor() as cur:
            cur.execute("select id from auth.users limit 1")
            row = cur.fetchone()
            if row is None:
                print("No hay ningun usuario en auth.users", file=sys.stderr)
                sys.exit(1)
            user_id = row[0]

            cur.execute(
                """
                insert into channels (user_id, store, channel, markup_pct)
                values (%s, %s, %s, null)
                on conflict (user_id, store, channel) do nothing
                returning id
                """,
                (user_id, STORE, CHANNEL),
            )
            row = cur.fetchone()
            if row is None:
                cur.execute(
                    "select id from channels where user_id = %s and store = %s and channel = %s",
                    (user_id, STORE, CHANNEL),
                )
                row = cur.fetchone()
            channel_id = row[0]

            products_inserted = 0
            prices_inserted = 0
            unmatched_terms = []

            for term, term_data in data["terms"].items():
                food_name = TERM_TO_FOOD.get(term)
                food_id = None
                if food_name:
                    cur.execute("select id from foods where name = %s", (food_name,))
                    food_row = cur.fetchone()
                    food_id = food_row[0] if food_row else None
                    if food_id is None:
                        unmatched_terms.append((term, food_name))
                else:
                    unmatched_terms.append((term, None))

                for candidate in term_data.get("candidates", []):
                    if candidate.get("price") is None:
                        continue

                    price_per_kg = None
                    if candidate.get("measure_unit") == "KILO":
                        price_per_kg = candidate.get("price_per_unit")

                    macros = candidate.get("macros_100g")
                    kcal_100g_scraped = macros.get("energy_value") if macros else None
                    kj_100g_scraped = macros.get("energy_value_kj") if macros else None
                    protein_100g_scraped = None
                    if macros:
                        for value in macros.get("values", []):
                            if value.get("title") == "Proteínas":
                                protein_100g_scraped = value.get("value_per_100_g")
                                break

                    cur.execute(
                        """
                        insert into products (user_id, food_id, store, name, url, pack_size_raw, pack_size_g, price_per_kg, kcal_100g_scraped, kj_100g_scraped, protein_100g_scraped)
                        values (%s, %s, %s, %s, %s, %s, null, %s, %s, %s, %s)
                        returning id
                        """,
                        (
                            user_id,
                            food_id,
                            STORE,
                            candidate["name"],
                            candidate.get("url"),
                            candidate["format_raw"],
                            price_per_kg,
                            kcal_100g_scraped,
                            kj_100g_scraped,
                            protein_100g_scraped,
                        ),
                    )
                    product_id = cur.fetchone()[0]
                    products_inserted += 1

                    cur.execute(
                        """
                        insert into product_prices (product_id, channel_id, price, observed_at, source)
                        values (%s, %s, %s, %s, 'scraped')
                        """,
                        (product_id, channel_id, candidate["price"], observed_at),
                    )
                    prices_inserted += 1

        conn.commit()

    print(f"Canal: {STORE}/{CHANNEL} (id={channel_id})")
    print(f"Productos insertados: {products_inserted}")
    print(f"Precios insertados: {prices_inserted}")
    if unmatched_terms:
        print("Terminos sin food enlazado (revisar TERM_TO_FOOD o el catalogo):")
        for term, food_name in unmatched_terms:
            if food_name:
                print(f"  {term!r} -> buscaba {food_name!r}, no encontrado en foods")
            else:
                print(f"  {term!r} -> sin mapeo definido en TERM_TO_FOOD")


if __name__ == "__main__":
    main()
