"""Carga el canal Glovo (Supermercado DIA en Glovo) y sus comisiones
reales en channels/channel_fees.

Datos medidos navegando Glovo de verdad (solo lectura, sin pedidos),
2026-08-27, tienda "Supermercado DIA", para una direccion de entrega
concreta -- del desglose oficial "Calculo de
tarifas" de Glovo:

  Entrega:        1.99 EUR fijo
  Servicio:       0.15 EUR suelo, 2.1% del pedido, 0.90 EUR techo
  Logistica:      0.34 EUR suelo, 4.9% del pedido, 2.10 EUR techo
  Pedido pequeño: 1.99 EUR fijo si el pedido es inferior a 22.00 EUR

El markup de PRODUCTO (precio Dia vs precio en Glovo) medido en la
misma sonda es practicamente cero (~0.4% ponderado por la cesta real)
-- por eso channels.markup_pct se deja en null aqui, el coste real de
Glovo esta en channel_fees, no en un recargo de producto.

NO idempotente a proposito (regla 6, un usuario, ejecucion puntual):
ejecutarlo dos veces duplica las filas de channel_fees.

Conexion: SUPABASE_DB_URL, igual que load_dia_products.py.

Ejecutar: uv run services/scrapers/load_glovo_channel.py
"""

import os
import sys

import psycopg

DB_URL_ENV_VAR = "SUPABASE_DB_URL"

STORE = "dia"
CHANNEL = "glovo"

FEES = [
    # fee_type, floor_amount, pct, cap_amount, min_order_threshold
    ("entrega", 1.99, 0, None, None),
    ("servicio", 0.15, 0.021, 0.90, None),
    ("logistica", 0.34, 0.049, 2.10, None),
    ("pedido_minimo", 1.99, 0, None, 22.00),
]


def main() -> None:
    db_url = os.environ.get(DB_URL_ENV_VAR)
    if not db_url:
        print(f"Falta la variable de entorno {DB_URL_ENV_VAR}", file=sys.stderr)
        sys.exit(1)

    with psycopg.connect(db_url) as conn:
        with conn.cursor() as cur:
            # channels es catalogo compartido (20260911000000): un
            # canal es UNO, no uno por usuario -- ON CONFLICT ya no
            # necesita saber quien ejecuta el script, la unicidad es
            # (store, channel). created_by/user_id de channel_fees
            # queda en NULL (default auth.uid(), sin sesion en una
            # conexion directa) -- correcto: "lo metio un script".
            cur.execute(
                """
                insert into channels (store, channel, markup_pct)
                values (%s, %s, null)
                on conflict (store, channel) do nothing
                returning id
                """,
                (STORE, CHANNEL),
            )
            row = cur.fetchone()
            if row is None:
                cur.execute(
                    "select id from channels where store = %s and channel = %s",
                    (STORE, CHANNEL),
                )
                row = cur.fetchone()
            channel_id = row[0]

            fees_inserted = 0
            for fee_type, floor_amount, pct, cap, threshold in FEES:
                cur.execute(
                    """
                    insert into channel_fees (channel_id, fee_type, floor_amount, pct, cap_amount, min_order_threshold)
                    values (%s, %s, %s, %s, %s, %s)
                    """,
                    (channel_id, fee_type, floor_amount, pct, cap, threshold),
                )
                fees_inserted += 1

        conn.commit()

    print(f"Canal: {STORE}/{CHANNEL} (id={channel_id})")
    print(f"Comisiones insertadas: {fees_inserted}")


if __name__ == "__main__":
    main()
