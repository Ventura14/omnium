"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { addDays } from "@/lib/dates";

// Crea el plan de la semana llamando a create_meal_plan (Postgres).
// Si la funcion falla -- fecha que no es lunes, o sin nutrition_target
// vigente -- el mensaje de error de la propia funcion se muestra tal
// cual, sin reinterpretarlo aqui.
export async function createPlan(formData: FormData) {
  const { supabase } = await requireUser();

  const weekStart = String(formData.get("week_start") ?? "");

  const { error } = await supabase.rpc("create_meal_plan", {
    p_week_start: weekStart,
  });

  if (error) {
    redirect(
      `/semana?week=${weekStart}&error=${encodeURIComponent(error.message)}`
    );
  }

  revalidatePath("/semana");
  redirect(`/semana?week=${weekStart}`);
}

// Guarda un hueco: receta (o ninguna), raciones, si se come fuera.
// Un solo UPDATE sobre meal_plan_slots -- el hueco ya existe, lo crea
// create_meal_plan.
export async function assignSlot(formData: FormData) {
  const { supabase } = await requireUser();

  const slotId = String(formData.get("slot_id") ?? "");
  const weekStart = String(formData.get("week_start") ?? "");
  const recipeIdRaw = String(formData.get("recipe_id") ?? "");
  const servingsRaw = String(formData.get("servings") ?? "1");
  const eatingOut = formData.get("eating_out") === "on";

  const { error } = await supabase
    .from("meal_plan_slots")
    .update({
      recipe_id: recipeIdRaw === "" ? null : recipeIdRaw,
      servings: Number(servingsRaw) || 1,
      eating_out: eatingOut,
    })
    .eq("id", slotId);

  if (error) {
    redirect(
      `/semana?week=${weekStart}&error=${encodeURIComponent(error.message)}`
    );
  }

  revalidatePath("/semana");
  redirect(`/semana?week=${weekStart}`);
}

// Copia las 4 asignaciones (receta, raciones, fuera de casa) del dia
// anterior DENTRO DEL MISMO PLAN a target_date. Pasa de 28 guardados
// a unos 6 para llenar una semana entera -- el lunes se asigna a mano,
// el resto se copia y se ajusta lo que cambie. Solo mira el dia
// inmediatamente anterior en este plan (no cruza a la semana previa),
// por eso el boton no aparece en el primer dia de la rejilla.
export async function copyPreviousDay(formData: FormData) {
  const { supabase } = await requireUser();

  const planId = String(formData.get("plan_id") ?? "");
  const targetDate = String(formData.get("target_date") ?? "");
  const weekStart = String(formData.get("week_start") ?? "");
  const prevDate = addDays(targetDate, -1);

  const { data: prevSlots, error: fetchError } = await supabase
    .from("meal_plan_slots")
    .select("meal, recipe_id, servings, eating_out")
    .eq("plan_id", planId)
    .eq("slot_date", prevDate);

  if (fetchError) {
    redirect(
      `/semana?week=${weekStart}&error=${encodeURIComponent(fetchError.message)}`
    );
  }

  for (const prevSlot of prevSlots ?? []) {
    const { error: updateError } = await supabase
      .from("meal_plan_slots")
      .update({
        recipe_id: prevSlot.recipe_id,
        servings: prevSlot.servings,
        eating_out: prevSlot.eating_out,
      })
      .eq("plan_id", planId)
      .eq("slot_date", targetDate)
      .eq("meal", prevSlot.meal);

    if (updateError) {
      redirect(
        `/semana?week=${weekStart}&error=${encodeURIComponent(updateError.message)}`
      );
    }
  }

  revalidatePath("/semana");
  redirect(`/semana?week=${weekStart}`);
}
