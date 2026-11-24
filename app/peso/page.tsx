import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { todayInMadrid } from "@/lib/dates";
import {
  Alert,
  DataTable,
  Empty,
  Field,
  Page,
  PageHeader,
  Panel,
  btnPrimary,
  inputClass,
} from "@/components/kit";
import { Sparkline } from "@/components/Sparkline";
import { decimal, longDay, shortDate } from "@/lib/format";
import { logWeight } from "./actions";

export const metadata = { title: "Progreso" };

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
  const withWeight = (metrics ?? []).filter((m) => m.weight_kg != null);
  const series = withWeight
    .slice()
    .reverse()
    .map((m) => m.weight_kg as number);
  const latest = withWeight[0];
  const oldest = withWeight[withWeight.length - 1];
  // Diferencia entre dos registros para mostrarla, no una metrica
  // derivada: no se interpreta ni se juzga si es buena o mala.
  const change =
    latest && oldest && latest !== oldest
      ? (latest.weight_kg as number) - (oldest.weight_kg as number)
      : null;

  return (
    <Page>
      <PageHeader eyebrow="Peso corporal" title="Progreso" />

      <section className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="glow-lime rounded-3xl bg-card p-7">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="eyebrow">Último registro</p>
              <p className="mt-2 font-display text-6xl font-bold tabular-nums">
                {latest ? decimal(latest.weight_kg) : "—"}
                <span className="text-2xl text-muted-foreground"> kg</span>
              </p>
              {latest ? (
                <p className="mt-1 text-sm text-muted-foreground capitalize">
                  {longDay(latest.measured_on)}
                </p>
              ) : null}
            </div>
            {change != null ? (
              <div className="rounded-2xl bg-background px-4 py-3 text-right">
                <p className="font-display text-2xl font-bold text-lime tabular-nums">
                  {change > 0 ? "+" : ""}
                  {decimal(change)} kg
                </p>
                <p className="text-xs text-muted-foreground">
                  desde {shortDate(oldest!.measured_on)}
                </p>
              </div>
            ) : null}
          </div>

          {series.length > 1 ? (
            <div className="mt-8">
              <Sparkline values={series} className="h-40 w-full" strokeWidth={3} />
              <div className="mt-2 flex justify-between font-display text-xs text-muted-foreground">
                <span>{shortDate(oldest!.measured_on)}</span>
                <span>{shortDate(latest!.measured_on)}</span>
              </div>
            </div>
          ) : (
            <p className="mt-8 text-sm text-muted-foreground">
              Con dos registros o más aparece aquí la evolución.
            </p>
          )}
        </div>

        <Panel title="Registrar peso">
          {error ? (
            <div className="mb-4">
              <Alert>{error}</Alert>
            </div>
          ) : null}
          <form action={logWeight} className="space-y-4">
            <Field label="Fecha" htmlFor="measured_on">
              <input
                id="measured_on"
                name="measured_on"
                type="date"
                defaultValue={today}
                required
                className={inputClass}
              />
            </Field>
            <Field label="Peso (kg)" htmlFor="weight_kg">
              <input
                id="weight_kg"
                name="weight_kg"
                type="number"
                step="0.01"
                min="0"
                required
                inputMode="decimal"
                placeholder={latest ? String(latest.weight_kg) : "75.0"}
                className={`${inputClass} font-display text-2xl`}
              />
            </Field>
            <button type="submit" className={`${btnPrimary} w-full`}>
              <Plus className="size-4" /> Guardar
            </button>
          </form>
        </Panel>
      </section>

      <Panel title="Últimos 30 registros">
        {loadError ? (
          <Alert>{loadError.message}</Alert>
        ) : metrics && metrics.length > 0 ? (
          <DataTable head={["Fecha", "Peso"]}>
            {metrics.map((entry) => (
              <tr key={entry.id}>
                <td className="capitalize">{longDay(entry.measured_on)}</td>
                <td className="font-display">
                  {entry.weight_kg != null ? `${decimal(entry.weight_kg)} kg` : "—"}
                </td>
              </tr>
            ))}
          </DataTable>
        ) : (
          <Empty>Todavía no hay registros.</Empty>
        )}
      </Panel>
    </Page>
  );
}
