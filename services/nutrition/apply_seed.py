"""Aplica los seeds de ejemplo de supabase/seed/*.sql, en orden alfabetico.

Hace falta porque `supabase db push` solo aplica migraciones (esquema) y
este proyecto nunca usa `supabase db reset`, que es lo que ejecutaria
seed.sql de forma automatica (regla dura 10, CLAUDE.md).

Orden de uso en una base nueva:
  1. supabase db push                 (esquema)
  2. registrarte en la app (/login)   (el seed necesita un usuario)
  3. uv run services/nutrition/insert_bedca.py   (catalogo de alimentos)
  4. uv run services/nutrition/apply_seed.py     (este script)

Idempotente: cada seed se puede reejecutar sin duplicar filas.
Todos los seeds van en UNA transaccion: si falla uno, no entra ninguno.

Conexion: variable de entorno SUPABASE_DB_URL (la misma que insert_bedca.py).

Ejecutar: uv run services/nutrition/apply_seed.py
"""

import os
import sys
from pathlib import Path

import psycopg

SEED_DIR = Path(__file__).resolve().parents[2] / "supabase" / "seed"
DB_URL_ENV_VAR = "SUPABASE_DB_URL"


def main() -> None:
    db_url = os.environ.get(DB_URL_ENV_VAR)
    if not db_url:
        print(f"Falta la variable de entorno {DB_URL_ENV_VAR}", file=sys.stderr)
        sys.exit(1)

    seeds = sorted(SEED_DIR.glob("*.sql"))
    if not seeds:
        print(f"No hay seeds en {SEED_DIR}", file=sys.stderr)
        sys.exit(1)

    try:
        # Usado como context manager: commit al salir sin excepcion,
        # rollback si algo lanza -- todo o nada.
        with psycopg.connect(db_url) as conn:
            for seed in seeds:
                print(f"Aplicando {seed.name}")
                conn.execute(seed.read_text(encoding="utf-8"))
    except psycopg.errors.RaiseException as exc:
        # Los seeds lanzan mensajes pensados para una persona
        # ("registrate en la app", "importa BEDCA"): se muestran tal cual.
        print(f"\nNo se aplico nada: {exc.diag.message_primary}", file=sys.stderr)
        sys.exit(1)

    print("Seeds aplicados.")


if __name__ == "__main__":
    main()
