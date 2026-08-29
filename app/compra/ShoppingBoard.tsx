"use client";

import { useMemo, useOptimistic, useTransition } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { setShoppingCheck, clearShoppingCheck } from "./actions";

// Toda la aritmetica (packs_to_buy, estimated_cost, tandas, totales)
// llega ya calculada por Postgres -- esto solo suma columnas ya
// calculadas para el contador en vivo del carrito (regla 1: sumar
// filas ya resueltas para feedback inmediato no es logica de
// negocio, es lo mismo que ya hace DaySummary en /semana).
//
// DOS EXCEPCIONES CONSCIENTES a como se hacen las cosas en el resto
// del repo, no un precedente general contra las reglas 1 y 2:
//
// 1. useOptimistic + Server Action llamada directa, sin
//    <form action> ni redirect (compárese con /semana/actions.ts).
//    Esta pantalla se usa de pie, con el carro en una mano -- un
//    reload de pagina por cada casilla marcada la haria inservible.
//    Coste: todavia no maneja el fallo de la escritura (ver
//    NOTES_shopping_list.md, "checklist sin cobertura").
//
// 2. La suma de "llevas en el carro" ocurre en el cliente sobre
//    estimated_cost ya calculado por shopping_list -- no es una
//    regla de negocio nueva (no decide precios ni ranking), es
//    aritmetica de presentacion para feedback instantaneo, igual que
//    ya hacia DaySummary. Si algun dia esta suma necesitara logica
//    real (descuentos, impuestos...) tendria que volver a Postgres.

export type ShoppingItem = {
  foodId: string;
  foodName: string;
  productName: string | null;
  gramsNeeded: number;
  packsToBuy: number | null;
  estimatedCost: number | null;
  packSizeIsApprox: boolean;
  chosenByUser: boolean;
  zoneLabel: string;
  zoneOrder: number;
  checkedPacks: number | null;
};

export type PendingItem = {
  foodId: string;
  foodName: string;
  reason: string;
};

export type CookRow = {
  recipeId: string;
  recipeName: string;
  tandas: number;
  servingsProduced: number;
};

export type Totals = {
  boxTotal: number | null;
  proratedTotal: number | null;
  glovoCost: number | null;
  grossEquivalent: number | null;
};

function money(n: number | null | undefined): string {
  return n == null ? "—" : `${n.toFixed(2)} €`;
}

