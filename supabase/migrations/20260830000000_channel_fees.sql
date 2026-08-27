-- 20260830000000_channel_fees.sql
-- channels.markup_pct modela un recargo como % simple sobre el precio
-- de producto. Sondeada Glovo (canal presencial Dia vs Glovo,
-- 2026-08-27, navegacion real sobre la sesion del usuario, solo
-- lectura): el recargo de PRODUCTO es practicamente cero (~0.4%
-- ponderado por la cesta real), el coste real esta en tarifas POR
-- PEDIDO -- entrega fija + comisiones porcentuales con techo. Un %
-- unico no puede representar un techo: el recargo efectivo BAJA al
-- crecer el pedido (11.6% sobre 43 EUR, 5.8% sobre 86 EUR con la
-- misma tarifa). markup_pct se queda para canales que si sean un %
-- simple -- no se borra, deja de ser el mecanismo principal.
--
-- Cada fila de channel_fees es UN componente de tarifa. La formula es
-- SUELO Y TECHO, no suelo mas porcentaje -- texto real de Glovo:
-- "Empieza por 0,15 EUR y representa un 2,1% del pedido (0,90 EUR
-- como maximo)". Eso es greatest(floor, least(pct*subtotal, cap)), NO
-- floor + pct*subtotal -- con la formula equivocada, sobre 41.33 EUR
-- el servicio daria 1.02 recortado a 0.90; la correcta da 0.868.
-- floor_amount se nombra asi (no "base_amount") para que el nombre no
-- invite a sumarlo en vez de usarlo como suelo.
--
-- OJO: esta lectura de "suelo y techo" viene del TEXTO publicado por
-- Glovo, no de un pedido real completado -- con carrito vacio ambas
-- lecturas (suelo+pct vs suelo-y-techo) dan el mismo numero, no se
-- pudo discriminar observando. Se confirma cuando el usuario complete
-- un pedido de verdad y compare con el desglose final que le muestre
-- Glovo.
--
-- pedido_minimo es distinto de proposito: no es suelo/techo de un
-- porcentaje, es un cargo FIJO (floor_amount) que se aplica ENTERO
-- cuando subtotal < min_order_threshold, sin prorratear. Se calcula
-- aparte en channel_order_cost, no dentro del greatest/least.
create table channel_fees (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  channel_id uuid not null references channels(id),
  fee_type text not null check (fee_type in ('entrega', 'servicio', 'logistica', 'pedido_minimo')),
  floor_amount numeric(10,2) not null default 0,
  pct numeric(6,4) not null default 0,
  cap_amount numeric(10,2),
  min_order_threshold numeric(10,2),
  created_at timestamptz not null default now()
);

-- Dado un canal y un subtotal de productos, el coste total del
-- pedido en ese canal. Vive en Postgres -- regla dura 1, nada de esto
-- se calcula en TypeScript.
create or replace function channel_order_cost(p_channel_id uuid, p_subtotal numeric)
returns numeric
language sql
stable
as $$
  select p_subtotal
    + coalesce(
        (
          select sum(
            greatest(
              cf.floor_amount,
              case
                when cf.cap_amount is null then cf.pct * p_subtotal
                else least(cf.pct * p_subtotal, cf.cap_amount)
              end
            )
          )
          from channel_fees cf
          where cf.channel_id = p_channel_id
            and cf.fee_type <> 'pedido_minimo'
        ),
        0
      )
    + coalesce(
        (
          select cf2.floor_amount
          from channel_fees cf2
          where cf2.channel_id = p_channel_id
            and cf2.fee_type = 'pedido_minimo'
            and p_subtotal < cf2.min_order_threshold
          limit 1
        ),
        0
      );
$$;
