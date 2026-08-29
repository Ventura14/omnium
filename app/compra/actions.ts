"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";

// Marcar guarda la cantidad vigente (packs_checked); desmarcar borra
// la fila. No hay "editar cantidad" -- si packs_to_buy cambio desde
// que se marco, la pagina ya lo detecta comparando contra el valor
// guardado y lo pinta como desactualizado (ver ShoppingBoard).
export async function setShoppingCheck(
  planId: string,
  foodId: string,
  packsToBuy: number
) {
  const { supabase, user } = await requireUser();

  const { error } = await supabase.from("shopping_check").upsert({
    plan_id: planId,
    food_id: foodId,
    user_id: user.id,
    packs_checked: packsToBuy,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/compra");
}

export async function clearShoppingCheck(planId: string, foodId: string) {
  const { supabase } = await requireUser();

  const { error } = await supabase
    .from("shopping_check")
    .delete()
    .eq("plan_id", planId)
    .eq("food_id", foodId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/compra");
}
