import { Target } from "lucide-react";
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
  Stat,
  btnPrimary,
  inputClass,
} from "@/components/kit";
import { longDay, num, shortDate } from "@/lib/format";
import { setTarget } from "./actions";

export const metadata = { title: "Objetivos" };

const MACRO_FIELDS = [
  { name: "kcal", label: "kcal" },
  { name: "protein_g", label: "Proteína (g)" },
  { name: "fat_g", label: "Grasa (g)" },
  { name: "carbs_g", label: "Carbohidratos (g)" },
] as const;

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
    <Page>
      <PageHeader eyebrow="Nutrición" title="Objetivos" />

      {loadError ? <Alert>{loadError.message}</Alert> : null}

      <section className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="glow-lime rounded-3xl bg-card p-7">
          <p className="eyebrow">Objetivo más reciente</p>
          {current ? (
            <>
              <p className="mt-1 text-sm text-muted-foreground">
                Desde el {longDay(current.effective_from)}
              </p>
              <div className="mt-6 grid grid-cols-2 gap-6 sm:grid-cols-4">
                <Stat label="Proteína" value={num(current.protein_g)} unit="g" tone="lime" />
                <Stat label="Energía" value={num(current.kcal)} unit="kcal" tone="blaze" />
                <Stat label="Carbos" value={num(current.carbs_g)} unit="g" />
                <Stat label="Grasa" value={num(current.fat_g)} unit="g" />
              </div>
              {current.notes ? (
                <p className="mt-6 rounded-2xl bg-background px-4 py-3 text-sm text-muted-foreground">
                  {current.notes}
                </p>
              ) : null}
            </>
          ) : (
            <p className="mt-3 text-muted-foreground">
              Todavía no hay ningún objetivo fijado.
            </p>
          )}
          <p className="mt-6 text-xs text-muted-foreground">
            Los objetivos se aplican por semanas: un plan usa el último objetivo
            fechado en o antes de su lunes.
          </p>
        </div>

        <Panel title="Fijar nuevo objetivo">
          {error ? (
            <div className="mb-4">
              <Alert>{error}</Alert>
            </div>
          ) : null}
          <form action={setTarget} className="space-y-4">
            <Field label="Vigente desde" htmlFor="effective_from">
              <input
                id="effective_from"
                name="effective_from"
                type="date"
                defaultValue={today}
                required
                className={inputClass}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              {MACRO_FIELDS.map((f) => (
                <Field key={f.name} label={f.label} htmlFor={f.name}>
                  <input
                    id={f.name}
                    name={f.name}
                    type="number"
                    step="1"
                    min="1"
                    required
                    placeholder={current ? String(current[f.name]) : undefined}
                    className={inputClass}
                  />
                </Field>
              ))}
            </div>
            <Field label="Notas (opcional)" htmlFor="notes">
              <textarea id="notes" name="notes" rows={2} className={inputClass} />
            </Field>
            <button type="submit" className={`${btnPrimary} w-full`}>
              <Target className="size-4" /> Guardar objetivo
            </button>
          </form>
        </Panel>
      </section>

      <Panel title="Histórico">
        {targets && targets.length > 0 ? (
          <DataTable head={["Desde", "Proteína", "kcal", "Carbos", "Grasa"]}>
            {targets.map((t) => (
              <tr key={t.id}>
                <td>{shortDate(t.effective_from)}</td>
                <td className="text-lime">{num(t.protein_g)} g</td>
                <td>{num(t.kcal)}</td>
                <td>{num(t.carbs_g)} g</td>
                <td>{num(t.fat_g)} g</td>
              </tr>
            ))}
          </DataTable>
        ) : (
          <Empty>Sin histórico todavía.</Empty>
        )}
      </Panel>
    </Page>
  );
}
