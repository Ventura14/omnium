import { existsSync } from "node:fs";
import path from "node:path";
import { createClient } from "@/lib/supabase/server";
import { todayInMadrid, addDays, mondayOf } from "@/lib/dates";
import { WeekNav } from "@/components/WeekNav";
import { ShoppingBoard, type ShoppingItem, type PendingItem, type CookRow } from "./ShoppingBoard";

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
  prep_mode: string | null;
};

type ShoppingRow = {
  food_id: string | null;
  food_name: string | null;
  display_name: string | null;
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
  food_id: string | null;
  product_id: string | null;
  food_name: string | null;
  product_name: string | null;
  sin_criterio_comparacion: boolean | null;
  motivos: string[] | null;
};

export default async function CompraPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { week } = await searchParams;
  const supabase = await createClient();

  const todayDate = new Date(`${todayInMadrid()}T00:00:00Z`);

  // defaultWeekStart se calcula siempre, se use o no el ?week=
  // explicito -- WeekNav lo necesita para saber si mostrar el enlace
  // "esta semana".
  const currentWeekStart = mondayOf(todayDate);
  const { data: currentPlan } = await supabase
    .from("meal_plans")
    .select("id")
    .eq("week_start", currentWeekStart)
    .maybeSingle();
  const defaultWeekStart = currentPlan
    ? currentWeekStart
    : addDays(currentWeekStart, 7);

  let weekStart: string;
  if (week) {
    const referenceDate = new Date(`${week}T00:00:00Z`);
    weekStart = mondayOf(
      Number.isNaN(referenceDate.getTime()) ? todayDate : referenceDate
    );
  } else {
    weekStart = defaultWeekStart;
  }

  const prevWeek = addDays(weekStart, -7);
  const nextWeek = addDays(weekStart, 7);

  const { data: plan } = await supabase
    .from("meal_plans")
    .select("id, week_start")
    .eq("week_start", weekStart)
    .maybeSingle();

  const nav = (
    <WeekNav
      basePath="/compra"
      title="Compra"
      weekStart={weekStart}
      defaultWeekStart={defaultWeekStart}
      prevWeek={prevWeek}
      nextWeek={nextWeek}
    />
  );

  if (!plan) {
    return (
      <main className="mx-auto max-w-5xl space-y-4 p-6">
        {nav}
        <p className="text-sm text-muted-foreground">
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
    { data: proposals },
    { data: checks },
    { data: zoneRows },
  ] = await Promise.all([
    supabase
      .rpc("plan_cook_batches", { p_plan_id: plan.id })
      .returns<BatchRow[]>(),
    supabase
      .from("shopping_list")
      .select("*")
      .eq("plan_id", plan.id)
      .returns<ShoppingRow[]>(),
    supabase
      .from("plan_cost_summary")
      .select("box_total, prorated_total")
      .eq("plan_id", plan.id)
      .maybeSingle(),
    supabase.from("channels").select("id, store, channel"),
    supabase
      .from("cheapest_dia_proposal")
      .select("food_id, product_id, food_name, product_name, sin_criterio_comparacion, motivos")
      .returns<ProposalRow[]>(),
    supabase
      .from("shopping_check")
      .select("food_id, packs_checked")
      .eq("plan_id", plan.id),
    supabase.from("foods").select("id, store_zone"),
  ]);

  // store_zones y su orden de recorrido vienen de una tabla, no de un
  // enum fijo en TypeScript: el orden se corrige con un UPDATE en
  // Postgres cuando se calibre contra la tienda real (ver
  // NOTES_shopping_list.md), no con un redeploy.
  const { data: zoneCatalog } = await supabase
    .from("store_zones")
    .select("zone, zone_order, label");

  const zoneByFoodId = new Map(
    (zoneRows ?? []).map((f) => [f.id, f.store_zone])
  );
  const zoneInfo = new Map(
    (zoneCatalog ?? []).map((z) => [z.zone, { order: z.zone_order, label: z.label }])
  );
  const checkedByFoodId = new Map(
    (checks ?? []).map((c) => [c.food_id, c.packs_checked])
  );

  const pendingReasons = new Map<string, string>();
  const productIdByFoodId = new Map<string, string>();
  for (const row of proposals ?? []) {
    if (!row.food_id) continue;
    if (row.sin_criterio_comparacion) {
      if (!row.food_name || pendingReasons.has(row.food_name)) continue;
      pendingReasons.set(row.food_name, row.motivos?.[0] ?? "sin motivo registrado");
    } else if (row.product_id) {
      productIdByFoodId.set(row.food_id, row.product_id);
    }
  }

  const items: ShoppingItem[] = [];
  const pending: PendingItem[] = [];

  // Miniatura solo si el archivo existe de verdad -- si un producto
  // no tiene foto descargada, la fila NO reserva el hueco (el
  // usuario senalo que un cuadro gris vacio ocupa sitio sin aportar).
  function imagePathFor(foodId: string): string | null {
    const productId = productIdByFoodId.get(foodId);
    if (!productId) return null;
    const filename = `${productId}.jpg`;
    const onDisk = existsSync(path.join(process.cwd(), "public", "products", filename));
    return onDisk ? `/products/${filename}` : null;
  }

  for (const r of shoppingRows ?? []) {
    if (!r.food_id || !r.food_name) continue;
    if (r.needs_manual_check) {
      pending.push({
        foodId: r.food_id,
        foodName: r.display_name ?? r.food_name,
        reason: pendingReasons.get(r.food_name) ?? "sin producto único confirmado",
      });
      continue;
    }
    const zone = zoneByFoodId.get(r.food_id);
    const info = zone ? zoneInfo.get(zone) : undefined;
    items.push({
      foodId: r.food_id,
      foodName: r.display_name ?? r.food_name,
      productName: r.product_name,
      gramsNeeded: r.grams_needed ?? 0,
      packsToBuy: r.packs_to_buy,
      estimatedCost: r.estimated_cost,
      packSizeIsApprox: r.pack_size_is_approx ?? false,
      chosenByUser: r.chosen_by_user ?? false,
      zoneLabel: info?.label ?? "Sin clasificar",
      zoneOrder: info?.order ?? 99,
      checkedPacks: checkedByFoodId.get(r.food_id) ?? null,
      imagePath: imagePathFor(r.food_id),
    });
  }

  // Solo las recetas de comida/cena se cocinan en tanda el domingo --
  // las de ingesta fija (media manana/merienda, prep_mode
  // 'al_momento') se montan cada dia, no tiene sentido listarlas
  // aqui como si hubiera que prepararlas por adelantado.
  const batchRows = (batches ?? []).filter((b) => b.prep_mode === "batch");
  const cookRows: CookRow[] = batchRows
    .slice()
    .sort((a, b) => b.tandas - a.tandas)
    .map((b) => ({
      recipeId: b.recipe_id,
      recipeName: b.recipe_name,
      tandas: b.tandas,
      servingsProduced: b.servings_produced,
    }));
  const totalLeftoverServings = batchRows.reduce(
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

  const { data: presencialGross } =
    presencialCost !== null
      ? await supabase.rpc("gross_salary_equivalent", {
          net_amount: presencialCost,
        })
      : { data: null };

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-6">
      {nav}
      <p className="text-sm text-muted-foreground">
        {items.length + pending.length} productos · cocinas el domingo{" "}
        {addDays(weekStart, -1)}
      </p>

      <ShoppingBoard
        planId={plan.id}
        items={items}
        pending={pending}
        cookRows={cookRows}
        totalLeftoverServings={totalLeftoverServings}
        totals={{
          boxTotal,
          proratedTotal: costSummary?.prorated_total ?? null,
          glovoCost: glovoCost,
          grossEquivalent: presencialGross,
        }}
      />

      <p className="border-t pt-4 text-xs text-muted-foreground">
        Glovo se paga con saldo Cobee, dinero bruto sin tributar. El
        equivalente bruto es lo que costaría en sueldo bruto conseguir el
        importe neto de la tienda, asumiendo un tipo marginal de IRPF del
        30 % (estimación, no un dato fiscal verificado).
      </p>
    </main>
  );
}