export function ShoppingBoard({
  planId,
  items,
  pending,
  cookRows,
  totalLeftoverServings,
  totals,
}: {
  planId: string;
  items: ShoppingItem[];
  pending: PendingItem[];
  cookRows: CookRow[];
  totalLeftoverServings: number;
  totals: Totals;
}) {
  const [checks, setChecks] = useOptimistic(
    new Map(items.map((it) => [it.foodId, it.checkedPacks])),
    (state, update: { foodId: string; packs: number | null }) => {
      const next = new Map(state);
      next.set(update.foodId, update.packs);
      return next;
    }
  );
  const [, startTransition] = useTransition();

  function toggle(item: ShoppingItem) {
    if (item.packsToBuy === null) return;
    const current = checks.get(item.foodId) ?? null;
    const isFresh = current !== null && current === item.packsToBuy;
    startTransition(async () => {
      if (isFresh) {
        setChecks({ foodId: item.foodId, packs: null });
        await clearShoppingCheck(planId, item.foodId);
      } else {
        setChecks({ foodId: item.foodId, packs: item.packsToBuy! });
        await setShoppingCheck(planId, item.foodId, item.packsToBuy!);
      }
    });
  }

  const { checkedCount, checkableCount, carried } = useMemo(() => {
    let checkedCount = 0;
    let checkableCount = 0;
    let carried = 0;
    for (const item of items) {
      if (item.packsToBuy === null) continue;
      checkableCount += 1;
      const current = checks.get(item.foodId) ?? null;
      if (current !== null && current === item.packsToBuy) {
        checkedCount += 1;
        carried += item.estimatedCost ?? 0;
      }
    }
    return { checkedCount, checkableCount, carried };
  }, [items, checks]);

  const zones = useMemo(() => {
    const byZone = new Map<string, ShoppingItem[]>();
    for (const item of items) {
      const list = byZone.get(item.zoneLabel) ?? [];
      list.push(item);
      byZone.set(item.zoneLabel, list);
    }
    return [...byZone.entries()].sort(
      (a, b) => a[1][0].zoneOrder - b[1][0].zoneOrder
    );
  }, [items]);

  const progressPct =
    checkableCount > 0 ? (checkedCount / checkableCount) * 100 : 0;

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_19rem] md:gap-0">
      <aside className="order-first flex flex-col gap-6 border-b pb-6 md:order-last md:border-b-0 md:border-l md:py-4 md:pl-6">
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Llevas en el carro
          </h3>
          <p className="text-3xl font-semibold tabular-nums tracking-tight">
            {money(carried)}
          </p>
          <Progress value={progressPct} />
          <p className="text-sm text-muted-foreground">
            {checkedCount} de {checkableCount} productos
          </p>
        </div>

        <Separator />

        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Cocinar el domingo
          </h3>
          {cookRows.map((r) => (
            <div
              key={r.recipeId}
              className="flex items-baseline justify-between gap-3 border-b pb-2 text-sm last:border-b-0"
            >
              <span>{r.recipeName}</span>
              <span className="whitespace-nowrap tabular-nums text-muted-foreground">
                {r.tandas} tanda{r.tandas !== 1 ? "s" : ""} · {r.servingsProduced}
              </span>
            </div>
          ))}
          {totalLeftoverServings > 0 ? (
            <p className="text-xs text-muted-foreground">
              Sobran {totalLeftoverServings} raciones esta semana.
            </p>
          ) : null}
        </div>

        <Separator />

        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Totales
          </h3>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Prorrateado</span>
            <span className="tabular-nums">{money(totals.proratedTotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Por Glovo</span>
            <span className="tabular-nums">{money(totals.glovoCost)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Bruto equivalente</span>
            <span className="tabular-nums">{money(totals.grossEquivalent)}</span>
          </div>
          <div className="flex justify-between border-t pt-2 text-base font-semibold">
            <span>Caja en Dia</span>
            <span className="tabular-nums">{money(totals.boxTotal)}</span>
          </div>
        </div>
      </aside>

      <main className="order-last flex flex-col md:order-first md:pr-6">
        {zones.map(([zoneLabel, zoneItems]) => (
          <section key={zoneLabel}>
            <h3 className="sticky top-0 bg-background py-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {zoneLabel}
            </h3>
            {zoneItems.map((item) => {
              const current = checks.get(item.foodId) ?? null;
              const isFresh =
                current !== null && current === item.packsToBuy;
              const isStale = current !== null && current !== item.packsToBuy;
              return (
                <div
                  key={item.foodId}
                  className={`flex items-start gap-3 border-b py-3 ${
                    isStale ? "bg-amber-50 dark:bg-amber-950/30" : ""
                  }`}
                >
                  <label className="flex size-11 shrink-0 cursor-pointer items-center justify-center">
                    <Checkbox
                      checked={isFresh}
                      indeterminate={isStale}
                      onCheckedChange={() => toggle(item)}
                      aria-label={`Marcar ${item.foodName}`}
                      className="size-6"
                    />
                  </label>
                  <div className="size-10 shrink-0 rounded-md border bg-muted" />
                  <div className="min-w-0 flex-1">
                    <p
                      className={`flex flex-wrap items-center gap-1.5 font-medium ${
                        isFresh ? "text-muted-foreground line-through" : ""
                      }`}
                    >
                      {item.foodName}
                      {item.chosenByUser ? (
                        <Badge variant="secondary">elegido</Badge>
                      ) : null}
                      {item.packSizeIsApprox ? (
                        <Badge variant="outline">aprox.</Badge>
                      ) : null}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                      {item.productName} · necesitas {item.gramsNeeded} g
                    </p>
                    {isStale ? (
                      <p className="text-xs text-amber-700 dark:text-amber-500">
                        Marcaste {current} uds, ahora hacen falta{" "}
                        {item.packsToBuy} -- toca para actualizar
                      </p>
                    ) : null}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="tabular-nums font-medium">
                      {money(item.estimatedCost)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.packsToBuy} ud{item.packsToBuy !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
              );
            })}
          </section>
        ))}

        {pending.length > 0 ? (
          <section className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
            <p className="mb-2 text-sm font-medium text-amber-800 dark:text-amber-400">
              Falta decidir ({pending.length})
            </p>
            <ul className="space-y-1 text-sm text-amber-700 dark:text-amber-500">
              {pending.map((p) => (
                <li key={p.foodId}>
                  <span className="font-medium">{p.foodName}</span> — {p.reason}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </main>
    </div>
  );
}
