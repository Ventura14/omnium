"use client";

import { useMemo, useOptimistic, useState, useTransition } from "react";
import Image from "next/image";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { money } from "@/lib/format";
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
  imagePath: string | null;
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
  const [saveError, setSaveError] = useState<string | null>(null);
  // image_path viene de la base de datos (fiable en cualquier
  // entorno, ver 20260909000000) -- pero si el archivo se borra a
  // mano del disco despues, la miniatura debe desaparecer igual, sin
  // hueco reservado. onError cubre ese caso en el cliente, sin volver
  // a depender del filesystem del servidor en cada peticion.
  const [brokenImages, setBrokenImages] = useState<Set<string>>(new Set());

  // No nos fiamos de que useOptimistic revierta solo si la Server
  // Action falla (documentado por React, no verificado aqui contra
  // un fallo de red de verdad) -- el catch revierte a mano al valor
  // anterior, para que el contador de "llevas" nunca sume un check
  // que no llego a guardarse. Sin cobertura (un super grande, a
  // menudo bajo rasante, es de los peores sitios para
  // esto) esta rama es la que se ejecuta.
  function toggle(item: ShoppingItem) {
    if (item.packsToBuy === null) return;
    const current = checks.get(item.foodId) ?? null;
    const isFresh = current !== null && current === item.packsToBuy;
    const previous = current;
    startTransition(async () => {
      setSaveError(null);
      try {
        if (isFresh) {
          setChecks({ foodId: item.foodId, packs: null });
          await clearShoppingCheck(planId, item.foodId);
        } else {
          setChecks({ foodId: item.foodId, packs: item.packsToBuy! });
          await setShoppingCheck(planId, item.foodId, item.packsToBuy!);
        }
      } catch {
        setChecks({ foodId: item.foodId, packs: previous });
        setSaveError(
          `No se pudo guardar ${item.foodName}. Vuelve a tocarlo cuando tengas cobertura.`
        );
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
    <div className="flex flex-col gap-5">
      {saveError ? (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          <span>{saveError}</span>
          <button
            type="button"
            onClick={() => setSaveError(null)}
            className="shrink-0 underline"
          >
            ocultar
          </button>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
        <aside className="order-first flex flex-col gap-5 lg:sticky lg:top-5 lg:order-last lg:self-start">
          <div className="glow-lime rounded-3xl bg-card p-6">
            <p className="eyebrow">Llevas en el carro</p>
            <p className="mt-2 font-display text-5xl font-bold tabular-nums">
              {money(carried)}
            </p>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-track">
              <div
                role="progressbar"
                aria-valuenow={Math.round(progressPct)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuetext={`${checkedCount} de ${checkableCount} productos`}
                className="h-full rounded-full bg-lime transition-[width] duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {checkedCount} de {checkableCount} productos
            </p>
          </div>

          <div className="rounded-3xl bg-lime p-6 text-primary-foreground">
            <p className="font-display text-xs font-bold tracking-widest uppercase">
              Caja en Dia
            </p>
            <p className="mt-2 font-display text-4xl font-bold tabular-nums">
              {money(totals.boxTotal)}
            </p>
            <dl className="mt-4 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <dt className="opacity-70">Prorrateado</dt>
                <dd className="font-semibold tabular-nums">
                  {money(totals.proratedTotal)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="opacity-70">Por Glovo</dt>
                <dd className="font-semibold tabular-nums">
                  {money(totals.glovoCost)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="opacity-70">Bruto equivalente</dt>
                <dd className="font-semibold tabular-nums">
                  {money(totals.grossEquivalent)}
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-3xl bg-card p-6">
            <p className="eyebrow mb-3">Cocinar el domingo</p>
            <ul className="space-y-2">
              {cookRows.map((r) => (
                <li
                  key={r.recipeId}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-background px-4 py-3 text-sm"
                >
                  <span>{r.recipeName}</span>
                  <span className="font-display whitespace-nowrap text-muted-foreground tabular-nums">
                    ×{r.tandas} · {r.servingsProduced}
                  </span>
                </li>
              ))}
            </ul>
            {totalLeftoverServings > 0 ? (
              <p className="mt-3 text-xs text-muted-foreground">
                Sobran {totalLeftoverServings} raciones esta semana.
              </p>
            ) : null}
          </div>
        </aside>

        <main className="order-last flex flex-col gap-5 lg:order-first">
          {zones.map(([zoneLabel, zoneItems]) => (
            <section key={zoneLabel} className="rounded-3xl bg-card p-3 md:p-4">
              <h3 className="eyebrow px-3 pt-2 pb-3">{zoneLabel}</h3>
              <ul className="space-y-1.5">
                {zoneItems.map((item) => {
                  const current = checks.get(item.foodId) ?? null;
                  const isFresh =
                    current !== null && current === item.packsToBuy;
                  const isStale =
                    current !== null && current !== item.packsToBuy;
                  return (
                    <li
                      key={item.foodId}
                      className={`flex items-center gap-3 rounded-2xl px-3 py-3 transition ${
                        isStale
                          ? "bg-blaze/10 ring-1 ring-blaze/30"
                          : isFresh
                            ? "bg-background/40 opacity-60"
                            : "bg-background"
                      }`}
                    >
                      <label className="flex size-11 shrink-0 cursor-pointer items-center justify-center">
                        <Checkbox
                          checked={isFresh}
                          indeterminate={isStale}
                          onCheckedChange={() => toggle(item)}
                          aria-label={`Marcar ${item.foodName}`}
                          className="size-6 rounded-full"
                        />
                      </label>
                      {item.imagePath && !brokenImages.has(item.foodId) ? (
                        <Image
                          src={item.imagePath}
                          alt=""
                          width={44}
                          height={44}
                          className="size-11 shrink-0 rounded-xl bg-white object-contain p-0.5"
                          onError={() =>
                            setBrokenImages((prev) =>
                              new Set(prev).add(item.foodId)
                            )
                          }
                        />
                      ) : null}
                      <div className="min-w-0 flex-1">
                        <p
                          className={`flex flex-wrap items-center gap-1.5 font-medium ${
                            isFresh ? "line-through" : ""
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
                          <p className="text-xs text-blaze">
                            Marcaste {current} uds, ahora hacen falta{" "}
                            {item.packsToBuy} -- toca para actualizar
                          </p>
                        ) : null}
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-display font-semibold tabular-nums">
                          {money(item.estimatedCost)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {item.packsToBuy} ud{item.packsToBuy !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}

          {pending.length > 0 ? (
            <section className="rounded-3xl border border-blaze/30 bg-blaze/10 p-5">
              <p className="mb-2 font-display font-semibold text-blaze">
                Falta decidir ({pending.length})
              </p>
              <ul className="space-y-1 text-sm text-blaze/90">
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
    </div>
  );
}
