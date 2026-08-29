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
    <div className="flex items-center justify-between">
      <h1 className="text-xl font-semibold">{title}</h1>
      <div className="flex items-center gap-2 text-sm">
        <a
          href={`${basePath}?week=${prevWeek}`}
          aria-label="Semana anterior"
          className="px-1 text-lg text-muted-foreground hover:text-foreground"
        >
          ‹
        </a>
        <span className="text-muted-foreground">
          {formatWeekRange(weekStart)}
        </span>
        <a
          href={`${basePath}?week=${nextWeek}`}
          aria-label="Semana siguiente"
          className="px-1 text-lg text-muted-foreground hover:text-foreground"
        >
          ›
        </a>
        {weekStart !== defaultWeekStart ? (
          <a href={basePath} className="ml-1 text-xs underline">
            esta semana
          </a>
        ) : null}
      </div>
    </div>
  );
}
