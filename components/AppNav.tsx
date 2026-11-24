"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  ChefHat,
  Gauge,
  ShoppingCart,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { container } from "@/components/kit";

// Navegacion persistente: barra arriba en escritorio, pestañas fijas
// abajo en movil (se usa con el pulgar, en la cocina o en el super).
// "use client" solo por usePathname, para marcar la seccion activa.

const ITEMS = [
  { href: "/", label: "Hoy", icon: Gauge },
  { href: "/semana", label: "Semana", icon: CalendarDays },
  { href: "/compra", label: "Compra", icon: ShoppingCart },
  { href: "/recetas", label: "Recetas", icon: ChefHat },
  { href: "/peso", label: "Progreso", icon: TrendingUp },
] as const;

const SECONDARY = [
  { href: "/foods", label: "Alimentos" },
  { href: "/objetivos", label: "Objetivos" },
] as const;

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function AppNav() {
  const pathname = usePathname();
  if (pathname === "/login") return null;

  return (
    <>
      <header className={cn(container, "flex items-center justify-between gap-4 py-4")}>
        <Link
          href="/"
          className="font-display text-2xl font-bold tracking-tight"
        >
          OMNIUM<span className="text-lime">.</span>
        </Link>

        <nav
          aria-label="Principal"
          className="hidden items-center gap-6 font-display text-sm tracking-wider uppercase md:flex"
        >
          {ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(pathname, item.href) ? "page" : undefined}
              className={cn(
                "rounded-md px-1 py-0.5 transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-lime/50",
                isActive(pathname, item.href)
                  ? "text-lime"
                  : "text-muted-foreground"
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <nav
          aria-label="Secundaria"
          className="flex items-center gap-1 rounded-full bg-card p-1 font-display text-xs"
        >
          {SECONDARY.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(pathname, item.href) ? "page" : undefined}
              className={cn(
                "rounded-full px-3 py-1.5 transition-colors",
                isActive(pathname, item.href)
                  ? "bg-track text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      <nav
        aria-label="Principal"
        className="fixed inset-x-3 bottom-3 z-40 grid grid-cols-5 rounded-3xl border bg-card/90 p-1.5 backdrop-blur-md md:hidden"
      >
        {ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-col items-center gap-1 rounded-2xl py-2 font-display text-[11px] transition-colors",
                active
                  ? "bg-lime text-primary-foreground"
                  : "text-muted-foreground"
              )}
            >
              <Icon className="size-5" strokeWidth={active ? 2.4 : 1.8} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
