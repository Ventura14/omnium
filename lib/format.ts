// Helpers de formato para la interfaz (es-ES). Solo presentan
// numeros y fechas ya calculados; no deciden nada.

const numberFmt = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 });
const decimalFmt = new Intl.NumberFormat("es-ES", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const moneyFmt = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
});

export function num(n: number | null | undefined): string {
  return n == null ? "—" : numberFmt.format(n);
}

export function decimal(n: number | null | undefined): string {
  return n == null ? "—" : decimalFmt.format(n);
}

export function money(n: number | null | undefined): string {
  return n == null ? "—" : moneyFmt.format(n);
}

// Fechas civiles YYYY-MM-DD: se interpretan en UTC a proposito (ver
// lib/dates.ts) para que formatear no vuelva a cruzar zonas horarias.
function civil(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00Z`);
}

// "miércoles, 7 oct"
export function longDay(dateStr: string): string {
  return civil(dateStr).toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

// "7 oct"
export function shortDate(dateStr: string): string {
  return civil(dateStr).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

// "L", "M", "X", "J", "V", "S", "D"
const WEEKDAY_LETTERS = ["D", "L", "M", "X", "J", "V", "S"];
export function weekdayLetter(dateStr: string): string {
  return WEEKDAY_LETTERS[civil(dateStr).getUTCDay()];
}
