import Link from "next/link";
import { cn } from "@/lib/utils";

// Barras de la semana: altura = kcal del dia / objetivo, ya
// calculados por plan_day_totals. La linea discontinua marca el 100 %
// del objetivo. El tooltip va por CSS (group-hover), sin JS, y el
// dato tambien esta en aria-label para quien no usa raton.

export type WeekBarDay = {
  date: string;
  label: string;
  href: string;
  kcal: number | null;
  targetKcal: number | null;
  protein: number | null;
  isToday: boolean;
  hasCaveat: boolean;
};

// La barra al 100 % ocupa el 80 % del alto; deja aire para dias por
// encima del objetivo sin que se salgan.
const FULL_PCT = 80;

export function WeekBars({
  days,
  heightClass = "h-36",
}: {
  days: WeekBarDay[];
  heightClass?: string;
}) {
  return (
    <div>
      <div className={cn("relative grid grid-cols-7 items-end gap-2 sm:gap-3", heightClass)}>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 border-t border-dashed border-white/15"
          style={{ bottom: `${FULL_PCT}%` }}
        />
        {days.map((d, i) => {
          const ratio =
            d.kcal != null && d.targetKcal
              ? Math.min(1.2, d.kcal / d.targetKcal)
              : 0;
          return (
            <Link
              key={d.date}
              href={d.href}
              className="group relative flex h-full items-end"
              aria-label={
                d.kcal != null
                  ? `${d.label}: ${d.kcal} kcal, ${d.protein ?? "—"} g de proteína`
                  : `${d.label}: sin datos`
              }
            >
              <span className="pointer-events-none absolute -top-3 left-1/2 z-10 -translate-x-1/2 rounded-full bg-foreground px-2.5 py-0.5 font-display text-xs font-semibold whitespace-nowrap text-background opacity-0 transition group-hover:-translate-y-1 group-hover:opacity-100">
                {d.kcal != null
                  ? `${d.kcal} kcal · ${d.protein ?? "—"} g`
                  : "sin datos"}
              </span>
              <div
                className={cn(
                  "bar-grow w-full rounded-xl transition-[filter] group-hover:brightness-125",
                  d.isToday
                    ? "bg-lime"
                    : d.hasCaveat
                      ? "bg-track"
                      : "bg-lime/40"
                )}
                style={{
                  height: `${Math.max(ratio * FULL_PCT, 3)}%`,
                  animationDelay: `${i * 60}ms`,
                }}
              />
            </Link>
          );
        })}
      </div>
      <div className="mt-2 grid grid-cols-7 gap-2 text-center sm:gap-3">
        {days.map((d) => (
          <span
            key={d.date}
            className={cn(
              "font-display text-xs",
              d.isToday ? "text-lime" : "text-muted-foreground"
            )}
          >
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}
