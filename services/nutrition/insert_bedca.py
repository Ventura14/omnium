"""Inserta en `foods` los alimentos de BEDCA ya transformados por
import_bedca.py.

UPSERT idempotente: la clave de conflicto es (source, source_ref) --
el indice foods_source_ref_unique (20260911000000_shared_catalog.sql
la simplifico: un alimento de BEDCA es UNO, no uno por usuario, igual
que un canal). Reejecutar este script actualiza en vez de duplicar.

Una sola transaccion: si cualquier fila falla, no entra ninguna.

Conexion: variable de entorno SUPABASE_DB_URL con la connection
string directa de Postgres (rol postgres, salta RLS -- es lo que
queremos para catalogo compartido). Nunca hardcodeada. No es la
publishable key del frontend.

Ejecutar: uv run services/nutrition/insert_bedca.py
"""

import csv
import os
import sys
from pathlib import Path

import psycopg

sys.path.insert(0, str(Path(__file__).parent))
from import_bedca import RAW_XML_PATH, transform_all  # noqa: E402

DATA_DIR = Path(__file__).parent / "data"
FOOD_ORIGIN_CSV_PATH = DATA_DIR / "food_origin.csv"

DB_URL_ENV_VAR = "SUPABASE_DB_URL"

# El conflict target repite exactamente el predicado parcial del indice
# foods_source_ref_unique (WHERE source_ref IS NOT NULL); Postgres
# solo usa un indice unico parcial como arbitro de ON CONFLICT si el
# predicado coincide literalmente.
#
# search_name no se manda ni se actualiza: lo rellena siempre un
# trigger en Postgres (normalize_search_name), tanto en el INSERT
# como en el DO UPDATE de este mismo upsert.
UPSERT_SQL = """
insert into foods (
    name, source, source_ref, source_detail,
    kcal_100g, protein_100g, carbs_100g, fat_100g, fiber_100g
) values (
    %(name)s, %(source)s, %(source_ref)s, %(source_detail)s,
    %(kcal_100g)s, %(protein_100g)s, %(carbs_100g)s, %(fat_100g)s, %(fiber_100g)s
)
on conflict (source, source_ref) where source_ref is not null
do update set
    name = excluded.name,
    source_detail = excluded.source_detail,
    kcal_100g = excluded.kcal_100g,
    protein_100g = excluded.protein_100g,
    carbs_100g = excluded.carbs_100g,
    fat_100g = excluded.fat_100g,
    fiber_100g = excluded.fiber_100g
returning (xmax = 0) as inserted
"""
# cooked_yield y is_excluded quedan fuera a proposito, tanto del
# insert (usan su default) como del update (para no pisar una
# correccion manual que el usuario haya hecho despues de importar).


def load_origin_map() -> dict[str, str]:
    with open(FOOD_ORIGIN_CSV_PATH, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        return {row["f_id"]: row["f_origen"] for row in reader}


def main() -> None:
    db_url = os.environ.get(DB_URL_ENV_VAR)
    if not db_url:
        print(f"Falta la variable de entorno {DB_URL_ENV_VAR}", file=sys.stderr)
        sys.exit(1)

    origin_map = load_origin_map()
    rows, skipped, _energy_branch_counts = transform_all(RAW_XML_PATH)

    for row in rows:
        row["source_detail"] = origin_map.get(row["source_ref"])

    inserted_count = 0
    updated_count = 0

    # psycopg conecta con autocommit=False por defecto; usado como
    # context manager, hace commit al salir sin excepcion y rollback
    # si algo lanza -- esa es la transaccion unica de todo o nada.
    with psycopg.connect(db_url) as conn:
        with conn.cursor() as cur:
            for row in rows:
                cur.execute(UPSERT_SQL, row)
                (was_inserted,) = cur.fetchone()
                if was_inserted:
                    inserted_count += 1
                else:
                    updated_count += 1

    print(f"Insertadas: {inserted_count}")
    print(f"Actualizadas: {updated_count}")
    print(f"Saltadas (incompletas, no llegaron a intentarse): {len(skipped)}")


if __name__ == "__main__":
    main()
