"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Crea el plan de la semana llamando a create_meal_plan (Postgres).
// Si la funcion falla -- fecha que no es lunes, o sin nutrition_target
// vigente -- el mensaje de error de la propia funcion se muestra tal
// cual, sin reinterpretarlo aqui.
export async function createPlan(formData: FormData) {
  const supabase = await createClient();
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
  const supabase = await createClient();

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
