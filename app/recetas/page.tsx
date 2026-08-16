import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function RecetasPage() {
  const supabase = await createClient();

  const { data: recipes, error } = await supabase
    .from("recipes")
    .select("id, name, servings")
    .order("name");

  // recipe_macros es una vista derivada, sin foreign key real hacia
  // recipes: se consulta aparte y se une por recipe_id en vez de
  // depender del embedding automatico de PostgREST.
  const { data: macros } = await supabase
    .from("recipe_macros")
    .select("recipe_id, kcal_per_serving, protein_per_serving");

  const macrosByRecipeId = new Map(
    (macros ?? []).map((m) => [m.recipe_id, m])
  );

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Recetas</h1>
        <Link
          href="/recetas/nueva"
          className="rounded bg-black px-4 py-2 text-sm text-white"
        >
          Nueva receta
        </Link>
      </div>

      {error ? (
        <p className="text-sm text-red-600">{error.message}</p>
      ) : recipes && recipes.length > 0 ? (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="py-2">Nombre</th>
              <th className="py-2">Raciones</th>
              <th className="py-2">kcal/ración</th>
              <th className="py-2">Proteína/ración</th>
            </tr>
          </thead>
          <tbody>
            {recipes.map((recipe) => {
              const recipeMacros = macrosByRecipeId.get(recipe.id);
              return (
                <tr key={recipe.id} className="border-b">
                  <td className="py-2">
                    <Link href={`/recetas/${recipe.id}`} className="underline">
                      {recipe.name}
                    </Link>
                  </td>
                  <td className="py-2">{recipe.servings}</td>
                  <td className="py-2">{recipeMacros?.kcal_per_serving ?? "—"}</td>
                  <td className="py-2">
                    {recipeMacros?.protein_per_serving != null
                      ? `${recipeMacros.protein_per_serving} g`
                      : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <p className="text-sm text-gray-500">Todavía no hay recetas.</p>
      )}
    </main>
  );
}
