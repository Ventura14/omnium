import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="mb-6 text-xl font-semibold">{recipe.name}</h1>
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
    </main>
  );
}
