import { num } from "@/lib/format";
import { cn } from "@/lib/utils";

// Dos anillos concentricos: exterior = proteina (lima), interior =
// energia (naranja). Los valores llegan ya calculados por Postgres
// (plan_day_totals); aqui solo se convierte "valor / objetivo" en
// longitud de trazo, que es presentacion, no regla de negocio.

const OUTER_R = 52;
const INNER_R = 39;

function Ring({
  r,
  value,
  target,
  color,
}: {
  r: number;
  value: number;
  target: number;
  color: string;
}) {
  const circumference = 2 * Math.PI * r;
  const fraction = target > 0 ? Math.min(1, Math.max(0, value / target)) : 0;
  const offset = circumference * (1 - fraction);
  return (
    <>
      <circle
        cx="60"
        cy="60"
        r={r}
        fill="none"
        stroke="var(--track)"
        strokeWidth="9"
      />
      <circle
        className="ring-progress"
        cx="60"
        cy="60"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="9"
        strokeLinecap="round"
        strokeDasharray={circumference}
        style={
          {
            "--ring-from": circumference,
            "--ring-to": offset,
          } as React.CSSProperties
        }
      />
    </>
  );
}

export function MacroRings({
  protein,
  targetProtein,
  kcal,
  targetKcal,
  className,
  size = "lg",
}: {
  protein: number;
  targetProtein: number;
  kcal: number;
  targetKcal: number;
  className?: string;
  size?: "sm" | "md" | "lg" | "fluid";
}) {
  return (
    <div
      className={cn(
        "relative shrink-0",
        size === "lg"
          ? "size-52"
          : size === "md"
            ? "size-40"
            : size === "fluid"
              ? "size-28 xl:size-36 2xl:size-44"
              : "size-28",
        className
      )}
    >
      <svg
        viewBox="0 0 120 120"
        className="size-full -rotate-90"
        role="img"
        aria-label={`Proteína ${num(protein)} de ${num(targetProtein)} g; energía ${num(kcal)} de ${num(targetKcal)} kcal`}
      >
        <Ring r={OUTER_R} value={protein} target={targetProtein} color="var(--lime)" />
        <Ring r={INNER_R} value={kcal} target={targetKcal} color="var(--blaze)" />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p
            className={cn(
              "font-display leading-none font-bold tabular-nums",
              size === "lg"
                ? "text-4xl"
                : size === "md"
                  ? "text-2xl"
                  : size === "fluid"
                    ? "text-xl xl:text-2xl 2xl:text-3xl"
                    : "text-xl"
            )}
          >
            {num(protein)}
            <span
              className={cn(
                "text-muted-foreground",
                size === "lg" ? "text-xl" : size === "md" ? "text-sm" : "text-xs"
              )}
            >
              g
            </span>
          </p>
          <p
            className={cn(
              "mt-1 tracking-wider text-muted-foreground uppercase",
              size === "lg"
                ? "text-xs"
                : size === "md"
                  ? "text-[10px]"
                  : size === "fluid"
                    ? "text-[9px] xl:text-[10px] 2xl:text-xs"
                    : "text-[9px]"
            )}
          >
            de {num(targetProtein)}
          </p>
        </div>
      </div>
    </div>
  );
}
