import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Page, PageHeader, btnGhost } from "@/components/kit";
import RecipeForm from "../RecipeForm";

export default async function EditarRecetaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: recipe } = await supabase
    .from("recipes")
    .select("id, name, servings, prep_minutes, batch_friendly, freezer_ok, fridge_days, instructions")
    .eq("id", id)
    .single();

  if (!recipe) {
    notFound();
  }

  // food_id -> foods es una foreign key real, el embedding de
  // PostgREST funciona aqui (a diferencia de la vista recipe_macros).
  const { data: ingredientRows } = await supabase
    .from("recipe_ingredients")
    .select("food_id, grams, note, foods(name, source_detail)")
    .eq("recipe_id", id);

  const ingredients = (ingredientRows ?? []).map((row) => ({
    foodId: row.food_id,
    name: row.foods?.name ?? "(alimento eliminado)",
    sourceDetail: row.foods?.source_detail ?? null,
    grams: Number(row.grams),
    note: row.note,
  }));

  return (
    <Page>
      <Link href="/recetas" className={btnGhost}>
        <ArrowLeft className="size-4" /> Recetas
      </Link>
      <PageHeader eyebrow="Editar receta" title={recipe.name} />
      <RecipeForm
        initialRecipe={{
          id: recipe.id,
          name: recipe.name,
          servings: recipe.servings,
          prepMinutes: recipe.prep_minutes,
          batchFriendly: recipe.batch_friendly,
          freezerOk: recipe.freezer_ok,
          fridgeDays: recipe.fridge_days,
          instructions: recipe.instructions,
          ingredients,
        }}
      />
    </Page>
  );
}
