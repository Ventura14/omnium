import { createClient } from "@/lib/supabase/server";
import { addFood } from "./actions";

export default async function FoodsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();

  const { data: foods, error: loadError } = await supabase
    .from("foods")
    .select("id, name, kcal_100g, protein_100g")
    .order("name");

  return (
    <main className="mx-auto max-w-2xl space-y-10 p-6">
      <section>
        <h1 className="mb-4 text-xl font-semibold">Alimentos</h1>

        {loadError ? (
          <p className="text-sm text-red-600">{loadError.message}</p>
        ) : foods && foods.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2">Nombre</th>
                <th className="py-2">kcal / 100g</th>
                <th className="py-2">Proteína / 100g</th>
              </tr>
            </thead>
            <tbody>
              {foods.map((food) => (
                <tr key={food.id} className="border-b">
                  <td className="py-2">{food.name}</td>
                  <td className="py-2">{food.kcal_100g}</td>
                  <td className="py-2">{food.protein_100g} g</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-gray-500">Todavía no hay alimentos.</p>
        )}
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">Añadir alimento</h2>

        {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}

        <form action={addFood} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="name" className="block text-sm font-medium">
              Nombre
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              className="w-full rounded border px-3 py-2"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label htmlFor="kcal_100g" className="block text-sm font-medium">
                kcal / 100g
              </label>
              <input
                id="kcal_100g"
                name="kcal_100g"
                type="number"
                step="0.01"
                min="0"
                required
                className="w-full rounded border px-3 py-2"
              />
            </div>

            <div className="space-y-1">
              <label
                htmlFor="protein_100g"
                className="block text-sm font-medium"
              >
                Proteína / 100g
              </label>
              <input
                id="protein_100g"
                name="protein_100g"
                type="number"
                step="0.01"
                min="0"
                required
                className="w-full rounded border px-3 py-2"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="carbs_100g" className="block text-sm font-medium">
                Carbohidratos / 100g
              </label>
              <input
                id="carbs_100g"
                name="carbs_100g"
                type="number"
                step="0.01"
                min="0"
                required
                className="w-full rounded border px-3 py-2"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="fat_100g" className="block text-sm font-medium">
                Grasa / 100g
              </label>
              <input
                id="fat_100g"
                name="fat_100g"
                type="number"
                step="0.01"
                min="0"
                required
                className="w-full rounded border px-3 py-2"
              />
            </div>
          </div>

          <button
            type="submit"
            className="rounded bg-black px-4 py-2 text-white"
          >
            Añadir
          </button>
        </form>
      </section>
    </main>
  );
}
