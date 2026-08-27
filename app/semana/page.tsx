import { createClient } from "@/lib/supabase/server";
import { todayInMadrid, addDays, mondayOf } from "@/lib/dates";
import { createPlan, assignSlot, copyPreviousDay } from "./actions";

// Ninguna cuenta de macros vive aqui. Esta pagina solo pinta lo que
// devuelven create_meal_plan, recipe_fit y plan_day_totals -- toda la
// aritmetica esta en Postgres.

const MEAL_ORDER = ["midmorning", "lunch", "snack", "dinner"] as const;
type Meal = (typeof MEAL_ORDER)[number];

const MEAL_LABELS: Record<Meal, string> = {
  midmorning: "Media mañana",
  lunch: "Comida",
  snack: "Merienda",
  dinner: "Cena",
};

function formatDayLabel(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  return d.toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

function weekdayName(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  return d.toLocaleDateString("es-ES", { weekday: "long", timeZone: "UTC" });
}

type SlotRow = {
  id: string;
  slot_date: string;
  meal: Meal;
  recipe_id: string | null;
  servings: number;
  eating_out: boolean;
  recipe_variant: string | null;
  variant_mismatch: boolean;
};

type RecipeFitRow = {
  recipe_id: string;
  name: string;
  protein_per_100kcal: number;
};

type DayTotalRow = {
  slot_date: string;
  kcal: number;
  protein: number;
  target_kcal: number;
  target_protein: number;
  kcal_gap: number;
  protein_gap: number;
  meals_out: number;
  slots_vacios: number;
};

export default async function SemanaPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; error?: string }>;
}) {
  const { week, error } = await searchParams;
  const supabase = await createClient();

  // Sin ?week= explicito: adaptativo, no fijo a "actual" ni a
  // "siguiente". Si la semana en curso YA tiene plan, el usuario esta
  // comiendo de el -> se abre ahi. Si no lo tiene, esta planificando
  // la que viene (domingo se cocina para la semana que empieza al dia
  // siguiente) -> se abre en la siguiente. La fecha se ve arriba en
  // grande, así que no hay ambiguedad sobre donde se ha caido.
  // "Hoy" siempre via todayInMadrid() -- nunca new Date() a secas
  // (regla en CLAUDE.md, Convenciones): Vercel corre en UTC y entre
  // las 00:00 y las 02:00 de Madrid daria el dia anterior en silencio.
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
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const { data: plan } = await supabase
    .from("meal_plans")
    .select("id, week_start, target_kcal, target_protein")
    .eq("week_start", weekStart)
    .maybeSingle();

  const slotsByDay = new Map<string, Partial<Record<Meal, SlotRow>>>();
  const dayTotalsByDate = new Map<string, DayTotalRow>();
  const optionsByMeal = new Map<Meal, { id: string; name: string }[]>();

  if (plan) {
    const [{ data: slots }, { data: fitRows }, { data: dayTotals }] =
      await Promise.all([
        // variant_mismatch ya viene calculado por SQL (vista
        // meal_plan_slot_details, comparado contra work_schedule) --
        // "que dia toca oficina" no vive en TypeScript.
        supabase
          .from("meal_plan_slot_details")
          .select(
            "id, slot_date, meal, recipe_id, servings, eating_out, recipe_variant, variant_mismatch"
          )
          .eq("plan_id", plan.id)
          .returns<SlotRow[]>(),
        // Orden por protein_per_100kcal desc viene de la vista
        // recipe_fit (SQL), no se calcula ni se ordena en JS.
        supabase
          .from("recipe_fit")
          .select("recipe_id, name, protein_per_100kcal")
          .order("protein_per_100kcal", { ascending: false })
          .returns<RecipeFitRow[]>(),
        supabase
          .from("plan_day_totals")
          .select(
            "slot_date, kcal, protein, target_kcal, target_protein, kcal_gap, protein_gap, meals_out, slots_vacios"
          )
          .eq("plan_id", plan.id)
          .returns<DayTotalRow[]>(),
      ]);

    for (const slot of slots ?? []) {
      const day = slotsByDay.get(slot.slot_date) ?? {};
      day[slot.meal] = slot;
      slotsByDay.set(slot.slot_date, day);
    }

    for (const row of dayTotals ?? []) {
      dayTotalsByDate.set(row.slot_date, row);
    }

    // "suits" filtra por SQL (@>, via .contains()); el orden de cada
    // lista resultante viene de recipe_fit (tambien SQL). No hay FK
    // entre recipes y la vista recipe_fit para pedirle a PostgREST
    // que lo haga en una sola consulta embebida (mismo motivo que el
    // join manual de recipe_macros en /recetas), asi que se cruzan
    // aqui dos resultados ya calculados por Postgres, sin recalcular
    // ni reordenar nada nuevo.
    for (const meal of MEAL_ORDER) {
      const { data: allowed } = await supabase
        .from("recipes")
        .select("id")
        .contains("suits", [meal]);
      const allowedIds = new Set((allowed ?? []).map((r) => r.id));
      optionsByMeal.set(
        meal,
        (fitRows ?? [])
          .filter((r) => allowedIds.has(r.recipe_id))
          .map((r) => ({ id: r.recipe_id, name: r.name }))
      );
    }
  }

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Semana</h1>
        <div className="flex gap-4 text-sm">
          <a href={`/semana?week=${prevWeek}`} className="underline">
            ← semana anterior
          </a>
          <span className="text-gray-500">{weekStart}</span>
          <a href={`/semana?week=${nextWeek}`} className="underline">
            semana siguiente →
          </a>
        </div>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {!plan ? (
        <form action={createPlan} className="space-y-3">
          <input type="hidden" name="week_start" value={weekStart} />
          <p className="text-sm text-gray-500">
            Todavía no hay plan para la semana del {weekStart}.
          </p>
          <button
            type="submit"
            className="rounded bg-black px-4 py-2 text-sm text-white"
          >
            Crear plan
          </button>
        </form>
      ) : (
        <div className="space-y-8">
          <p className="text-sm text-gray-500">
            Objetivo: {plan.target_kcal} kcal · {plan.target_protein} g
            proteína
          </p>

          {weekDays.map((day, dayIndex) => {
            const slotsOfDay = slotsByDay.get(day) ?? {};
            const totals = dayTotalsByDate.get(day);

            return (
              <section key={day} className="space-y-3 border-t pt-4">
                <div className="flex items-baseline justify-between">
                  <div className="flex items-baseline gap-3">
                    <h2 className="text-sm font-semibold capitalize">
                      {formatDayLabel(day)}
                    </h2>
                    {dayIndex > 0 ? (
                      <form action={copyPreviousDay}>
                        <input type="hidden" name="plan_id" value={plan.id} />
                        <input
                          type="hidden"
                          name="target_date"
                          value={day}
                        />
                        <input
                          type="hidden"
                          name="week_start"
                          value={weekStart}
                        />
                        <button
                          type="submit"
                          className="text-xs text-gray-500 underline"
                          title="Sobrescribe los 4 huecos de este día"
                        >
                          copiar {weekdayName(weekDays[dayIndex - 1])}{" "}
                          (sobrescribe)
                        </button>
                      </form>
                    ) : null}
                  </div>
                  <DaySummary totals={totals} />
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {MEAL_ORDER.map((meal) => {
                    const slot = slotsOfDay[meal];
                    if (!slot) return null;
                    return (
                      <form
                        key={slot.id}
                        action={assignSlot}
                        className="space-y-2 rounded border p-3 text-sm"
                      >
                        <input type="hidden" name="slot_id" value={slot.id} />
                        <input
                          type="hidden"
                          name="week_start"
                          value={weekStart}
                        />
                        <p className="font-medium text-gray-700">
                          {MEAL_LABELS[meal]}
                        </p>

                        <select
                          name="recipe_id"
                          defaultValue={slot.recipe_id ?? ""}
                          className="w-full rounded border px-2 py-1"
                        >
                          <option value="">— sin asignar —</option>
                          {(optionsByMeal.get(meal) ?? []).map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.name}
                            </option>
                          ))}
                        </select>

                        {slot.variant_mismatch ? (
                          <p className="text-xs text-amber-600">
                            ⚠ Es variante &quot;{slot.recipe_variant}&quot;,
                            revisa si toca ese día.
                          </p>
                        ) : null}

                        <div className="flex items-center gap-2">
                          <label htmlFor={`servings-${slot.id}`}>
                            Raciones
                          </label>
                          <input
                            id={`servings-${slot.id}`}
                            name="servings"
                            type="number"
                            step="0.5"
                            min="0.5"
                            defaultValue={slot.servings}
                            className="w-16 rounded border px-2 py-1"
                          />
                        </div>

                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            name="eating_out"
                            defaultChecked={slot.eating_out}
                          />
                          Fuera de casa
                        </label>

                        <button
                          type="submit"
                          className="rounded bg-black px-3 py-1 text-xs text-white"
                        >
                          Guardar
                        </button>
                      </form>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}

// Un dia por debajo del objetivo puede deberse a tres causas
// distintas -- huecos sin asignar, una comida fuera, o de verdad
// faltan calorias -- y tienen que distinguirse de un vistazo. Mostrar
// solo kcal_gap sin esto haria parecer roto un dia que esta bien.
function DaySummary({ totals }: { totals: DayTotalRow | undefined }) {
  if (!totals) {
    return <span className="text-xs text-gray-400">—</span>;
  }

  const notes: string[] = [];
  if (totals.meals_out > 0) {
    notes.push(
      `${totals.meals_out} comida${totals.meals_out > 1 ? "s" : ""} fuera`
    );
  }
  if (totals.slots_vacios > 0) {
    notes.push(
      `${totals.slots_vacios} hueco${totals.slots_vacios > 1 ? "s" : ""} por asignar`
    );
  }

  const isShort = totals.kcal_gap < 0 || totals.protein_gap < 0;
  const hasCaveat = totals.meals_out > 0 || totals.slots_vacios > 0;

  return (
    <div className="text-right text-xs">
      <p className={hasCaveat ? "text-gray-500" : isShort ? "text-amber-600" : "text-green-700"}>
        {totals.kcal} kcal · {totals.protein} g prot
        {!hasCaveat
          ? ` (${totals.kcal_gap >= 0 ? "+" : ""}${totals.kcal_gap} kcal, ${totals.protein_gap >= 0 ? "+" : ""}${totals.protein_gap} g prot)`
          : ""}
      </p>
      {notes.length > 0 ? (
        <p className="text-gray-500">{notes.join(" · ")}</p>
      ) : null}
    </div>
  );
}
