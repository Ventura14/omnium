import { createClient } from "@/lib/supabase/server";
import { todayInMadrid } from "@/lib/dates";
import { logWeight } from "./actions";

export default async function PesoPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();

  const { data: metrics, error: loadError } = await supabase
    .from("body_metrics")
    .select("id, measured_on, weight_kg")
    .order("measured_on", { ascending: false })
    .limit(30);

  const today = todayInMadrid();

  return (
    <main className="mx-auto max-w-2xl space-y-10 p-6">
      <section>
        <h1 className="mb-4 text-xl font-semibold">Registrar peso</h1>

        {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}

        <form action={logWeight} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label htmlFor="measured_on" className="block text-sm font-medium">
                Fecha
              </label>
              <input
                id="measured_on"
                name="measured_on"
                type="date"
                defaultValue={today}
                required
                className="w-full rounded border px-3 py-2"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="weight_kg" className="block text-sm font-medium">
                Peso (kg)
              </label>
              <input
                id="weight_kg"
                name="weight_kg"
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
            Guardar
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">Últimos 30 registros</h2>

        {loadError ? (
          <p className="text-sm text-red-600">{loadError.message}</p>
        ) : metrics && metrics.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2">Fecha</th>
                <th className="py-2">Peso</th>
              </tr>
            </thead>
            <tbody>
              {metrics.map((entry) => (
                <tr key={entry.id} className="border-b">
                  <td className="py-2">{entry.measured_on}</td>
                  <td className="py-2">{entry.weight_kg} kg</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-gray-500">Todavía no hay registros.</p>
        )}
      </section>
    </main>
  );
}
