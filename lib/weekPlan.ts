import { createClient } from "@/lib/supabase/server";
import { addDays } from "@/lib/dates";

// Compartido por /semana y /compra: sin ?week= explicito, la semana
// por defecto es la que tiene plan en curso; si no, el plan mas
// PROXIMO en el futuro (no siempre "la siguiente" a secas -- si hoy
// es 29 de agosto y el unico plan es el del 7 de septiembre, abrir
// en la del 1 de septiembre, vacia, deja un plan real a un clic sin
// mostrarlo). Solo si no hay ningun plan futuro, cae a la semana
// siguiente vacia -- ahi si hace falta crear uno.
export async function resolveDefaultWeekStart(
  supabase: Awaited<ReturnType<typeof createClient>>,
  currentWeekStart: string
): Promise<string> {
  const { data: currentPlan } = await supabase
    .from("meal_plans")
    .select("id")
    .eq("week_start", currentWeekStart)
    .maybeSingle();
  if (currentPlan) return currentWeekStart;

  const { data: nextPlan } = await supabase
    .from("meal_plans")
    .select("week_start")
    .gte("week_start", currentWeekStart)
    .order("week_start", { ascending: true })
    .limit(1)
    .maybeSingle();

  return nextPlan ? nextPlan.week_start : addDays(currentWeekStart, 7);
}
