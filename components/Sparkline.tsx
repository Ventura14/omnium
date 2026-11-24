// Linea de evolucion (p. ej. peso). Solo escala los puntos al lienzo
// SVG; no interpreta ni suaviza los datos.
export function Sparkline({
  values,
  className,
  strokeWidth = 3,
}: {
  values: number[];
  className?: string;
  strokeWidth?: number;
}) {
  if (values.length < 2) return null;

  const W = 200;
  const H = 60;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const d = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * W;
      const y = H - 4 - ((v - min) / span) * (H - 8);
      return `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className} aria-hidden="true">
      <path
        className="line-draw"
        d={d}
        fill="none"
        stroke="var(--lime)"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
