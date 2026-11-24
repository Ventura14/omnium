"use client";

import { RotateCw } from "lucide-react";
import { Page, btnPrimary } from "@/components/kit";

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
    <Page>
      <div className="rounded-3xl border border-destructive/30 bg-destructive/10 p-6">
        <p className="font-display text-lg font-semibold text-destructive">
          Algo falló al cargar la compra.
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Puede ser la conexión. Los productos que ya habías marcado antes de
          este fallo siguen guardados.
        </p>
        <button type="button" onClick={() => reset()} className={`${btnPrimary} mt-4`}>
          <RotateCw className="size-4" /> Reintentar
        </button>
      </div>
    </Page>
  );
}
