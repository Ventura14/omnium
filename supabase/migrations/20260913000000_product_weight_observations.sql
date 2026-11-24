-- 20260913000000_product_weight_observations.sql
--
-- Evidencia real de que el peso "aprox." de un envase no es el peso
-- que llega a casa (ver services/scrapers/NOTES_dia.md). Hasta ahora
-- eso vivía solo en una nota en markdown; esta tabla es donde se
-- acumulan las observaciones reales para que shopping_list pueda
-- avisar con un dato medido, nunca con un porcentaje inventado
-- (regla 15).
--
-- Catalogo compartido (20260911000000): es un hecho del PRODUCTO
-- (cuanto pesa de verdad tal envase), no de quien lo peso -- misma
-- logica que products/foods, RLS abierta a cualquier usuario
-- autenticado, created_by es trazabilidad, no control de acceso.
--
-- source: 'ticket' es la inferencia ya documentada (precio total /
-- precio por kg del ticket revela el peso real facturado). Se anade
-- 'balanza_tienda' para el caso de hoy: pesado a mano en la balanza
-- de la tienda, sin pasar por ningun calculo -- un dato mas directo
-- todavia que 'ticket', no uno mas debil.
--
-- priced_by_weight: distincion añadida el 2026-09-14 tras un error
-- de categoria en las primeras 5 observaciones. Un articulo A PESO
-- (el ticket lo factura a €/kg de lo que de verdad pesa) que resulta
-- "aprox. 900 g" y pesa 869 g no ha perdido nada -- se ha cobrado
-- exactamente lo pesado. La alerta de "el aprox. te quita peso sin
-- avisar" solo tiene sentido para un envase de PRECIO FIJO (pagas
-- 4,49 € pese lo que pese la bandeja): ahi si hay diferencia entre
-- lo declarado y lo real que el cliente no puede ver ni recuperar.
-- Sin esta columna, la tabla mezclaria las dos categorias y
-- cualquier alerta futura construida sobre ella pesaria mal la
-- evidencia (ver services/scrapers/NOTES_dia.md). NOT NULL sin
-- default a proposito -- regla 15, cada fila obliga a decidir cual
-- de las dos categorias es, nunca se asume.
-- IF NOT EXISTS / DROP POLICY IF EXISTS añadido el 2026-09-14
-- (incidente de push accidental, ver CLAUDE.md rule 10): esta
-- migracion quedo aplicada en produccion sin pasar por
-- supabase_migrations.schema_migrations. Con esto, un `supabase db
-- push` normal la trata como no-op en vez de fallar con "la tabla ya
-- existe" y reconcilia el registro solo. Postgres no admite `CREATE
-- POLICY ... IF NOT EXISTS` (verificado contra esta base, Postgres
-- 17.6, error de sintaxis) -- el patron idempotente para una policy
-- es DROP POLICY IF EXISTS + CREATE POLICY, no una sola clausula.
create table if not exists product_weight_observations (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  observed_g numeric(10,2) not null check (observed_g > 0),
  observed_on date not null,
  source text not null check (source in ('ticket', 'balanza_tienda')),
  priced_by_weight boolean not null,
  notes text,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table product_weight_observations enable row level security;

drop policy if exists "shared_catalog" on product_weight_observations;
create policy "shared_catalog" on product_weight_observations
  for all to authenticated using (true) with check (true);
