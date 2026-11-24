"use client";

import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { Dialog } from "@base-ui/react/dialog";
import {
  AlertTriangle,
  Check,
  Home,
  Loader2,
  Minus,
  Plus,
  Search,
  Utensils,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { decimal, num } from "@/lib/format";
import {
  MealCardBody,
  displayName,
  mealCardClass,
  type MealRecipe,
} from "@/components/MealCard";
import { assignSlot } from "./actions";

// Un hueco del plan: celda compacta que abre un editor en dialogo.
// "use client" por el estado del editor (receta elegida, raciones,
// fuera de casa) antes de enviar. El guardado es la misma Server
// Action assignSlot via <form action>; los macros de cada receta
// vienen ya calculados de recipe_fit y el orden de la lista tambien
// (protein_per_100kcal desc, SQL). Aqui no se calcula nada.
//
// Al guardar, la pagina se revalida y el padre monta la celda con
// una key nueva (incluye receta/raciones/fuera): eso cierra el
// dialogo solo, sin estado extra.

export type RecipeOption = MealRecipe & {
  id: string;
  ppk: number | null;
};

export type SlotCellProps = {
  slotId: string;
  meal: string;
  weekStart: string;
  mealLabel: string;
  dayLabel: string;
  recipe: RecipeOption | null;
  servings: number;
  eatingOut: boolean;
  variantMismatch: boolean;
  recipeVariant: string | null;
  options: RecipeOption[];
};

export function SlotCell(props: SlotCellProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        className={mealCardClass({
          eatingOut: props.eatingOut,
          hasRecipe: props.recipe != null,
        })}
      >
        <MealCardBody data={props} />
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <Dialog.Popup className="fixed inset-x-0 bottom-0 z-50 flex max-h-[88vh] flex-col rounded-t-3xl border-t bg-card shadow-2xl transition duration-200 outline-none data-[ending-style]:translate-y-8 data-[ending-style]:opacity-0 data-[starting-style]:translate-y-8 data-[starting-style]:opacity-0 md:inset-auto md:top-1/2 md:left-1/2 md:w-[34rem] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-3xl md:border md:data-[ending-style]:-translate-y-1/2 md:data-[ending-style]:scale-95 md:data-[starting-style]:-translate-y-1/2 md:data-[starting-style]:scale-95">
          <SlotEditor {...props} />
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function SlotEditor(props: SlotCellProps) {
  const [eatingOut, setEatingOut] = useState(props.eatingOut);
  const [recipeId, setRecipeId] = useState(props.recipe?.id ?? "");
  const [servings, setServings] = useState(props.servings);
  const [query, setQuery] = useState("");

  const dirty =
    eatingOut !== props.eatingOut ||
    recipeId !== (props.recipe?.id ?? "") ||
    servings !== props.servings;

  // Filtro de texto de la lista visible -- presentacion, no ranking:
  // el orden sigue siendo el que llega de recipe_fit.
  const visible = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("es");
    return q
      ? props.options.filter((o) => o.name.toLocaleLowerCase("es").includes(q))
      : props.options;
  }, [props.options, query]);

  return (
    <form action={assignSlot} className="flex min-h-0 flex-1 flex-col">
      <input type="hidden" name="slot_id" value={props.slotId} />
      <input type="hidden" name="week_start" value={props.weekStart} />
      <input type="hidden" name="recipe_id" value={recipeId} />
      <input type="hidden" name="servings" value={servings} />
      {eatingOut ? <input type="hidden" name="eating_out" value="on" /> : null}

      <div className="flex items-start justify-between gap-4 p-6 pb-4">
        <div>
          <Dialog.Title className="font-display text-2xl font-bold">
            {props.mealLabel}
          </Dialog.Title>
          <Dialog.Description className="text-sm text-muted-foreground capitalize">
            {props.dayLabel}
          </Dialog.Description>
        </div>
        <Dialog.Close
          aria-label="Cerrar"
          className="grid size-9 place-items-center rounded-full text-muted-foreground transition hover:bg-track hover:text-foreground"
        >
          <X className="size-4" />
        </Dialog.Close>
      </div>

      <div className="px-6">
        <div
          role="radiogroup"
          aria-label="Dónde comes"
          className="grid grid-cols-2 gap-1 rounded-full bg-background p-1"
        >
          {[
            { value: false, label: "En casa", icon: Home },
            { value: true, label: "Fuera de casa", icon: Utensils },
          ].map((opt) => {
            const active = eatingOut === opt.value;
            const Icon = opt.icon;
            return (
              <button
                key={opt.label}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setEatingOut(opt.value)}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-full py-2.5 font-display text-sm font-semibold transition",
                  active
                    ? "bg-lime text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="size-4" />
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {eatingOut ? (
        <p className="mx-6 mt-5 rounded-2xl bg-background p-5 text-sm text-muted-foreground">
          Este hueco no suma al total del día ni a la lista de la compra.
        </p>
      ) : (
        <>
          <div className="relative mx-6 mt-5">
            <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar receta…"
              aria-label="Buscar receta"
              className="w-full rounded-full border border-input bg-background py-2.5 pr-4 pl-11 text-sm outline-none focus-visible:border-lime focus-visible:ring-2 focus-visible:ring-lime/30"
            />
          </div>

          <div
            role="radiogroup"
            aria-label="Receta"
            className="mt-3 min-h-0 flex-1 space-y-1.5 overflow-y-auto px-6 py-1"
          >
            <RecipeRow
              selected={recipeId === ""}
              onSelect={() => setRecipeId("")}
              name="Sin asignar"
              muted
            />
            {visible.map((o) => (
              <RecipeRow
                key={o.id}
                selected={recipeId === o.id}
                onSelect={() => setRecipeId(o.id)}
                name={displayName(o.name, props.mealLabel)}
                protein={o.protein}
                kcal={o.kcal}
                ppk={o.ppk}
              />
            ))}
            {visible.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Ninguna receta coincide.
              </p>
            ) : null}
          </div>

          <div className="mx-6 mt-4 flex items-center justify-between rounded-2xl bg-background px-4 py-3">
            <span className="text-sm text-muted-foreground">Raciones</span>
            <div className="flex items-center gap-1">
              <StepButton
                label="Quitar media ración"
                disabled={servings <= 0.5}
                onClick={() => setServings((s) => Math.max(0.5, s - 0.5))}
              >
                <Minus className="size-4" />
              </StepButton>
              <span className="w-12 text-center font-display text-lg font-semibold tabular-nums">
                {decimal(servings)}
              </span>
              <StepButton
                label="Añadir media ración"
                onClick={() => setServings((s) => s + 0.5)}
              >
                <Plus className="size-4" />
              </StepButton>
            </div>
          </div>
        </>
      )}

      {props.variantMismatch ? (
        <p className="mx-6 mt-4 flex items-start gap-2 text-xs text-blaze">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          La receta actual es la variante &quot;{props.recipeVariant}&quot;; revisa
          si toca ese día.
        </p>
      ) : null}

      <div className="mt-5 flex items-center justify-end gap-2 border-t p-4 md:px-6">
        <Dialog.Close className="rounded-full px-4 py-2.5 font-display text-sm text-muted-foreground transition hover:bg-track hover:text-foreground">
          Cancelar
        </Dialog.Close>
        <SaveButton disabled={!dirty} />
      </div>
    </form>
  );
}

function RecipeRow({
  selected,
  onSelect,
  name,
  protein,
  kcal,
  ppk,
  muted,
}: {
  selected: boolean;
  onSelect: () => void;
  name: string;
  protein?: number | null;
  kcal?: number | null;
  ppk?: number | null;
  muted?: boolean;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition",
        selected
          ? "bg-lime text-primary-foreground"
          : "bg-background hover:bg-track"
      )}
    >
      <span
        className={cn(
          "grid size-5 shrink-0 place-items-center rounded-full border-2",
          selected ? "border-primary-foreground bg-primary-foreground" : "border-white/20"
        )}
      >
        {selected ? <Check className="size-3 text-lime" strokeWidth={3} /> : null}
      </span>
      <span
        className={cn(
          "min-w-0 flex-1 text-sm font-medium",
          muted && !selected && "text-muted-foreground"
        )}
      >
        {name}
      </span>
      {protein !== undefined ? (
        <span
          className={cn(
            "shrink-0 text-right font-display text-xs leading-tight",
            selected ? "text-primary-foreground/80" : "text-muted-foreground"
          )}
        >
          <span className={selected ? "font-bold text-primary-foreground" : "text-lime"}>
            {num(protein)} g
          </span>{" "}
          · {num(kcal)} kcal
          {ppk != null ? <span className="block">{decimal(ppk)} g/100 kcal</span> : null}
        </span>
      ) : null}
    </button>
  );
}

function StepButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="grid size-9 place-items-center rounded-full bg-card transition hover:bg-track disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function SaveButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="inline-flex items-center gap-2 rounded-full bg-lime px-5 py-2.5 font-display text-sm font-bold text-primary-foreground transition hover:brightness-105 disabled:opacity-40"
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
      {pending ? "Guardando" : "Guardar"}
    </button>
  );
}
