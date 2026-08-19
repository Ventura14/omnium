"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import type { TablesInsert } from "@/lib/database.types";

export async function logWeight(formData: FormData) {
  const { supabase, user } = await requireUser();

  const entry: TablesInsert<"body_metrics"> = {
    user_id: user.id,
    measured_on: String(formData.get("measured_on") ?? ""),
    weight_kg: Number(formData.get("weight_kg")),
  };

  const { error } = await supabase
    .from("body_metrics")
    .upsert(entry, { onConflict: "user_id,measured_on" });

  if (error) {
    redirect(`/peso?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/peso");
  redirect("/peso");
}
