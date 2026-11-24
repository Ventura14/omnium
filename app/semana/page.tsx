import { ArrowRight, CalendarPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { todayInMadrid, addDays, mondayOf } from "@/lib/dates";
import { WeekNav } from "@/components/WeekNav";
import { Alert, Page, btnPrimary } from "@/components/kit";
import { resolveDefaultWeekStart } from "@/lib/weekPlan";
import { createPlan } from "./actions";
import type { RecipeOption } from "./SlotCell";
import { WeekPlanner, type PlannerDay } from "./WeekPlanner";

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
  protein_per_100kcal: number | null;
  kcal_per_serving: number | null;
  protein_per_serving: number | null;
  carbs_per_serving: number | null;
  fat_per_serving: number | null;
};

type DayTotalRow = {
  slot_date: string;
  kcal: number;
  protein: number;
  carbs: number | null;
  fat: number | null;
  target_kcal: number;
  target_protein: number;
  kcal_gap: number | null;
  protein_gap: number | null;
  meals_out: number;
  slots_vacios: number;
  slots_macro_incompletos: number | null;
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
  // comiendo de el -> se abre ahi. Si no, se abre en el plan mas
  // PROXIMO en el futuro que exista (no siempre "la semana
  // siguiente" a secas -- si hoy solo hay un plan creado para dentro
  // de dos semanas, abrir en el hueco vacio de la semana que viene
  // deja ese plan real a un clic sin mostrarlo). Solo si no hay
  // ningun plan futuro, cae a la semana siguiente vacia, que es
  // donde de verdad hace falta crear uno. La fecha se ve arriba en
  // grande, así que no hay ambiguedad sobre donde se ha caido.
  // "Hoy" siempre via todayInMadrid() -- nunca new Date() a secas
  // (regla en CLAUDE.md, Convenciones): Vercel corre en UTC y entre
  // las 00:00 y las 02:00 de Madrid daria el dia anterior en silencio.
  const todayDate = new Date(`${todayInMadrid()}T00:00:00Z`);

  const currentWeekStart = mondayOf(todayDate);
  const defaultWeekStart = await resolveDefaultWeekStart(
    supabase,
    currentWeekStart
  );

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
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const { data: plan } = await supabase
    .from("meal_plans")
    .select("id, week_start, target_kcal, target_protein")
    .eq("week_start", weekStart)
    .maybeSingle();

  // Grasa y carbohidratos objetivo: meal_plans solo guarda kcal y
  // proteina; se toma el nutrition_target vigente con el mismo
  // criterio que create_meal_plan (fechado en o antes del lunes).
  const { data: target } = await supabase
    .from("nutrition_targets")
    .select("fat_g, carbs_g")
    .lte("effective_from", weekStart)
    .order("effective_from", { ascending: false })
    .limit(1)
    .maybeSingle();

  const slotsByDay = new Map<string, Partial<Record<Meal, SlotRow>>>();
  const dayTotalsByDate = new Map<string, DayTotalRow>();
  const optionsByMeal = new Map<Meal, RecipeOption[]>();
  const recipeById = new Map<string, RecipeOption>();

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
          .select(
            "recipe_id, name, protein_per_100kcal, kcal_per_serving, protein_per_serving, carbs_per_serving, fat_per_serving"
          )
          .order("protein_per_100kcal", { ascending: false })
          .returns<RecipeFitRow[]>(),
        supabase
          .from("plan_day_totals")
          .select(
            "slot_date, kcal, protein, carbs, fat, target_kcal, target_protein, kcal_gap, protein_gap, meals_out, slots_vacios, slots_macro_incompletos"
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
    for (const r of fitRows ?? []) {
      recipeById.set(r.recipe_id, {
        id: r.recipe_id,
        name: r.name,
        kcal: r.kcal_per_serving,
        protein: r.protein_per_serving,
        carbs: r.carbs_per_serving,
        fat: r.fat_per_serving,
        ppk: r.protein_per_100kcal,
        variant: null,
      });
    }
    for (const meal of MEAL_ORDER) {
      const { data: allowed } = await supabase
        .from("recipes")
        .select("id, variant")
        .contains("suits", [meal]);
      const allowedIds = new Set((allowed ?? []).map((r) => r.id));
      for (const r of allowed ?? []) {
        const option = recipeById.get(r.id);
        if (option) option.variant = r.variant;
      }
      optionsByMeal.set(
        meal,
        (fitRows ?? [])
          .filter((r) => allowedIds.has(r.recipe_id))
          .map((r) => recipeById.get(r.recipe_id)!)
      );
    }
  }

  const today = todayInMadrid();

  // Se pasa al cliente la semana ya resuelta: cada dia con sus huecos
  // y los totales de plan_day_totals tal cual. onTarget compara dos
  // gaps que ya vienen calculados por SQL.
  const plannerDays: PlannerDay[] = weekDays.map((day, dayIndex) => {
    const slotsOfDay = slotsByDay.get(day) ?? {};
    const t = dayTotalsByDate.get(day);
    const d = new Date(`${day}T00:00:00Z`);
    return {
      date: day,
      weekdayShort: d
        .toLocaleDateString("es-ES", { weekday: "short", timeZone: "UTC" })
        .replace(".", ""),
      dayNumber: d.getUTCDate(),
      longLabel: formatDayLabel(day),
      isToday: day === today,
      copyFrom: dayIndex > 0 ? weekdayName(weekDays[dayIndex - 1]) : null,
      totals: t
        ? {
            kcal: t.kcal,
            protein: t.protein,
            carbs: t.carbs,
            fat: t.fat,
            targetKcal: t.target_kcal,
            targetProtein: t.target_protein,
            targetCarbs: target?.carbs_g ?? null,
            targetFat: target?.fat_g ?? null,
            kcalGap: t.kcal_gap ?? 0,
            proteinGap: t.protein_gap ?? 0,
            // Gap NULL = algun ingrediente sin macros: no se sabe, asi que
            // no es "en objetivo" (regla 15: un dato que falta no es un 0).
            onTarget:
              (t.kcal_gap ?? -1) >= 0 &&
              (t.protein_gap ?? -1) >= 0 &&
              t.meals_out === 0 &&
              t.slots_vacios === 0 &&
              (t.slots_macro_incompletos ?? 0) === 0,
            macrosIncomplete: (t.slots_macro_incompletos ?? 0) > 0,
            mealsOut: t.meals_out,
            emptySlots: t.slots_vacios,
          }
        : null,
      slots: MEAL_ORDER.flatMap((meal) => {
        const slot = slotsOfDay[meal];
        if (!slot) return [];
        return [
          {
            key: `${slot.id}:${slot.recipe_id}:${slot.servings}:${slot.eating_out}`,
            slotId: slot.id,
            meal,
            weekStart,
            mealLabel: MEAL_LABELS[meal],
            dayLabel: formatDayLabel(day),
            recipe: slot.recipe_id
              ? (recipeById.get(slot.recipe_id) ?? null)
              : null,
            servings: slot.servings,
            eatingOut: slot.eating_out,
            variantMismatch: slot.variant_mismatch,
            recipeVariant: slot.recipe_variant,
            options: optionsByMeal.get(meal) ?? [],
          },
        ];
      }),
    };
  });

  return (
    <Page className="pb-6 lg:flex lg:flex-1 lg:flex-col">
      <WeekNav
        basePath="/semana"
        title="Semana"
        weekStart={weekStart}
        defaultWeekStart={defaultWeekStart}
        prevWeek={prevWeek}
        nextWeek={nextWeek}
      />

      {error ? <Alert>{error}</Alert> : null}

      {!plan ? (
        <form
          action={createPlan}
          className="glow-lime flex flex-col items-start gap-5 rounded-3xl bg-card p-8"
        >
          <input type="hidden" name="week_start" value={weekStart} />
          <CalendarPlus className="size-10 text-lime" strokeWidth={1.5} />
          <div>
            <h2 className="font-display text-2xl font-bold">
              Esta semana está en blanco.
            </h2>
            <p className="mt-1 max-w-md text-muted-foreground">
              Crea el plan y se generan los huecos de cada día con tu
              objetivo vigente. Luego asignas recetas o copias de un día a
              otro.
            </p>
          </div>
          <button type="submit" className={btnPrimary}>
            Crear plan <ArrowRight className="size-4" />
          </button>
        </form>
      ) : (
        <WeekPlanner
          days={plannerDays}
          planId={plan.id}
          weekStart={weekStart}
          initialDate={weekDays.includes(today) ? today : weekStart}
        />
      )}
    </Page>
  );
}
