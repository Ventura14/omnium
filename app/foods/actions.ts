"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { TablesInsert } from "@/lib/database.types";

// NFD descompone las letras acentuadas en base + marca diacritica combinante
// (bloque Unicode 0x0300-0x036f); quitar esas marcas deja solo la base.
const COMBINING_MARKS_START = 0x0300;
const COMBINING_MARKS_END = 0x036f;

function toSearchName(name: string) {
  return Array.from(name.trim().toLowerCase().normalize("NFD"))
    .filter((char) => {
      const code = char.codePointAt(0) ?? 0;
      return code < COMBINING_MARKS_START || code > COMBINING_MARKS_END;
    })
    .join("");
}

export async function addFood(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const name = String(formData.get("name") ?? "").trim();

  const food: TablesInsert<"foods"> = {
    user_id: user.id,
    name,
    search_name: toSearchName(name),
    kcal_100g: Number(formData.get("kcal_100g")),
    protein_100g: Number(formData.get("protein_100g")),
    carbs_100g: Number(formData.get("carbs_100g")),
    fat_100g: Number(formData.get("fat_100g")),
  };

  const { error } = await supabase.from("foods").insert(food);

  if (error) {
    redirect(`/foods?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/foods");
  redirect("/foods");
}
