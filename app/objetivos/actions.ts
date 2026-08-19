"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import type { TablesInsert } from "@/lib/database.types";

export async function setTarget(formData: FormData) {
  const { supabase, user } = await requireUser();

  const target: TablesInsert<"nutrition_targets"> = {
    user_id: user.id,
    effective_from: String(formData.get("effective_from") ?? ""),
    kcal: Number(formData.get("kcal")),
    protein_g: Number(formData.get("protein_g")),
    fat_g: Number(formData.get("fat_g")),
    carbs_g: Number(formData.get("carbs_g")),
    notes: String(formData.get("notes") ?? "").trim() || null,
  };

  const { error } = await supabase
    .from("nutrition_targets")
    .upsert(target, { onConflict: "user_id,effective_from" });

  if (error) {
    redirect(`/objetivos?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/objetivos");
  redirect("/objetivos");
}
