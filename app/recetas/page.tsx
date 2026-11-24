import Link from "next/link";
import { ChefHat, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Alert, Empty, Page, PageHeader, btnPrimary } from "@/components/kit";
import { decimal, num } from "@/lib/format";

export const metadata = { title: "Recetas" };

export default async function RecetasPage() {
  const supabase = await createClient();

  const { data: recipes, error } = await supabase
    .from("recipes")
    .select("id, name, servings, prep_minutes, batch_friendly")
    .order("name");

  // recipe_fit es una vista derivada, sin foreign key real hacia
  // recipes: se consulta aparte y se une por recipe_id en vez de
  // depender del embedding automatico de PostgREST. Trae los macros
  // por racion y protein_per_100kcal, ya calculados en Postgres.
  const { data: fit } = await supabase
    .from("recipe_fit")
    .select(
      "recipe_id, kcal_per_serving, protein_per_serving, carbs_per_serving, fat_per_serving, protein_per_100kcal"
    );

  const fitByRecipeId = new Map((fit ?? []).map((m) => [m.recipe_id, m]));

  return (
    <Page>
      <PageHeader
        eyebrow={`${recipes?.length ?? 0} recetas`}
        title="Recetas"
      >
        <Link href="/recetas/nueva" className={btnPrimary}>
          <Plus className="size-4" /> Nueva receta
        </Link>
      </PageHeader>

      {error ? (
        <Alert>{error.message}</Alert>
      ) : recipes && recipes.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {recipes.map((recipe) => {
            const m = fitByRecipeId.get(recipe.id);
            return (
              <Link
                key={recipe.id}
                href={`/recetas/${recipe.id}`}
                className="group flex flex-col rounded-3xl bg-card p-6 transition hover:-translate-y-0.5 hover:bg-track"
              >
                <div className="flex items-start justify-between gap-3">
                  <ChefHat className="size-5 text-muted-foreground transition group-hover:text-lime" />
                  {m?.protein_per_100kcal != null ? (
                    <span
                      className="rounded-full bg-background px-2.5 py-1 font-display text-xs"
                      title="Gramos de proteína por cada 100 kcal"
                    >
                      <span className="text-lime">{decimal(m.protein_per_100kcal)}</span>
                      <span className="text-muted-foreground"> g/100 kcal</span>
                    </span>
                  ) : null}
                </div>
                <h2 className="mt-4 font-display text-lg leading-tight font-semibold">
                  {recipe.name}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {recipe.servings} raciones
                  {recipe.prep_minutes ? ` · ${recipe.prep_minutes} min` : ""}
                  {recipe.batch_friendly ? " · tupper" : ""}
                </p>
                <div className="mt-auto flex items-baseline gap-4 pt-5">
                  <span className="font-display text-2xl font-bold">
                    {num(m?.protein_per_serving)}
                    <span className="text-sm text-muted-foreground">g</span>
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {num(m?.kcal_per_serving)} kcal
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    HC {num(m?.carbs_per_serving)} · G {num(m?.fat_per_serving)}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <Empty>Todavía no hay recetas.</Empty>
      )}
    </Page>
  );
}
