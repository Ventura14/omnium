"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { TablesInsert } from "@/lib/database.types";

export async function logWeight(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

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
