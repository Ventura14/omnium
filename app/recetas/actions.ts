"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { TablesInsert } from "@/lib/database.types";

export type FoodSearchResult = {
  id: string;
  name: string;
  source_detail: string | null;
  kcal_100g: number;
  protein_100g: number;
  carbs_100g: number;
  fat_100g: number;
};

// Coincidencia por palabras (AND, cualquier orden) contra
// search_name, BEDCA antes que BEDCA2. Normalizacion y tokenizado
// viven enteros en Postgres (funcion search_foods) -- aqui solo se
// llama a la RPC, sin repetir esa logica en TypeScript.
export async function searchFoods(query: string): Promise<FoodSearchResult[]> {
  if (query.trim().length < 2) {
    return [];
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_foods", { query });

  if (error) {
    return [];
  }
  return data;
}

export type DraftMacros = {
  kcal_per_serving: number;
  protein_per_serving: number;
  carbs_per_serving: number;
  fat_per_serving: number;
};

// Macros por racion "al vuelo" mientras se edita, antes de guardar
// (todavia no hay recipe_id contra el que consultar la vista
// recipe_macros). Misma aritmetica que esa vista, via la funcion
// compute_recipe_macros -- el calculo sigue en Postgres.
export async function computeDraftMacros(
  ingredients: { foodId: string; grams: number }[],
  servings: number
): Promise<DraftMacros | null> {
  if (ingredients.length === 0 || servings < 1) {
    return null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("compute_recipe_macros", {
    p_food_ids: ingredients.map((i) => i.foodId),
    p_grams: ingredients.map((i) => i.grams),
    p_servings: servings,
  });

  if (error || !data || data.length === 0) {
    return null;
  }
  return data[0];
}

export type IngredientInput = {
  foodId: string;
  grams: number;
  note: string | null;
};

export type SaveRecipeInput = {
  recipeId: string | null;
  name: string;
  servings: number;
  prepMinutes: number | null;
  batchFriendly: boolean;
  freezerOk: boolean;
  fridgeDays: number | null;
  instructions: string | null;
  ingredients: IngredientInput[];
};

export async function saveRecipe(
  input: SaveRecipeInput
): Promise<{ error: string | null; recipeId: string | null }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const recipeRow: TablesInsert<"recipes"> = {
    id: input.recipeId ?? undefined,
    user_id: user.id,
    name: input.name,
    servings: input.servings,
    prep_minutes: input.prepMinutes,
    batch_friendly: input.batchFriendly,
    freezer_ok: input.freezerOk,
    fridge_days: input.fridgeDays,
    instructions: input.instructions,
  };

  const { data: savedRecipe, error: recipeError } = await supabase
    .from("recipes")
    .upsert(recipeRow)
    .select("id")
    .single();

  if (recipeError || !savedRecipe) {
    return { error: recipeError?.message ?? "No se pudo guardar la receta", recipeId: null };
  }

  const recipeId = savedRecipe.id;

  // Editar = reemplazar todos los ingredientes por el set nuevo.
  const { error: deleteError } = await supabase
    .from("recipe_ingredients")
    .delete()
    .eq("recipe_id", recipeId);

  if (deleteError) {
    return { error: deleteError.message, recipeId };
  }

  if (input.ingredients.length > 0) {
    const rows: TablesInsert<"recipe_ingredients">[] = input.ingredients.map((i) => ({
      recipe_id: recipeId,
      food_id: i.foodId,
      grams: i.grams,
      note: i.note,
    }));

    const { error: ingredientsError } = await supabase
      .from("recipe_ingredients")
      .insert(rows);

    if (ingredientsError) {
      return { error: ingredientsError.message, recipeId };
    }
  }

  revalidatePath("/recetas");
  revalidatePath(`/recetas/${recipeId}`);
  return { error: null, recipeId };
}
