"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { TablesInsert } from "@/lib/database.types";

export async function addFood(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const name = String(formData.get("name") ?? "").trim();

  // search_name no se manda: lo calcula siempre un trigger en Postgres
  // (normalize_search_name), que ignora cualquier valor del cliente.
  // TablesInsert lo marca como requerido porque el generador de tipos
  // no modela triggers, solo columnas DEFAULT -- el cast es seguro
  // porque la fila nunca llega a existir sin ese campo relleno.
  const food = {
    user_id: user.id,
    name,
    kcal_100g: Number(formData.get("kcal_100g")),
    protein_100g: Number(formData.get("protein_100g")),
    carbs_100g: Number(formData.get("carbs_100g")),
    fat_100g: Number(formData.get("fat_100g")),
  } as TablesInsert<"foods">;

  const { error } = await supabase.from("foods").insert(food);

  if (error) {
    redirect(`/foods?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/foods");
  redirect("/foods");
}
