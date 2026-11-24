import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { num } from "@/lib/format";

// Chip de estado y barras de macros de un dia, compartidos por Hoy y
// /semana. Solo pintan totales y gaps que ya vienen de
// plan_day_totals (SQL).

export type DayStatusTotals = {
  emptySlots: number;
  mealsOut: number;
  onTarget: boolean;
  // Algun ingrediente sin macros: el total del dia es NULL, no 0 ni "corto".
  macrosIncomplete: boolean;
  proteinGap: number;
  kcalGap: number;
};

// Estado del dia en una sola etiqueta. Si hay huecos o comidas fuera
// el total no es el real y se dice eso primero, antes que un "faltan
// X kcal" que confundiria.
export function DayStatus({ totals }: { totals: DayStatusTotals }) {
  let label: string;
  let tone: "ok" | "warn" | "muted";
  if (totals.macrosIncomplete) {
    label = "Macros incompletos";
    tone = "muted";
  } else if (totals.emptySlots > 0) {
    label = `${totals.emptySlots} hueco${totals.emptySlots > 1 ? "s" : ""}`;
    tone = "muted";
  } else if (totals.mealsOut > 0) {
    label = `${totals.mealsOut} fuera`;
    tone = "muted";
  } else if (totals.onTarget) {
    label = "En objetivo";
    tone = "ok";
  } else if (totals.proteinGap < 0) {
    label = `Faltan ${num(-totals.proteinGap)} g`;
    tone = "warn";
  } else {
    label = `Faltan ${num(-totals.kcalGap)} kcal`;
    tone = "warn";
  }
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1 font-display text-xs font-semibold",
        tone === "ok" && "bg-lime text-primary-foreground",
        tone === "warn" && "bg-blaze/15 text-blaze",
        tone === "muted" && "bg-track text-muted-foreground"
      )}
    >
      {tone === "ok" ? <Check className="size-3.5" strokeWidth={3} /> : null}
      {label}
    </span>
  );
}

export function MacroRow({
  label,
  value,
  target,
  unit,
  bar,
  text,
}: {
  label: string;
  value: number | null;
  target: number | null;
  unit: string;
  bar: string;
  text: string;
}) {
  const pct = value != null && target ? Math.min(100, (value / target) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-xs 2xl:text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-display tabular-nums">
          <span className={text}>{num(value)}</span>
          {target ? (
            <span className="text-muted-foreground">
              /{num(target)}
              {unit ? ` ${unit}` : ""}
            </span>
          ) : (
            <span className="text-muted-foreground">{unit ? ` ${unit}` : ""}</span>
          )}
        </span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-track">
        <div className={cn("h-full rounded-full transition-[width] duration-700", bar)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
