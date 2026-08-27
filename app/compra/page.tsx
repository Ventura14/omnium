import { createClient } from "@/lib/supabase/server";
import { todayInMadrid, addDays, mondayOf } from "@/lib/dates";

// Toda la aritmetica (tandas, packs, costes, comisiones de canal)
// viene ya calculada de plan_cook_batches / shopping_list /
// plan_prorated_cost / plan_cost_summary / channel_order_cost --
// regla dura 1, esta pagina solo pinta.

type BatchRow = {
  recipe_id: string;
  recipe_name: string;
  servings_per_batch: number;
  servings_consumed: number;
  tandas: number;
  servings_produced: number;
  servings_leftover: number;
};

type ShoppingRow = {
  food_id: string | null;
  food_name: string | null;
  grams_needed: number | null;
  product_name: string | null;
  store: string | null;
  precio_envase: number | null;
  pack_size_g: number | null;
  pack_size_is_approx: boolean | null;
  chosen_by_user: boolean | null;
  packs_to_buy: number | null;
  estimated_cost: number | null;
  grams_leftover: number | null;
  leftover_pct: number | null;
  needs_manual_check: boolean | null;
};

type ProposalRow = {
  food_name: string | null;
  product_name: string | null;
  motivos: string[] | null;
};

export default async function CompraPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { week } = await searchParams;
  const supabase = await createClient();

  // Mismo criterio adaptativo que /semana: sin ?week=, si la semana
  // en curso ya tiene plan se abre ahi, si no, en la siguiente.
  const todayDate = new Date(`${todayInMadrid()}T00:00:00Z`);

  let weekStart: string;
  if (week) {
    const referenceDate = new Date(`${week}T00:00:00Z`);
    weekStart = mondayOf(
      Number.isNaN(referenceDate.getTime()) ? todayDate : referenceDate
    );
  } else {
    const currentWeekStart = mondayOf(todayDate);
    const { data: currentPlan } = await supabase
      .from("meal_plans")
      .select("id")
      .eq("week_start", currentWeekStart)
      .maybeSingle();
    weekStart = currentPlan ? currentWeekStart : addDays(currentWeekStart, 7);
  }

  const prevWeek = addDays(weekStart, -7);
  const nextWeek = addDays(weekStart, 7);

  const { data: plan } = await supabase
    .from("meal_plans")
    .select("id, week_start")
    .eq("week_start", weekStart)
    .maybeSingle();

  const WeekNav = (
    <div className="flex items-center justify-between">
      <h1 className="text-xl font-semibold">Compra</h1>
      <div className="flex gap-4 text-sm">
        <a href={`/compra?week=${prevWeek}`} className="underline">
          ← semana anterior
        </a>
        <span className="text-gray-500">{weekStart}</span>
        <a href={`/compra?week=${nextWeek}`} className="underline">
          semana siguiente →
        </a>
      </div>
    </div>
  );

  if (!plan) {
    return (
      <main className="mx-auto max-w-4xl space-y-4 p-6">
        {WeekNav}
        <p className="text-sm text-gray-500">
          Todavía no hay plan para la semana del {weekStart}.{" "}
          <a href={`/semana?week=${weekStart}`} className="underline">
            Ir a /semana para crearlo
          </a>
          .
        </p>
      </main>
    );
  }

  const [
    { data: batches },
    { data: shoppingRows },
    { data: costSummary },
    { data: channels },
    { data: unresolved },
  ] = await Promise.all([
    supabase
      .rpc("plan_cook_batches", { p_plan_id: plan.id })
      .returns<BatchRow[]>(),
    supabase
      .from("shopping_list")
      .select("*")
      .eq("plan_id", plan.id)
      .order("estimated_cost", { ascending: false, nullsFirst: false })
      .returns<ShoppingRow[]>(),
    supabase
      .from("plan_cost_summary")
      .select("box_total, prorated_total")
      .eq("plan_id", plan.id)
      .maybeSingle(),
    supabase.from("channels").select("id, store, channel"),
    supabase
      .from("cheapest_dia_proposal")
      .select("food_name, product_name, motivos")
      .eq("sin_criterio_comparacion", true)
      .returns<ProposalRow[]>(),
  ]);

  const resolvedRows = (shoppingRows ?? []).filter(
    (r) => !r.needs_manual_check
  );
  const pendingRows = (shoppingRows ?? []).filter((r) => r.needs_manual_check);

  const pendingReasons = new Map<string, { count: number; motivo: string }>();
  for (const row of unresolved ?? []) {
    if (!row.food_name) continue;
    const existing = pendingReasons.get(row.food_name);
    if (existing) {
      existing.count += 1;
    } else {
      pendingReasons.set(row.food_name, {
        count: 1,
        motivo: row.motivos?.[0] ?? "sin motivo registrado",
      });
    }
  }

  const totalLeftover = (batches ?? []).reduce(
    (sum, b) => sum + b.servings_leftover,
    0
  );

  const presencial = channels?.find(
    (c) => c.store === "dia" && c.channel === "presencial"
  );
  const glovo = channels?.find(
    (c) => c.store === "dia" && c.channel === "glovo"
  );

  const boxTotal = costSummary?.box_total ?? null;

  const [{ data: presencialCost }, { data: glovoCost }] = await Promise.all([
    presencial && boxTotal !== null
      ? supabase.rpc("channel_order_cost", {
          p_channel_id: presencial.id,
          p_subtotal: boxTotal,
        })
      : Promise.resolve({ data: null }),
    glovo && boxTotal !== null
      ? supabase.rpc("channel_order_cost", {
          p_channel_id: glovo.id,
          p_subtotal: boxTotal,
        })
      : Promise.resolve({ data: null }),
  ]);

  // El equivalente bruto solo tiene sentido sobre lo que se paga con
  // nomina neta (la tienda) -- el saldo Cobee de Glovo ya es bruto,
  // no se convierte.
  const { data: presencialGross } =
    presencialCost !== null
      ? await supabase.rpc("gross_salary_equivalent", {
          net_amount: presencialCost,
        })
      : { data: null };

  return (
    <main className="mx-auto max-w-4xl space-y-10 p-6">
      {WeekNav}

      {/* Bloque 1: que cocinar */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Qué cocinar</h2>
        {batches && batches.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2">Receta</th>
                <th className="py-2">Tandas</th>
                <th className="py-2">Produce</th>
                <th className="py-2">Consume</th>
                <th className="py-2">Sobran</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => (
                <tr key={b.recipe_id} className="border-b">
                  <td className="py-2">{b.recipe_name}</td>
                  <td className="py-2">{b.tandas}</td>
                  <td className="py-2">{b.servings_produced} rac.</td>
                  <td className="py-2">{b.servings_consumed} rac.</td>
                  <td className="py-2">
                    {b.servings_leftover > 0
                      ? `${b.servings_leftover} rac.`
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-gray-500">Sin recetas planificadas.</p>
        )}
        <p className="text-sm text-gray-500">
          Total raciones sobrantes: {totalLeftover}
        </p>
      </section>

      {/* Bloque 2: la lista */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">La lista</h2>
        {resolvedRows.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2">Alimento</th>
                <th className="py-2">A cocinar</th>
                <th className="py-2">Producto</th>
                <th className="py-2">Packs</th>
                <th className="py-2">Coste</th>
                <th className="py-2">Sobrante</th>
              </tr>
            </thead>
            <tbody>
              {resolvedRows.map((r) => (
                <tr key={r.food_id} className="border-b">
                  <td className="py-2">{r.food_name}</td>
                  <td className="py-2">{r.grams_needed} g</td>
                  <td className="py-2">
                    {r.product_name}
                    {r.chosen_by_user ? (
                      <span
                        className="ml-2 rounded bg-black px-1.5 py-0.5 text-xs text-white"
                        title="Producto confirmado a mano por el usuario"
                      >
                        elegido
                      </span>
                    ) : null}
                    {r.pack_size_is_approx ? (
                      <span
                        className="ml-2 rounded border px-1.5 py-0.5 text-xs text-amber-600"
                        title="Peso de envase aproximado, puede variar entre unidades"
                      >
                        aprox.
                      </span>
                    ) : null}
                  </td>
                  <td className="py-2">{r.packs_to_buy}</td>
                  <td className="py-2">{r.estimated_cost?.toFixed(2)} €</td>
                  <td className="py-2">
                    {r.grams_leftover} g ({r.leftover_pct}%)
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-gray-500">Nada resuelto todavía.</p>
        )}

        {pendingRows.length > 0 ? (
          <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm">
            <p className="mb-2 font-medium text-amber-800">
              Falta decidir ({pendingRows.length})
            </p>
            <ul className="space-y-1">
              {pendingRows.map((r) => {
                const reason = r.food_name
                  ? pendingReasons.get(r.food_name)
                  : undefined;
                return (
                  <li key={r.food_id} className="text-amber-700">
                    <span className="font-medium">{r.food_name}</span>
                    {" — "}
                    {reason
                      ? `${reason.count} candidatos, ${reason.motivo}`
                      : "sin producto único confirmado"}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </section>

      {/* Bloque 3: los dos totales */}
      <section className="space-y-2 border-t pt-4">
        <h2 className="text-lg font-semibold">Total</h2>
        <p className="text-2xl font-semibold">
          Coste en caja: {costSummary?.box_total?.toFixed(2) ?? "—"} €
        </p>
        <p className="text-sm text-gray-600">
          Coste prorrateado: {costSummary?.prorated_total?.toFixed(2) ?? "—"}{" "}
          €
        </p>
        <p className="text-xs text-gray-500">
          La diferencia es despensa: lo que sobra de cada envase queda para
          semanas siguientes, no es dinero perdido (aunque en frescos como
          verdura o fruta puede acabar siéndolo — ver
          NOTES_shopping_list.md).
        </p>
      </section>

      {/* Bloque 4: comparacion de canales */}
      {boxTotal !== null && (presencialCost !== null || glovoCost !== null) ? (
        <section className="space-y-2 border-t pt-4">
          <h2 className="text-lg font-semibold">Dia vs Glovo</h2>
          <table className="w-full text-sm">
            <tbody>
              {presencialCost !== null ? (
                <tr className="border-b">
                  <td className="py-2">Dia, presencial</td>
                  <td className="py-2 text-right">
                    {presencialCost.toFixed(2)} €
                  </td>
                </tr>
              ) : null}
              {glovoCost !== null ? (
                <tr className="border-b">
                  <td className="py-2">Dia, por Glovo</td>
                  <td className="py-2 text-right">
                    {glovoCost.toFixed(2)} €
                  </td>
                </tr>
              ) : null}
              {presencialGross !== null && glovoCost !== null ? (
                <tr className="border-b font-medium">
                  <td className="py-2">
                    Equivalente bruto (Dia vs Glovo)
                  </td>
                  <td className="py-2 text-right">
                    {presencialGross.toFixed(2)} € vs {glovoCost.toFixed(2)} €
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
          <p className="text-xs text-gray-500">
            Glovo se paga con saldo Cobee, dinero bruto sin tributar — 1 € de
            Cobee no cuesta 1 € de nómina neta, así que los dos primeros
            totales no son comparables euro a euro. El equivalente bruto sí
            lo es: lo que costaría en sueldo bruto conseguir los{" "}
            {costSummary?.box_total?.toFixed(2)} € netos de la tienda,
            asumiendo un tipo marginal de IRPF del 30 % (estimación, no un
            dato fiscal verificado).
          </p>
        </section>
      ) : null}
    </main>
  );
}
