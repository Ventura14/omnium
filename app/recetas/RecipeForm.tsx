"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Plus, Search, X } from "lucide-react";
import {
  Alert,
  Empty,
  Field,
  Panel,
  btnPrimary,
  inputClass,
} from "@/components/kit";
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

  const macroCells = [
    { label: "Proteína", value: visibleDraftMacros?.protein_per_serving, unit: "g", tone: "text-lime" },
    { label: "Energía", value: visibleDraftMacros?.kcal_per_serving, unit: "kcal", tone: "text-blaze" },
    { label: "Carbohidratos", value: visibleDraftMacros?.carbs_per_serving, unit: "g", tone: "text-muted-foreground" },
    { label: "Grasa", value: visibleDraftMacros?.fat_per_serving, unit: "g", tone: "text-muted-foreground" },
  ];

  return (
    <form
      onSubmit={handleSubmit}
      className="grid gap-5 lg:grid-cols-[1fr_20rem]"
    >
      <div className="space-y-5">
        {error ? <Alert>{error}</Alert> : null}

        <Panel title="Datos">
          <div className="space-y-4">
            <Field label="Nombre" htmlFor="name">
              <input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className={inputClass}
              />
            </Field>

            <div className="grid grid-cols-3 gap-3">
              <Field label="Raciones" htmlFor="servings">
                <input
                  id="servings"
                  type="number"
                  min="1"
                  step="1"
                  value={servings}
                  onChange={(e) => setServings(Number(e.target.value))}
                  required
                  className={inputClass}
                />
              </Field>
              <Field label="Minutos" htmlFor="prep_minutes">
                <input
                  id="prep_minutes"
                  type="number"
                  min="0"
                  step="1"
                  value={prepMinutes}
                  onChange={(e) => setPrepMinutes(e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Días nevera" htmlFor="fridge_days">
                <input
                  id="fridge_days"
                  type="number"
                  min="0"
                  step="1"
                  value={fridgeDays}
                  onChange={(e) => setFridgeDays(e.target.value)}
                  className={inputClass}
                />
              </Field>
            </div>

            <div className="flex flex-wrap gap-2">
              <Toggle
                checked={batchFriendly}
                onChange={setBatchFriendly}
                label="Aguanta bien en tupper"
              />
              <Toggle
                checked={freezerOk}
                onChange={setFreezerOk}
                label="Congela bien"
              />
            </div>

            <Field label="Instrucciones (opcional)" htmlFor="instructions">
              <textarea
                id="instructions"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                rows={3}
                className={inputClass}
              />
            </Field>
          </div>
        </Panel>

        <Panel title={`Ingredientes · ${ingredients.length}`}>
          <div className="relative">
            <label htmlFor="food_search" className="sr-only">
              Buscar alimento
            </label>
            <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              id="food_search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar alimento: pollo, arroz, patata…"
              autoComplete="off"
              className={`${inputClass} pl-11`}
            />
            {visibleSearchResults.length > 0 ? (
              <ul className="absolute inset-x-0 top-full z-20 mt-2 max-h-72 overflow-y-auto rounded-2xl border bg-popover p-1.5 shadow-2xl">
                {visibleSearchResults.map((food) => (
                  <li key={food.id}>
                    <button
                      type="button"
                      onClick={() => addIngredient(food)}
                      className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition hover:bg-track"
                    >
                      <span className="flex items-center gap-2">
                        <Plus className="size-3.5 text-lime" />
                        {food.name}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {food.source_detail ?? "manual"} · {food.kcal_100g} kcal/100g
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          {ingredients.length > 0 ? (
            <ul className="mt-4 space-y-2">
              {ingredients.map((ing, index) => (
                <li
                  key={`${ing.foodId}-${index}`}
                  className="flex items-center gap-3 rounded-2xl bg-background px-4 py-2.5"
                >
                  <span className="min-w-0 flex-1 truncate text-sm">{ing.name}</span>
                  <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={ing.grams}
                      onChange={(e) => updateGrams(index, Number(e.target.value))}
                      aria-label={`Gramos de ${ing.name}`}
                      className="w-20 rounded-lg border border-input bg-card px-2 py-1 text-right text-foreground tabular-nums outline-none focus-visible:border-lime"
                    />
                    g
                  </label>
                  <button
                    type="button"
                    onClick={() => removeIngredient(index)}
                    aria-label={`Quitar ${ing.name}`}
                    className="grid size-8 place-items-center rounded-full text-muted-foreground transition hover:bg-destructive/15 hover:text-destructive"
                  >
                    <X className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-4">
              <Empty>Todavía no hay ingredientes. Búscalos arriba, en crudo y en gramos.</Empty>
            </div>
          )}
        </Panel>
      </div>

      <aside className="lg:sticky lg:top-5 lg:self-start">
        <div className="glow-lime rounded-3xl bg-card p-6">
          <p className="eyebrow">Macros por ración</p>
          {visibleDraftMacros ? (
            <>
              <dl className="mt-4 grid grid-cols-2 gap-4">
                {macroCells.map((c) => (
                  <div key={c.label}>
                    <dt className={`text-xs tracking-wider uppercase ${c.tone}`}>
                      {c.label}
                    </dt>
                    <dd className="font-display text-2xl font-semibold tabular-nums">
                      {c.value ?? "—"}
                      {c.value != null ? (
                        <span className="text-sm text-muted-foreground"> {c.unit}</span>
                      ) : null}
                    </dd>
                  </div>
                ))}
              </dl>
              {visibleDraftMacros.missing_macro_foods ? (
                <p className="mt-4 text-sm text-blaze">
                  Faltan macros de: {visibleDraftMacros.missing_macro_foods.join(", ")}. Los
                  totales no se pueden calcular hasta que tengan etiqueta.
                </p>
              ) : null}
            </>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              Añade ingredientes para ver los macros.
            </p>
          )}

          <button type="submit" disabled={saving} className={`${btnPrimary} mt-6 w-full`}>
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Check className="size-4" />
            )}
            {saving ? "Guardando…" : "Guardar receta"}
          </button>
        </div>
      </aside>
    </form>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label
      className={`inline-flex cursor-pointer items-center gap-2 rounded-full px-4 py-2 text-sm transition select-none ${
        checked ? "bg-lime text-primary-foreground" : "bg-track text-muted-foreground hover:text-foreground"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      {checked ? <Check className="size-3.5" /> : null}
      {label}
    </label>
  );
}
