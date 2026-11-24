import type { Database } from "@/lib/database.types";

export type Meal = Database["public"]["Enums"]["meal_type"];

// Orden en que se muestran las ingestas del dia. "breakfast" existe
// en el enum aunque hoy no se planifique (el modelo por defecto no tiene desayuno).
export const MEAL_ORDER: Meal[] = [
  "breakfast",
  "midmorning",
  "lunch",
  "snack",
  "dinner",
];

export const MEAL_LABELS: Record<Meal, string> = {
  breakfast: "Desayuno",
  midmorning: "Media mañana",
  lunch: "Comida",
  snack: "Merienda",
  dinner: "Cena",
};
