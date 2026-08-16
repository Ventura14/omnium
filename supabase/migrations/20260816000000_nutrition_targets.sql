-- 20260816000000_nutrition_targets.sql
-- Historico de objetivos nutricionales. Los objetivos cambian cada
-- trimestre; nunca se sobreescribe el anterior, se anade uno nuevo
-- con su propio effective_from. El vigente es el de effective_from
-- mas reciente.

create table nutrition_targets (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  effective_from  date not null,
  kcal            integer not null check (kcal > 0),
  protein_g       integer not null check (protein_g > 0),
  fat_g           integer not null check (fat_g > 0),
  carbs_g         integer not null check (carbs_g > 0),
  notes           text,
  created_at      timestamptz not null default now(),
  unique (user_id, effective_from)
);

alter table nutrition_targets enable row level security;

create policy owner_all on nutrition_targets for all using (user_id = auth.uid());
