"use client";

// Red de seguridad para lo que el try/catch de ShoppingBoard NO
// prevea -- un fallo sin capturar en /compra ya no tira toda la
// pantalla a un error generico de Next.js: se queda en esta pagina,
// con boton para reintentar sin perder el sitio en el que se estaba.
export default function CompraError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto max-w-5xl space-y-4 p-6">
      <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm">
        <p className="font-medium text-destructive">
          Algo falló al cargar la compra.
        </p>
        <p className="mt-1 text-muted-foreground">
          Puede ser la conexión. Los productos que ya habías marcado antes de
          este fallo siguen guardados.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className="mt-3 rounded bg-black px-3 py-1.5 text-xs text-white"
        >
          Reintentar
        </button>
      </div>
    </main>
  );
}
