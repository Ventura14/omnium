"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { MacroRings } from "@/components/MacroRings";
import { DayStatus, MacroRow } from "@/components/DayMacros";
import { copyPreviousDay } from "./actions";
import { SlotCell, type SlotCellProps } from "./SlotCell";

// Vista de semana tipo calendario: una tira de 7 dias (cada uno con
// una "pastilla" por comida que se rellena al asignarla) y, debajo,
// solo el dia seleccionado con sus comidas en grande. "use client"
// solo para cambiar de dia sin ir al servidor: la semana entera ya
// llega cargada. Los totales vienen de plan_day_totals (SQL).

export type PlannerSlot = SlotCellProps & { key: string };

export type PlannerDay = {
  date: string;
  weekdayShort: string;
  dayNumber: number;
  longLabel: string;
  isToday: boolean;
  copyFrom: string | null;
  totals: {
    kcal: number;
    protein: number;
    carbs: number | null;
    fat: number | null;
    targetKcal: number;
    targetProtein: number;
    targetCarbs: number | null;
    targetFat: number | null;
    kcalGap: number;
    proteinGap: number;
    onTarget: boolean;
    macrosIncomplete: boolean;
    mealsOut: number;
    emptySlots: number;
  } | null;
  slots: PlannerSlot[];
};

export function WeekPlanner({
  days,
  planId,
  weekStart,
  initialDate,
}: {
  days: PlannerDay[];
  planId: string;
  weekStart: string;
  initialDate: string;
}) {
  const [selected, setSelected] = useState(initialDate);
  const day = days.find((d) => d.date === selected) ?? days[0];

  return (
    <div className="space-y-4 lg:flex lg:flex-1 lg:flex-col">
      {/* Tira de la semana */}
      <div
        role="tablist"
        aria-label="Días de la semana"
        className="grid grid-cols-7 gap-1.5 rounded-3xl bg-card p-1.5 sm:gap-2 sm:p-2"
      >
        {days.map((d) => {
          const active = d.date === day.date;
          return (
            <button
              key={d.date}
              type="button"
              role="tab"
              aria-selected={active}
              aria-label={d.longLabel}
              onClick={() => setSelected(d.date)}
              className={cn(
                "relative flex flex-col items-center gap-1.5 rounded-2xl px-1 py-2.5 transition 2xl:gap-2 2xl:py-4 outline-none focus-visible:ring-2 focus-visible:ring-lime/60",
                active
                  ? "bg-lime text-primary-foreground"
                  : "hover:bg-track"
              )}
            >
              <span
                className={cn(
                  "font-display text-[11px] tracking-widest uppercase",
                  active ? "opacity-70" : "text-muted-foreground"
                )}
              >
                {d.weekdayShort}
              </span>
              <span className="font-display text-xl leading-none font-bold sm:text-2xl 2xl:text-3xl">
                {d.dayNumber}
              </span>
              <span className="flex gap-0.5 sm:gap-1">
                {d.slots.map((s) => (
                  <span
                    key={s.key}
                    className={cn(
                      "h-1.5 w-2 rounded-full sm:w-3",
                      s.eatingOut
                        ? active
                          ? "bg-primary-foreground/25"
                          : "bg-white/15"
                        : s.recipe
                          ? active
                            ? "bg-primary-foreground"
                            : "bg-lime"
                          : active
                            ? "border border-primary-foreground/40"
                            : "border border-lime/40"
                    )}
                  />
                ))}
              </span>
              {d.isToday && !active ? (
                <span className="absolute top-2 right-2 size-1.5 rounded-full bg-lime" />
              ) : null}
              {d.totals?.onTarget ? (
                <Check
                  className={cn(
                    "absolute top-1.5 left-1.5 size-3.5",
                    active ? "text-primary-foreground" : "text-lime"
                  )}
                  strokeWidth={3}
                />
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Dia seleccionado */}
      <section
        role="tabpanel"
        aria-label={day.longLabel}
        key={day.date}
        className="animate-in fade-in slide-in-from-bottom-2 grid gap-4 duration-300 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(20rem,28%)_1fr]"
      >
        <div className="flex flex-col gap-5 rounded-3xl bg-card p-5 xl:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              {day.isToday ? <p className="eyebrow mb-0.5 text-lime">Hoy</p> : null}
              <h2 className="font-display text-xl font-bold capitalize 2xl:text-2xl">
                {day.longLabel}
              </h2>
            </div>
            {day.totals ? <DayStatus totals={day.totals} /> : null}
          </div>

          {day.totals ? (
            <div className="flex items-center gap-4 lg:flex-1 xl:gap-6">
              <MacroRings
                size="fluid"
                protein={day.totals.protein}
                targetProtein={day.totals.targetProtein}
                kcal={day.totals.kcal}
                targetKcal={day.totals.targetKcal}
              />
              <div className="min-w-0 flex-1 space-y-2.5 2xl:space-y-4">
                <MacroRow label="Prot." value={day.totals.protein} target={day.totals.targetProtein} unit="g" bar="bg-lime" text="text-lime" />
                <MacroRow label="kcal" value={day.totals.kcal} target={day.totals.targetKcal} unit="" bar="bg-blaze" text="text-blaze" />
                <MacroRow label="HC" value={day.totals.carbs} target={day.totals.targetCarbs} unit="g" bar="bg-white/40" text="text-foreground" />
                <MacroRow label="Grasa" value={day.totals.fat} target={day.totals.targetFat} unit="g" bar="bg-white/20" text="text-foreground" />
              </div>
            </div>
          ) : null}

          {day.copyFrom ? (
            <form action={copyPreviousDay} className="mt-auto border-t pt-3">
              <input type="hidden" name="plan_id" value={planId} />
              <input type="hidden" name="target_date" value={day.date} />
              <input type="hidden" name="week_start" value={weekStart} />
              <button
                type="submit"
                title="Sobrescribe las comidas de este día"
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-full px-3 py-2 text-sm text-muted-foreground transition hover:bg-track hover:text-foreground"
              >
                <Copy className="size-3.5" /> Copiar el {day.copyFrom}
              </button>
            </form>
          ) : null}
        </div>

        <div className="grid auto-rows-fr gap-3 sm:grid-cols-2">
          {day.slots.map(({ key, ...slot }) => (
            <SlotCell key={key} {...slot} />
          ))}
        </div>
      </section>
    </div>
  );
}
