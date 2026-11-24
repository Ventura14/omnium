import {
  Apple,
  Briefcase,
  Coffee,
  Home,
  Moon,
  Pencil,
  Plus,
  Sun,
  Utensils,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { decimal, num } from "@/lib/format";

// Tarjeta de una comida del plan, compartida por /semana (abre el
// editor) y por Hoy (enlaza a la semana). Solo marcado: los macros
// llegan ya calculados de recipe_fit. El contenedor (boton, enlace...)
// lo pone quien la usa, con mealCardClass().

export type MealRecipe = {
  name: string;
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  variant: string | null;
};

export type MealCardData = {
  meal: string;
  mealLabel: string;
  recipe: MealRecipe | null;
  servings: number;
  eatingOut: boolean;
  variantMismatch: boolean;
  recipeVariant: string | null;
};

// Las recetas de ingesta fija llevan la comida en el nombre ("Media
// mañana oficina: bocadillo..."). La tarjeta ya dice que comida es,
// asi que se quita ese prefijo solo al pintar -- el nombre real en
// la base no cambia.
export function displayName(name: string, mealLabel: string): string {
  const colon = name.indexOf(":");
  if (colon === -1) return name;
  const prefix = name.slice(0, colon).toLocaleLowerCase("es");
  if (!prefix.startsWith(mealLabel.toLocaleLowerCase("es"))) return name;
  const rest = name.slice(colon + 1).trim();
  return rest.charAt(0).toLocaleUpperCase("es") + rest.slice(1);
}

export function mealCardClass({
  eatingOut,
  hasRecipe,
}: {
  eatingOut: boolean;
  hasRecipe: boolean;
}) {
  return cn(
    "group relative isolate flex h-full min-h-40 w-full flex-col overflow-hidden rounded-3xl p-4 pb-5 text-left transition duration-200 outline-none focus-visible:ring-2 focus-visible:ring-lime/60 xl:p-6 xl:pb-7",
    eatingOut
      ? "border border-dashed border-white/15 hover:border-white/30"
      : hasRecipe
        ? "bg-gradient-to-br from-card via-card to-lime/[0.07] ring-1 ring-white/5 hover:-translate-y-0.5 hover:ring-lime/40"
        : "border border-dashed border-lime/30 hover:border-lime/60 hover:bg-lime/5"
  );
}

const MEAL_ICONS: Record<string, typeof Sun> = {
  breakfast: Coffee,
  midmorning: Coffee,
  lunch: Sun,
  snack: Apple,
  dinner: Moon,
};

export function MealIcon({
  meal,
  className,
  strokeWidth,
}: {
  meal: string;
  className?: string;
  strokeWidth?: number;
}) {
  const Icon = MEAL_ICONS[meal] ?? Utensils;
  return <Icon className={className} strokeWidth={strokeWidth} aria-hidden="true" />;
}

export function MealCardBody({
  data,
  emptyLabel = "Elegir receta",
}: {
  data: MealCardData;
  emptyLabel?: string;
}) {
  const { meal, mealLabel, recipe, servings, eatingOut, variantMismatch, recipeVariant } =
    data;
  return (
    <>
      {recipe && !eatingOut ? (
        <MealIcon
          meal={meal}
          className="pointer-events-none absolute -right-5 -bottom-5 -z-10 size-28 text-lime/[0.06] transition duration-500 group-hover:scale-110 group-hover:text-lime/10 xl:size-40 2xl:size-52"
          strokeWidth={1.2}
        />
      ) : null}

      <span className="flex items-center gap-3">
        <span
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-full",
            eatingOut || !recipe
              ? "bg-track text-muted-foreground"
              : "bg-lime/15 text-lime"
          )}
        >
          <MealIcon meal={meal} className="size-4" />
        </span>
        <span className="font-display text-sm font-semibold text-muted-foreground">
          {mealLabel}
        </span>
        <span className="ml-auto flex items-center gap-1.5">
          {recipe?.variant === "oficina" && !eatingOut ? (
            <span
              title={
                variantMismatch
                  ? "Variante de oficina en un día de casa: revisa si toca."
                  : undefined
              }
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-display text-[11px] font-semibold tracking-wide uppercase",
                variantMismatch
                  ? "bg-blaze/15 text-blaze"
                  : "bg-white/10 text-foreground/80"
              )}
            >
              <Briefcase className="size-3" /> Oficina
            </span>
          ) : variantMismatch ? (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-blaze/15 px-2.5 py-1 font-display text-[11px] font-semibold tracking-wide text-blaze uppercase"
              title={`Es la variante "${recipeVariant}"; revisa si toca ese día.`}
            >
              <Home className="size-3" /> Casa
            </span>
          ) : null}
          <Pencil className="size-4 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
        </span>
      </span>

      {eatingOut ? (
        <span className="mt-3 flex flex-1 flex-col justify-end gap-1">
          <span className="font-display text-lg font-semibold text-muted-foreground">
            Fuera de casa
          </span>
          <span className="text-sm text-muted-foreground/70">
            No cuenta en el total
          </span>
        </span>
      ) : recipe ? (
        <>
          <span className="mt-3 line-clamp-2 font-display text-lg leading-snug font-semibold xl:mt-4 xl:text-xl 2xl:text-2xl">
            {displayName(recipe.name, mealLabel)}
          </span>
          <span className="mt-auto flex items-end justify-between gap-3 pt-4">
            <span className="font-display text-3xl leading-none font-bold text-lime tabular-nums xl:text-4xl 2xl:text-5xl">
              {num(recipe.protein)}
              <span className="ml-0.5 text-base text-lime/60 2xl:text-xl">g</span>
            </span>
            <span className="flex flex-col items-end gap-1">
              <span className="flex items-center gap-1.5">
                {servings !== 1 ? (
                  <span className="rounded-full bg-lime/15 px-2 py-0.5 font-display text-xs text-lime">
                    ×{decimal(servings)}
                  </span>
                ) : null}
                <span className="rounded-full bg-background/80 px-2 py-0.5 font-display text-xs text-muted-foreground tabular-nums">
                  {num(recipe.kcal)} kcal
                </span>
              </span>
              {recipe.carbs != null && recipe.fat != null ? (
                <span className="font-display text-[11px] text-muted-foreground tabular-nums">
                  HC {num(recipe.carbs)} · G {num(recipe.fat)}
                </span>
              ) : null}
            </span>
          </span>
          <MacroSplit protein={recipe.protein} carbs={recipe.carbs} fat={recipe.fat} />
        </>
      ) : (
        <span className="mt-3 flex flex-1 items-end">
          <span className="inline-flex items-center gap-2 rounded-full bg-lime/10 px-4 py-2 font-display text-sm font-semibold text-lime transition group-hover:bg-lime group-hover:text-primary-foreground">
            <Plus className="size-4" /> {emptyLabel}
          </span>
        </span>
      )}
    </>
  );
}

// Reparto en gramos de proteina / carbohidratos / grasa por racion,
// tal como llegan de recipe_fit. Las anchuras son proporcion de
// gramos para pintar la barra, no un calculo nutricional.
function MacroSplit({
  protein,
  carbs,
  fat,
}: {
  protein: number | null;
  carbs: number | null;
  fat: number | null;
}) {
  if (protein == null || carbs == null || fat == null) return null;
  const total = protein + carbs + fat;
  if (total <= 0) return null;
  return (
    <span
      className="absolute inset-x-0 bottom-0 flex h-1 gap-px"
      title={`Proteína ${num(protein)} g · HC ${num(carbs)} g · Grasa ${num(fat)} g`}
    >
      <span className="bg-lime" style={{ width: `${(protein / total) * 100}%` }} />
      <span className="bg-white/40" style={{ width: `${(carbs / total) * 100}%` }} />
      <span className="bg-white/20" style={{ width: `${(fat / total) * 100}%` }} />
    </span>
  );
}
