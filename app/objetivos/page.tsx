import { createClient } from "@/lib/supabase/server";
import { todayInMadrid } from "@/lib/dates";
import { setTarget } from "./actions";

export default async function ObjetivosPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();

  const { data: targets, error: loadError } = await supabase
    .from("nutrition_targets")
    .select("id, effective_from, kcal, protein_g, fat_g, carbs_g, notes")
    .order("effective_from", { ascending: false });

  const current = targets?.[0];
  const today = todayInMadrid();

  return (
    <main className="mx-auto max-w-2xl space-y-10 p-6">
      <section>
        <h1 className="mb-4 text-xl font-semibold">Objetivo vigente</h1>

        {loadError ? (
          <p className="text-sm text-red-600">{loadError.message}</p>
        ) : current ? (
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-gray-500">Desde</dt>
              <dd>{current.effective_from}</dd>
            </div>
            <div>
              <dt className="text-gray-500">kcal</dt>
              <dd>{current.kcal}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Proteína</dt>
              <dd>{current.protein_g} g</dd>
            </div>
            <div>
              <dt className="text-gray-500">Grasa</dt>
              <dd>{current.fat_g} g</dd>
            </div>
            <div>
              <dt className="text-gray-500">Carbohidratos</dt>
              <dd>{current.carbs_g} g</dd>
            </div>
            {current.notes ? (
              <div className="col-span-full">
                <dt className="text-gray-500">Notas</dt>
                <dd>{current.notes}</dd>
              </div>
            ) : null}
          </dl>
        ) : (
          <p className="text-sm text-gray-500">Todavía no hay ningún objetivo fijado.</p>
        )}
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">Fijar nuevo objetivo</h2>

        {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}

        <form action={setTarget} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="effective_from" className="block text-sm font-medium">
              Vigente desde
            </label>
            <input
              id="effective_from"
              name="effective_from"
              type="date"
              defaultValue={today}
              required
              className="w-full rounded border px-3 py-2"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label htmlFor="kcal" className="block text-sm font-medium">
                kcal
              </label>
              <input
                id="kcal"
                name="kcal"
                type="number"
                step="1"
                min="1"
                required
                className="w-full rounded border px-3 py-2"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="protein_g" className="block text-sm font-medium">
                Proteína (g)
              </label>
              <input
                id="protein_g"
                name="protein_g"
                type="number"
                step="1"
                min="1"
                required
                className="w-full rounded border px-3 py-2"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="fat_g" className="block text-sm font-medium">
                Grasa (g)
              </label>
              <input
                id="fat_g"
                name="fat_g"
                type="number"
                step="1"
                min="1"
                required
                className="w-full rounded border px-3 py-2"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="carbs_g" className="block text-sm font-medium">
                Carbohidratos (g)
              </label>
              <input
                id="carbs_g"
                name="carbs_g"
                type="number"
                step="1"
                min="1"
                required
                className="w-full rounded border px-3 py-2"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="notes" className="block text-sm font-medium">
              Notas (opcional)
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={2}
              className="w-full rounded border px-3 py-2"
            />
          </div>

          <button
            type="submit"
            className="rounded bg-black px-4 py-2 text-white"
          >
            Guardar
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">Histórico</h2>

        {targets && targets.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2">Desde</th>
                <th className="py-2">kcal</th>
                <th className="py-2">Proteína</th>
                <th className="py-2">Grasa</th>
                <th className="py-2">Carbohidratos</th>
              </tr>
            </thead>
            <tbody>
              {targets.map((target) => (
                <tr key={target.id} className="border-b">
                  <td className="py-2">{target.effective_from}</td>
                  <td className="py-2">{target.kcal}</td>
                  <td className="py-2">{target.protein_g} g</td>
                  <td className="py-2">{target.fat_g} g</td>
                  <td className="py-2">{target.carbs_g} g</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-gray-500">Sin histórico todavía.</p>
        )}
      </section>
    </main>
  );
}
