"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  computeDraftMacros,
  saveRecipe,
  searchFoods,
  type DraftMacros,
  type FoodSearchResult,
} from "./actions";

type IngredientRow = {
  foodId: string;
  name: string;
  sourceDetail: string | null;
  grams: number;
  note: string | null;
};

type RecipeFormProps = {
  initialRecipe?: {
    id: string;
    name: string;
    servings: number;
    prepMinutes: number | null;
    batchFriendly: boolean;
    freezerOk: boolean;
    fridgeDays: number | null;
    instructions: string | null;
    ingredients: IngredientRow[];
  };
};

export default function RecipeForm({ initialRecipe }: RecipeFormProps) {
  const router = useRouter();

  const [name, setName] = useState(initialRecipe?.name ?? "");
  const [servings, setServings] = useState(initialRecipe?.servings ?? 4);
  const [prepMinutes, setPrepMinutes] = useState<string>(
    initialRecipe?.prepMinutes?.toString() ?? ""
  );
  const [batchFriendly, setBatchFriendly] = useState(initialRecipe?.batchFriendly ?? true);
  const [freezerOk, setFreezerOk] = useState(initialRecipe?.freezerOk ?? false);
  const [fridgeDays, setFridgeDays] = useState<string>(
    initialRecipe?.fridgeDays?.toString() ?? "4"
  );
  const [instructions, setInstructions] = useState(initialRecipe?.instructions ?? "");

  const [ingredients, setIngredients] = useState<IngredientRow[]>(
    initialRecipe?.ingredients ?? []
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<FoodSearchResult[]>([]);

  const [draftMacros, setDraftMacros] = useState<DraftMacros | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Buscador: debounce simple para no disparar una peticion por tecla.
  // El "vaciar resultados con menos de 2 caracteres" se deriva en el
  // render (visibleSearchResults), no con un setState sincrono aqui
  // dentro del efecto -- evita el patron que react-hooks/set-state-in-effect
  // marca (setState sincrono en un efecto puede encadenar renders).
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      return;
    }
    const timeout = setTimeout(async () => {
      const results = await searchFoods(searchQuery);
      setSearchResults(results);
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  const visibleSearchResults =
    searchQuery.trim().length < 2 ? [] : searchResults;

  // Recalculo de macros al vuelo: la aritmetica corre en Postgres
  // (compute_recipe_macros), aqui solo se dispara la llamada. Mismo
  // motivo que arriba: "sin ingredientes -> sin macros" se deriva en
  // el render (visibleDraftMacros), no con un setState sincrono.
  useEffect(() => {
    if (ingredients.length === 0) {
      return;
    }
    computeDraftMacros(
      ingredients.map((i) => ({ foodId: i.foodId, grams: i.grams })),
      servings
    ).then(setDraftMacros);
  }, [ingredients, servings]);

  const visibleDraftMacros = ingredients.length === 0 ? null : draftMacros;

  function addIngredient(food: FoodSearchResult) {
    setIngredients((prev) => [
      ...prev,
      { foodId: food.id, name: food.name, sourceDetail: food.source_detail, grams: 100, note: null },
    ]);
    setSearchQuery("");
    setSearchResults([]);
  }

  function updateGrams(index: number, grams: number) {
    setIngredients((prev) =>
      prev.map((ing, i) => (i === index ? { ...ing, grams } : ing))
    );
  }

  function removeIngredient(index: number) {
    setIngredients((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const result = await saveRecipe({
      recipeId: initialRecipe?.id ?? null,
      name,
      servings,
      prepMinutes: prepMinutes ? Number(prepMinutes) : null,
      batchFriendly,
      freezerOk,
      fridgeDays: fridgeDays ? Number(fridgeDays) : null,
      instructions: instructions.trim() || null,
      ingredients: ingredients.map((i) => ({
        foodId: i.foodId,
        grams: i.grams,
        note: i.note,
      })),
    });

    setSaving(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    router.push(`/recetas/${result.recipeId}`);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <section className="space-y-4">
        <div className="space-y-1">
          <label htmlFor="name" className="block text-sm font-medium">
            Nombre
          </label>
          <input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full rounded border px-3 py-2"
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1">
            <label htmlFor="servings" className="block text-sm font-medium">
              Raciones
            </label>
            <input
              id="servings"
              type="number"
              min="1"
              step="1"
              value={servings}
              onChange={(e) => setServings(Number(e.target.value))}
              required
              className="w-full rounded border px-3 py-2"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="prep_minutes" className="block text-sm font-medium">
              Minutos preparación
            </label>
            <input
              id="prep_minutes"
              type="number"
              min="0"
              step="1"
              value={prepMinutes}
              onChange={(e) => setPrepMinutes(e.target.value)}
              className="w-full rounded border px-3 py-2"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="fridge_days" className="block text-sm font-medium">
              Días en nevera
            </label>
            <input
              id="fridge_days"
              type="number"
              min="0"
              step="1"
              value={fridgeDays}
              onChange={(e) => setFridgeDays(e.target.value)}
              className="w-full rounded border px-3 py-2"
            />
          </div>
        </div>

        <div className="flex gap-6">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={batchFriendly}
              onChange={(e) => setBatchFriendly(e.target.checked)}
            />
            Aguanta bien en tupper
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={freezerOk}
              onChange={(e) => setFreezerOk(e.target.checked)}
            />
            Congela bien
          </label>
        </div>

        <div className="space-y-1">
          <label htmlFor="instructions" className="block text-sm font-medium">
            Instrucciones (opcional)
          </label>
          <textarea
            id="instructions"
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            rows={3}
            className="w-full rounded border px-3 py-2"
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Ingredientes</h2>

        <div className="relative space-y-1">
          <label htmlFor="food_search" className="block text-sm font-medium">
            Buscar alimento
          </label>
          <input
            id="food_search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="pollo, arroz, tomate..."
            className="w-full rounded border px-3 py-2"
          />
          {visibleSearchResults.length > 0 ? (
            <ul className="max-h-64 overflow-y-auto rounded border">
              {visibleSearchResults.map((food) => (
                <li key={food.id}>
                  <button
                    type="button"
                    onClick={() => addIngredient(food)}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-gray-100"
                  >
                    <span>{food.name}</span>
                    <span className="text-xs text-gray-500">
                      {food.source_detail ?? "manual"} · {food.kcal_100g} kcal/100g
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {ingredients.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2">Alimento</th>
                <th className="py-2">Gramos</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {ingredients.map((ing, index) => (
                <tr key={`${ing.foodId}-${index}`} className="border-b">
                  <td className="py-2">{ing.name}</td>
                  <td className="py-2">
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={ing.grams}
                      onChange={(e) => updateGrams(index, Number(e.target.value))}
                      className="w-24 rounded border px-2 py-1"
                    />
                  </td>
                  <td className="py-2">
                    <button
                      type="button"
                      onClick={() => removeIngredient(index)}
                      className="text-sm text-red-600"
                    >
                      Quitar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-gray-500">Todavía no hay ingredientes.</p>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Macros por ración</h2>
        {visibleDraftMacros ? (
          <dl className="grid grid-cols-4 gap-4 text-sm">
            <div>
              <dt className="text-gray-500">kcal</dt>
              <dd>{visibleDraftMacros.kcal_per_serving}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Proteína</dt>
              <dd>{visibleDraftMacros.protein_per_serving} g</dd>
            </div>
            <div>
              <dt className="text-gray-500">Carbohidratos</dt>
              <dd>{visibleDraftMacros.carbs_per_serving} g</dd>
            </div>
            <div>
              <dt className="text-gray-500">Grasa</dt>
              <dd>{visibleDraftMacros.fat_per_serving} g</dd>
            </div>
          </dl>
        ) : (
          <p className="text-sm text-gray-500">Añade ingredientes para ver los macros.</p>
        )}
      </section>

      <button
        type="submit"
        disabled={saving}
        className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
      >
        {saving ? "Guardando…" : "Guardar receta"}
      </button>
    </form>
  );
}
