import Link from "next/link";
import { ArrowRight, ArrowUpRight, ChefHat } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { addDays, mondayOf, todayInMadrid } from "@/lib/dates";
import { MEAL_LABELS, MEAL_ORDER, type Meal } from "@/lib/meals";
import { decimal, longDay, money, num, shortDate, weekdayLetter } from "@/lib/format";
import { MacroRings } from "@/components/MacroRings";
import { WeekBars, type WeekBarDay } from "@/components/WeekBars";
import { Sparkline } from "@/components/Sparkline";
import { DayStatus, MacroRow } from "@/components/DayMacros";
import { MealCardBody, mealCardClass, type MealRecipe } from "@/components/MealCard";
import { container } from "@/components/kit";
import { cn } from "@/lib/utils";

// Pantalla "Hoy". Solo pinta: los totales del dia y de la semana
// vienen de plan_day_totals, los macros por racion de recipe_fit, las
// tandas de plan_cook_batches y los costes de plan_cost_summary /
// channel_order_cost -- toda la aritmetica esta en Postgres (regla 1).
// Lo unico que se hace aqui es contar filas y restar dos importes ya
// calculados para mostrarlos juntos.

export default async function HoyPage() {
  const supabase = await createClient();

  // "Hoy" siempre via todayInMadrid() -- nunca new Date() a secas
  // (CLAUDE.md, Convenciones).
  const today = todayInMadrid();
  const weekStart = mondayOf(new Date(`${today}T00:00:00Z`));
  const nextWeekStart = addDays(weekStart, 7);
  // El domingo de esta semana es el dia de cocina de la SIGUIENTE:
  // se cocina el domingo y se come de lunes a viernes.
  const nextCookDate = addDays(weekStart, 6);

  const [{ data: plan }, { data: nextPlan }, { data: weights }, { data: target }] =
    await Promise.all([
      supabase
        .from("meal_plans")
        .select("id, target_kcal, target_protein")
        .eq("week_start", weekStart)
        .maybeSingle(),
      supabase
        .from("meal_plans")
        .select("id")
        .eq("week_start", nextWeekStart)
        .maybeSingle(),
      supabase
        .from("body_metrics")
        .select("measured_on, weight_kg")
        .not("weight_kg", "is", null)
        .order("measured_on", { ascending: false })
        .limit(12),
      // Mismo criterio que create_meal_plan: el objetivo vigente es el
      // fechado en o antes del lunes de la semana.
      supabase
        .from("nutrition_targets")
        .select("fat_g, carbs_g")
        .lte("effective_from", weekStart)
        .order("effective_from", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  const [
    { data: todaySlots },
    { data: dayTotals },
    { data: fit },
    { data: recipeVariants },
    { data: currentCost },
    { data: batches },
    { data: nextCost },
    { data: channels },
  ] = await Promise.all([
    plan
      ? supabase
          .from("meal_plan_slot_details")
          .select(
            "id, meal, recipe_id, recipe_name, servings, eating_out, variant_mismatch, recipe_variant"
          )
          .eq("plan_id", plan.id)
          .eq("slot_date", today)
      : Promise.resolve({ data: null }),
    plan
      ? supabase
          .from("plan_day_totals")
          .select(
            "slot_date, kcal, protein, carbs, fat, target_kcal, target_protein, kcal_gap, protein_gap, meals_out, slots_vacios, slots_macro_incompletos"
          )
          .eq("plan_id", plan.id)
      : Promise.resolve({ data: null }),
    supabase
      .from("recipe_fit")
      .select(
        "recipe_id, name, kcal_per_serving, protein_per_serving, carbs_per_serving, fat_per_serving"
      ),
    supabase.from("recipes").select("id, variant"),
    plan
      ? supabase
          .from("plan_cost_summary")
          .select("prorated_total")
          .eq("plan_id", plan.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    nextPlan
      ? supabase.rpc("plan_cook_batches", { p_plan_id: nextPlan.id })
      : Promise.resolve({ data: null }),
    nextPlan
      ? supabase
          .from("plan_cost_summary")
          .select("box_total")
          .eq("plan_id", nextPlan.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("channels").select("id, store, channel"),
  ]);

  const glovo = channels?.find((c) => c.store === "dia" && c.channel === "glovo");
  const boxTotal = nextCost?.box_total ?? null;
  const { data: glovoCost } =
    glovo && boxTotal !== null
      ? await supabase.rpc("channel_order_cost", {
          p_channel_id: glovo.id,
          p_subtotal: boxTotal,
        })
      : { data: null };

  const variantById = new Map((recipeVariants ?? []).map((r) => [r.id, r.variant]));
  const recipeById = new Map<string, MealRecipe>(
    (fit ?? [])
      .filter((r) => r.recipe_id && r.name)
      .map((r) => [
        r.recipe_id!,
        {
          name: r.name!,
          kcal: r.kcal_per_serving,
          protein: r.protein_per_serving,
          carbs: r.carbs_per_serving,
          fat: r.fat_per_serving,
          variant: variantById.get(r.recipe_id!) ?? null,
        },
      ])
  );

  const totalsByDate = new Map((dayTotals ?? []).map((t) => [t.slot_date, t]));
  const todayTotals = totalsByDate.get(today);

  // Mismo criterio que el ✓ de /semana: gaps (de SQL) no negativos y
  // sin huecos ni comidas fuera que falseen el total.
  const isOnTarget = (t: NonNullable<typeof todayTotals>) =>
    (t.kcal_gap ?? -1) >= 0 &&
    (t.protein_gap ?? -1) >= 0 &&
    !(t.meals_out ?? 0) &&
    !(t.slots_vacios ?? 0);

  const slotsByMeal = new Map((todaySlots ?? []).map((s) => [s.meal as Meal, s]));
  const meals = MEAL_ORDER.filter((m) => slotsByMeal.has(m)).map(
    (m) => [m, slotsByMeal.get(m)!] as const
  );

  const weekDays: WeekBarDay[] = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    const t = totalsByDate.get(date);
    return {
      date,
      label: weekdayLetter(date),
      href: `/semana?week=${weekStart}`,
      kcal: t?.kcal ?? null,
      targetKcal: t?.target_kcal ?? null,
      protein: t?.protein ?? null,
      isToday: date === today,
      hasCaveat: (t?.meals_out ?? 0) > 0 || (t?.slots_vacios ?? 0) > 0,
    };
  });
  const daysOnTarget = (dayTotals ?? []).filter(isOnTarget).length;

  const weightSeries = (weights ?? [])
    .slice()
    .reverse()
    .map((w) => w.weight_kg as number);
  const latestWeight = weights?.[0];
  const firstWeight = weights?.[weights.length - 1];
  const weightChange =
    latestWeight && firstWeight && latestWeight !== firstWeight
      ? (latestWeight.weight_kg as number) - (firstWeight.weight_kg as number)
      : null;

  const cookRows = (batches ?? [])
    .filter((b) => b.prep_mode === "batch")
    .sort((a, b) => b.tandas - a.tandas);
  const tuppers = cookRows.reduce((sum, r) => sum + r.servings_produced, 0);

  return (
    <main className={cn(container, "space-y-4 pb-6 lg:flex lg:flex-1 lg:flex-col")}>
      {/* Fila superior: el dia + KPIs */}
      <section className="grid gap-4 lg:grid-cols-[minmax(22rem,34%)_1fr]">
        <div className="glow-lime relative flex flex-col gap-5 overflow-hidden rounded-3xl bg-card p-5 xl:p-7">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="eyebrow text-lime">Hoy</p>
              <p className="font-display text-sm text-muted-foreground capitalize">
                {longDay(today)}
              </p>
            </div>
            {todayTotals ? (
              <DayStatus
                totals={{
                  emptySlots: todayTotals.slots_vacios ?? 0,
                  mealsOut: todayTotals.meals_out ?? 0,
                  onTarget: isOnTarget(todayTotals),
                  proteinGap: todayTotals.protein_gap ?? 0,
                  kcalGap: todayTotals.kcal_gap ?? 0,
                }}
              />
            ) : null}
          </div>

          {!plan ? (
            <div className="flex flex-1 flex-col justify-center gap-5">
              <h1 className="font-display text-3xl leading-tight font-bold xl:text-4xl">
                Esta semana
                <br />
                <span className="text-lime">aún no tiene plan.</span>
              </h1>
              <Link
                href={`/semana?week=${weekStart}`}
                className="inline-flex w-fit items-center gap-2 rounded-full bg-lime px-5 py-3 font-display text-sm font-bold text-primary-foreground transition hover:-translate-y-0.5"
              >
                Planificar la semana <ArrowRight className="size-4" />
              </Link>
            </div>
          ) : todayTotals ? (
            <>
              <h1 className="font-display text-2xl leading-tight font-bold xl:text-3xl">
                {headline(todayTotals).top}
                <br />
                <span className="text-lime">{headline(todayTotals).accent}</span>
              </h1>
              <div className="flex flex-1 items-center gap-5 xl:gap-7">
                <MacroRings
                  size="fluid"
                  protein={todayTotals.protein ?? 0}
                  targetProtein={todayTotals.target_protein ?? 0}
                  kcal={todayTotals.kcal ?? 0}
                  targetKcal={todayTotals.target_kcal ?? 0}
                />
                <div className="min-w-0 flex-1 space-y-2.5 2xl:space-y-4">
                  <MacroRow label="Prot." value={todayTotals.protein} target={todayTotals.target_protein} unit="g" bar="bg-lime" text="text-lime" />
                  <MacroRow label="kcal" value={todayTotals.kcal} target={todayTotals.target_kcal} unit="" bar="bg-blaze" text="text-blaze" />
                  <MacroRow label="HC" value={todayTotals.carbs} target={target?.carbs_g ?? null} unit="g" bar="bg-white/40" text="text-foreground" />
                  <MacroRow label="Grasa" value={todayTotals.fat} target={target?.fat_g ?? null} unit="g" bar="bg-white/20" text="text-foreground" />
                </div>
              </div>
              {(todayTotals.slots_macro_incompletos ?? 0) > 0 ? (
                <p className="text-xs text-blaze">
                  Algún ingrediente no tiene macros: el total se queda corto.
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-muted-foreground">Sin datos para hoy en el plan.</p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Semana */}
          <div className="flex flex-col rounded-3xl bg-card p-5 xl:p-6">
            <div className="flex items-baseline justify-between gap-3">
              <p className="eyebrow">Semana</p>
              <Link
                href={`/semana?week=${weekStart}`}
                aria-label="Abrir la semana"
                className="text-muted-foreground transition hover:text-lime"
              >
                <ArrowUpRight className="size-4" />
              </Link>
            </div>
            {plan ? (
              <>
                <p className="mt-2 font-display text-4xl font-bold tabular-nums">
                  {daysOnTarget}
                  <span className="text-xl text-muted-foreground">/7</span>
                </p>
                <p className="text-xs text-muted-foreground">días en objetivo</p>
                <div className="mt-auto pt-4">
                  <WeekBars days={weekDays} heightClass="h-16" />
                </div>
              </>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">Sin plan esta semana.</p>
            )}
          </div>

          {/* Coste */}
          <div className="flex flex-col rounded-3xl bg-lime p-5 text-primary-foreground xl:p-6">
            <p className="font-display text-xs font-bold tracking-widest uppercase">
              Coste de la semana
            </p>
            <p className="mt-2 font-display text-4xl font-bold tabular-nums xl:text-5xl">
              {money(currentCost?.prorated_total)}
            </p>
            <p className="mt-auto pt-3 text-sm font-medium">
              Lo que comes, prorrateado al precio de Dia.
            </p>
          </div>

          {/* Peso */}
          <Link
            href="/peso"
            className="group flex flex-col rounded-3xl bg-card p-5 transition hover:bg-track xl:p-6"
          >
            <div className="flex items-baseline justify-between gap-3">
              <p className="eyebrow">Peso</p>
              {weightChange != null ? (
                <span className="rounded-full bg-lime/15 px-2.5 py-0.5 font-display text-xs text-lime tabular-nums">
                  {weightChange > 0 ? "+" : ""}
                  {decimal(weightChange)} kg
                </span>
              ) : null}
            </div>
            <p className="mt-2 font-display text-4xl font-bold tabular-nums">
              {latestWeight ? decimal(latestWeight.weight_kg) : "—"}
              <span className="text-xl text-muted-foreground"> kg</span>
            </p>
            {weightSeries.length > 1 ? (
              <div className="mt-auto pt-3">
                <Sparkline values={weightSeries} className="h-12 w-full" />
                <p className="mt-1 text-xs text-muted-foreground">
                  desde {shortDate(firstWeight!.measured_on)}
                </p>
              </div>
            ) : (
              <p className="mt-auto pt-3 text-xs text-muted-foreground">
                Registra tu peso para ver la tendencia.
              </p>
            )}
          </Link>

          {/* Proxima compra + domingo */}
          <Link
            href={`/compra?week=${nextWeekStart}`}
            className="group flex flex-col rounded-3xl bg-card p-5 transition hover:bg-track xl:p-6"
          >
            <div className="flex items-baseline justify-between gap-3">
              <p className="eyebrow">Próxima compra</p>
              <span className="font-display text-xs text-muted-foreground">
                cocinas el {shortDate(nextCookDate)}
              </span>
            </div>
            {boxTotal != null ? (
              <>
                <p className="mt-2 font-display text-4xl font-bold tabular-nums">
                  {money(boxTotal)}
                </p>
                <p className="text-xs text-muted-foreground">
                  en Dia
                  {glovoCost != null ? (
                    <>
                      {" "}
                      · Glovo <span className="text-blaze">{money(glovoCost)}</span>
                    </>
                  ) : null}
                </p>
                <div className="mt-auto flex items-center gap-2 pt-3 text-sm">
                  <ChefHat className="size-4 text-lime" />
                  <span className="text-muted-foreground">
                    {cookRows.length} receta{cookRows.length !== 1 ? "s" : ""} ·{" "}
                    <span className="text-foreground">{tuppers} tuppers</span>
                  </span>
                </div>
              </>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                Planifica la semana del {shortDate(nextWeekStart)} para ver la
                lista y el coste.
              </p>
            )}
          </Link>
        </div>
      </section>

      {/* Comidas de hoy, con la misma tarjeta que /semana */}
      {plan ? (
        <section className="flex flex-col gap-3 lg:min-h-0 lg:flex-1">
          <div className="flex items-baseline justify-between">
            <h2 className="eyebrow">Comidas de hoy</h2>
            <Link
              href={`/semana?week=${weekStart}`}
              className="inline-flex items-center gap-1 text-sm text-muted-foreground transition hover:text-lime"
            >
              Editar en la semana <ArrowRight className="size-3.5" />
            </Link>
          </div>
          {meals.length > 0 ? (
            <div className="grid auto-rows-fr gap-3 sm:grid-cols-2 lg:flex-1 xl:grid-cols-4">
              {meals.map(([meal, slot]) => {
                const recipe = slot.recipe_id
                  ? (recipeById.get(slot.recipe_id) ?? null)
                  : null;
                const eatingOut = slot.eating_out ?? false;
                return (
                  <Link
                    key={slot.id}
                    href={`/semana?week=${weekStart}`}
                    className={mealCardClass({ eatingOut, hasRecipe: recipe != null })}
                  >
                    <MealCardBody
                      emptyLabel="Elegir en la semana"
                      data={{
                        meal,
                        mealLabel: MEAL_LABELS[meal],
                        recipe,
                        servings: slot.servings ?? 1,
                        eatingOut,
                        variantMismatch: slot.variant_mismatch ?? false,
                        recipeVariant: slot.recipe_variant,
                      }}
                    />
                  </Link>
                );
              })}
            </div>
          ) : (
            <p className="rounded-3xl bg-card p-6 text-muted-foreground">
              Hoy no hay comidas en el plan.
            </p>
          )}
        </section>
      ) : null}
    </main>
  );
}

type TodayTotals = {
  protein_gap: number | null;
  kcal_gap: number | null;
  meals_out: number | null;
  slots_vacios: number | null;
};

// El titular cuenta lo que dice plan_day_totals sin maquillarlo: si
// hay huecos o comidas fuera, el total del plan no es el de verdad y
// se dice, en vez de dar un "te faltan X kcal" engañoso.
function headline(t: TodayTotals): { top: string; accent: string } {
  if ((t.slots_vacios ?? 0) > 0) {
    const n = t.slots_vacios!;
    return { top: "Plan a medias.", accent: `${n} hueco${n > 1 ? "s" : ""} por asignar.` };
  }
  if ((t.meals_out ?? 0) > 0) {
    return { top: "Hoy comes fuera.", accent: "El total no lo cuenta." };
  }
  const proteinOk = (t.protein_gap ?? -1) >= 0;
  const kcalOk = (t.kcal_gap ?? -1) >= 0;
  const top = proteinOk
    ? "Proteína cubierta."
    : `Faltan ${num(-(t.protein_gap ?? 0))} g de proteína.`;
  const accent = kcalOk
    ? "Energía cubierta."
    : `Faltan ${num(-(t.kcal_gap ?? 0))} kcal.`;
  return { top, accent };
}
