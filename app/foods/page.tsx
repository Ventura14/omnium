import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  Alert,
  DataTable,
  Empty,
  Field,
  Page,
  PageHeader,
  Panel,
  btnPrimary,
  btnSecondary,
  inputClass,
} from "@/components/kit";
import { decimal, num } from "@/lib/format";
import { addFood } from "./actions";

export const metadata = { title: "Alimentos" };

const MACRO_FIELDS = [
  { name: "kcal_100g", label: "kcal / 100 g" },
  { name: "protein_100g", label: "Proteína / 100 g" },
  { name: "carbs_100g", label: "Carbohidratos / 100 g" },
  { name: "fat_100g", label: "Grasa / 100 g" },
] as const;

type FoodRow = {
  id: string;
  name: string;
  kcal_100g: number | null;
  protein_100g: number | null;
  carbs_100g: number | null;
  fat_100g: number | null;
};

export default async function FoodsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; q?: string }>;
}) {
  const { error, q } = await searchParams;
  const query = q?.trim() ?? "";
  const supabase = await createClient();

  // Con texto, la busqueda la hace search_foods en Postgres (sin
  // acentos, mismo criterio que el buscador de recetas). Sin texto,
  // la lista completa por nombre.
  const { data: foods, error: loadError } = query
    ? await supabase.rpc("search_foods", { query }).returns<FoodRow[]>()
    : await supabase
        .from("foods")
        .select("id, name, kcal_100g, protein_100g, carbs_100g, fat_100g")
        .order("name")
        .returns<FoodRow[]>();

  return (
    <Page>
      <PageHeader eyebrow={`${foods?.length ?? 0} alimentos`} title="Alimentos" />

      <section className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <Panel>
          <form className="mb-5 flex gap-2" role="search">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                name="q"
                defaultValue={query}
                placeholder="Buscar: pollo, arroz, lenteja…"
                aria-label="Buscar alimento"
                className={`${inputClass} pl-11`}
              />
            </div>
            <button type="submit" className={btnSecondary}>
              Buscar
            </button>
            {query ? (
              <Link href="/foods" className={btnSecondary}>
                Limpiar
              </Link>
            ) : null}
          </form>

          {loadError ? (
            <Alert>{loadError.message}</Alert>
          ) : foods && foods.length > 0 ? (
            <DataTable head={["Nombre", "kcal", "Prot.", "HC", "Grasa"]}>
              {foods.map((food) => (
                <tr key={food.id}>
                  <td className="max-w-xs">{food.name}</td>
                  <td>{num(food.kcal_100g)}</td>
                  <td className="text-lime">{decimal(food.protein_100g)}</td>
                  <td>{decimal(food.carbs_100g)}</td>
                  <td>{decimal(food.fat_100g)}</td>
                </tr>
              ))}
            </DataTable>
          ) : (
            <Empty>
              {query ? `Nada coincide con “${query}”.` : "Todavía no hay alimentos."}
            </Empty>
          )}
          <p className="mt-4 text-xs text-muted-foreground">
            Valores por 100 g de alimento crudo o seco.
          </p>
        </Panel>

        <div className="lg:sticky lg:top-5 lg:self-start">
          <Panel title="Añadir alimento">
            {error ? (
              <div className="mb-4">
                <Alert>{error}</Alert>
              </div>
            ) : null}
            <form action={addFood} className="space-y-4">
              <Field label="Nombre" htmlFor="name">
                <input id="name" name="name" type="text" required className={inputClass} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                {MACRO_FIELDS.map((f) => (
                  <Field key={f.name} label={f.label} htmlFor={f.name}>
                    <input
                      id={f.name}
                      name={f.name}
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      className={inputClass}
                    />
                  </Field>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Siempre en crudo o seco y por 100 g, copiado de la etiqueta o de
                BEDCA. Nunca valores inventados.
              </p>
              <button type="submit" className={`${btnPrimary} w-full`}>
                <Plus className="size-4" /> Añadir
              </button>
            </form>
          </Panel>
        </div>
      </section>
    </Page>
  );
}
