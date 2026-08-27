-- 20260905000000_gross_salary_equivalent.sql
-- Comparar Dia presencial (dinero ya tributado) contra Glovo (saldo
-- Cobee, que nunca tributo) en euros corrientes no es una comparacion
-- justa: para tener X EUR NETOS en la nomina hay que ganar
-- X/(1-tipo_marginal) EUR BRUTOS. El saldo Cobee ya es bruto -- no hace falta
-- convertirlo.
--
-- 0.30 es una ESTIMACION ilustrativa del tipo marginal de IRPF, no un
-- dato fiscal verificado -- documentada aqui como constante, no
-- repartida por la UI, para que quede un unico sitio que corregir si
-- cambia.
create or replace function gross_salary_equivalent(net_amount numeric)
returns numeric
language sql
immutable
as $$
  select round(net_amount / (1 - 0.30), 2)
$$;
