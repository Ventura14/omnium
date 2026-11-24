import { cn } from "@/lib/utils";

// Piezas de interfaz compartidas por todas las pantallas, para que el
// estilo "fitness" (tarjetas oscuras, lima de acento, Space Grotesk
// en titulos) viva en un solo sitio. Sin logica ni estado: solo
// marcado y clases. Server Components; se pueden usar tambien desde
// componentes cliente.

// Contenedor comun de la app (navegacion y paginas): ancho que se
// adapta a la pantalla con margenes laterales fluidos.
export const container = "mx-auto w-full max-w-[1600px] px-4 sm:px-6 lg:px-10";

export const inputClass =
  "w-full rounded-xl border border-input bg-card px-4 py-2.5 text-sm outline-none transition placeholder:text-muted-foreground/60 focus-visible:border-lime focus-visible:ring-2 focus-visible:ring-lime/30 disabled:opacity-50";

export const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-full bg-lime px-5 py-2.5 font-display text-sm font-bold text-primary-foreground transition hover:-translate-y-0.5 hover:brightness-105 disabled:pointer-events-none disabled:opacity-50";

export const btnSecondary =
  "inline-flex items-center justify-center gap-2 rounded-full bg-track px-4 py-2 font-display text-sm font-semibold text-foreground transition hover:bg-white/15 disabled:pointer-events-none disabled:opacity-50";

export const btnGhost =
  "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-muted-foreground transition hover:bg-track hover:text-foreground";

export function Page({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <main className={cn(container, "space-y-5 pb-10", className)}>
      {children}
    </main>
  );
}

export function PageHeader({
  eyebrow,
  title,
  accent,
  children,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  accent?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 pt-2 pb-1">
      <div>
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1 className="mt-1 font-display text-3xl leading-tight font-bold md:text-4xl">
          {title}
          {accent ? (
            <>
              {" "}
              <span className="text-lime">{accent}</span>
            </>
          ) : null}
        </h1>
      </div>
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </header>
  );
}

export function Panel({
  children,
  className,
  title,
  action,
}: {
  children: React.ReactNode;
  className?: string;
  title?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className={cn("rounded-3xl bg-card p-6 md:p-7", className)}>
      {title || action ? (
        <div className="mb-5 flex items-baseline justify-between gap-3">
          {title ? <h2 className="eyebrow">{title}</h2> : <span />}
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="eyebrow block">
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function Stat({
  label,
  value,
  unit,
  tone = "default",
  className,
}: {
  label: string;
  value: React.ReactNode;
  unit?: string;
  tone?: "default" | "lime" | "blaze";
  className?: string;
}) {
  return (
    <div className={className}>
      <p
        className={cn(
          "text-xs tracking-wider uppercase",
          tone === "lime"
            ? "text-lime"
            : tone === "blaze"
              ? "text-blaze"
              : "text-muted-foreground"
        )}
      >
        {label}
      </p>
      <p className="font-display text-3xl font-semibold">
        {value}
        {unit ? <span className="text-base text-muted-foreground"> {unit}</span> : null}
      </p>
    </div>
  );
}

export function Alert({
  children,
  tone = "error",
}: {
  children: React.ReactNode;
  tone?: "error" | "warn";
}) {
  return (
    <div
      role="alert"
      className={cn(
        "rounded-2xl border px-4 py-3 text-sm",
        tone === "error"
          ? "border-destructive/30 bg-destructive/10 text-destructive"
          : "border-blaze/30 bg-blaze/10 text-blaze"
      )}
    >
      {children}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-2xl border border-dashed border-white/10 px-5 py-8 text-center text-muted-foreground">
      {children}
    </p>
  );
}

// Tabla de datos con el estilo de la app. Las filas se pasan como
// <tr> normales; las celdas heredan relleno y separadores.
export function DataTable({
  head,
  children,
}: {
  head: React.ReactNode[];
  children: React.ReactNode;
}) {
  return (
    <div className="-mx-2 overflow-x-auto">
      <table className="w-full text-sm [&_td]:px-2 [&_td]:py-3 [&_th]:px-2 [&_th]:pb-3 [&_tbody_tr]:border-t [&_tbody_tr]:border-border [&_tbody_tr:hover]:bg-white/[0.02]">
        <thead>
          <tr className="text-left">
            {head.map((h, i) => (
              <th key={i} className="eyebrow font-normal">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="tabular-nums">{children}</tbody>
      </table>
    </div>
  );
}
