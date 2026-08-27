// Unico sitio donde se fija la zona horaria de dominio. Todas las
// fechas de dominio (week_start, slot_date, measured_on,
// effective_from) son fechas civiles de Europe/Madrid, nunca UTC.
//
// Vercel corre en UTC: entre las 00:00 y las 02:00 de Madrid en
// verano (UTC+2), `new Date()` en el servidor ya esta en el dia
// siguiente visto desde Madrid -- da la fecha equivocada sin fallar
// ruidosamente. Nunca derives una fecha de dominio de `new Date()`
// a secas en el servidor: usa esto.
export function todayInMadrid(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
  }).format(new Date());
}

// Aritmetica sobre fechas civiles YYYY-MM-DD, en UTC a proposito: una
// vez que la fecha ya es civil (via todayInMadrid() o un ?week=
// explicito), sumar/restar dias no debe volver a cruzar zonas
// horarias -- por eso esta funcion, a diferencia de todayInMadrid(),
// no toca Europe/Madrid para nada.
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
