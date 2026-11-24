import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatWeekRange } from "@/lib/dates";

// Cabecera de navegacion de semana, compartida por /semana y /compra
// -- mismo patron. Chevrons discretos en vez de "semana
// anterior"/"semana siguiente" en texto, y la fecha en espanol
// legible, nunca ISO.
export function WeekNav({
  basePath,
  title,
  weekStart,
  defaultWeekStart,
  prevWeek,
  nextWeek,
}: {
  basePath: string;
  title: string;
  weekStart: string;
  defaultWeekStart: string;
  prevWeek: string;
  nextWeek: string;
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="font-display text-2xl leading-tight font-bold md:text-3xl">
          {title}
        </h1>
        <p className="eyebrow">{formatWeekRange(weekStart)}</p>
      </div>
      <div className="flex items-center gap-1 rounded-full bg-card p-1">
        <Link
          href={`${basePath}?week=${prevWeek}`}
          aria-label="Semana anterior"
          className="grid size-9 place-items-center rounded-full text-muted-foreground transition hover:bg-track hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
        </Link>
        {weekStart !== defaultWeekStart ? (
          <Link
            href={basePath}
            className="rounded-full px-3 py-1.5 font-display text-xs text-lime transition hover:bg-track"
          >
            Volver al plan actual
          </Link>
        ) : null}
        <Link
          href={`${basePath}?week=${nextWeek}`}
          aria-label="Semana siguiente"
          className="grid size-9 place-items-center rounded-full text-muted-foreground transition hover:bg-track hover:text-foreground"
        >
          <ChevronRight className="size-4" />
        </Link>
      </div>
    </header>
  );
}
