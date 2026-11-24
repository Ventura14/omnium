// Unico sitio donde se fija la zona horaria de dominio. Todas las
// fechas de dominio (week_start, slot_date, measured_on,
// effective_from) son fechas civiles de ESA zona, nunca UTC.
//
// Se configura con APP_TIMEZONE (nombre IANA, p. ej. "America/Mexico_City");
// por defecto Europe/Madrid, la zona original del proyecto. Un valor
// invalido lanza RangeError al primer uso: falla alto, no en silencio.
const APP_TIMEZONE = process.env.APP_TIMEZONE || "Europe/Madrid";

// Vercel corre en UTC: entre las 00:00 y las 02:00 de Madrid en
// verano (UTC+2), `new Date()` en el servidor ya esta en el dia
// siguiente visto desde Madrid -- da la fecha equivocada sin fallar
// ruidosamente (el mismo problema en cualquier zona distinta de UTC).
// Nunca derives una fecha de dominio de `new Date()` a secas en el
// servidor: usa esto.
export function todayInAppTimezone(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
  }).format(new Date());
}

// Alias antiguo: las paginas lo importan con este nombre. Se mantiene
// para no tocar cada pagina en este cambio; renombrar las llamadas a
// todayInAppTimezone() y borrar el alias es un cambio mecanico aparte.
export const todayInMadrid = todayInAppTimezone;

// Aritmetica sobre fechas civiles YYYY-MM-DD, en UTC a proposito: una
// vez que la fecha ya es civil (via todayInAppTimezone() o un ?week=
// explicito), sumar/restar dias no debe volver a cruzar zonas
// horarias -- por eso esta funcion, a diferencia de todayInAppTimezone(),
// no toca ninguna zona horaria.
export function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Lunes de la semana que contiene `date`, en UTC por el mismo motivo
// que addDays. Compartido por /semana y /compra: los dos necesitan
// resolver la misma semana "adaptativa" a partir de una fecha civil.
export function mondayOf(date: Date): string {
  const day = date.getUTCDay(); // 0=domingo .. 6=sabado
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(date);
  monday.setUTCDate(date.getUTCDate() + diff);
  return monday.toISOString().slice(0, 10);
}

// "Semana del 7 al 13 de septiembre" -- nunca ISO en la interfaz.
// Compartido por /semana y /compra, mismo criterio que mondayOf.
export function formatWeekRange(weekStart: string): string {
  const start = new Date(`${weekStart}T00:00:00Z`);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);

  const startDay = start.getUTCDate();
  const endDay = end.getUTCDate();
  const startMonth = start.toLocaleDateString("es-ES", {
    month: "long",
    timeZone: "UTC",
  });
  const endMonth = end.toLocaleDateString("es-ES", {
    month: "long",
    timeZone: "UTC",
  });

  if (startMonth === endMonth) {
    return `Semana del ${startDay} al ${endDay} de ${endMonth}`;
  }
  return `Semana del ${startDay} de ${startMonth} al ${endDay} de ${endMonth}`;
}
