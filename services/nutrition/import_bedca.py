"""Transforma el volcado crudo de BEDCA (bedca_raw.xml) en filas listas
para la tabla `foods`.

Este script SOLO transforma. No toca la base de datos todavia (eso es
un paso separado, a implementar despues de revisar el mapeo con datos
reales). Ejecutar: uv run services/nutrition/import_bedca.py
"""

import csv
import sys
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from pathlib import Path

DATA_DIR = Path(__file__).parent / "data"
RAW_XML_PATH = DATA_DIR / "bedca_raw.xml"
SKIPPED_CSV_PATH = DATA_DIR / "skipped.csv"

BEDCA_SOURCE = "bedca"

# eur_name de BEDCA -> nombre de columna en foods. ENERC no esta aca
# porque necesita logica especial (puede venir en kJ o en kcal).
NUTRIENT_COLUMN_MAP = {
    "PROT": "protein_100g",
    "CHO": "carbs_100g",
    "FAT": "fat_100g",
    "FIBT": "fiber_100g",
}

# Columnas sin las que un alimento no se puede insertar (NOT NULL en el
# esquema). fiber_100g no esta: es nullable.
REQUIRED_COLUMNS = ["kcal_100g", "protein_100g", "carbs_100g", "fat_100g"]

KJ_PER_KCAL = 4.184


@dataclass
class SkippedFood:
    f_id: str
    name: str
    missing: str


def _resolve_value(text: str | None) -> float:
    """El foodvalue existe (se llego a llamar esta funcion). Si
    best_location viene vacio, verificado contra el XML crudo: en el
    99% de los casos (carne sin CHO, fruta sin FAT...) el nutriente es
    realmente cero, no "no medido". BEDCA no distingue ambos casos en
    el propio dato, asi que se interpreta vacio como 0.0. Que el
    foodvalue no exista en absoluto es un caso distinto (ver
    extract_nutrient/extract_energy_kcal) y sigue tratandose como
    dato faltante de verdad."""
    if text is None or text.strip() == "":
        return 0.0
    return float(text)


def extract_energy_kcal(food_elem: ET.Element) -> tuple[float | None, str]:
    """Devuelve (kcal_100g, rama_usada).
    rama_usada in {"kcal", "kJ", "ninguna"}.

    BEDCA puede traer ENERC en kcal, en kJ, o ambos para el mismo
    alimento. Se selecciona SIEMPRE por v_unit, nunca asumiendo la
    unidad por el nombre del nutriente.

    A diferencia de extract_nutrient, aqui NO se aplica la regla
    "vacio -> 0": verificado que, quando falta la energia, el
    foodvalue de ENERC nunca existe vacio, siempre esta ausente del
    todo (a diferencia de CHO/FAT/PROT). Poner 0 kcal a un alimento
    solido real seria falso, asi que si no hay ENERC en ninguna
    unidad, se sigue saltando el alimento.
    """
    kcal_present = False
    kcal_text = None
    kj_present = False
    kj_text = None

    for foodvalue in food_elem.findall("foodvalue"):
        if foodvalue.findtext("eur_name") != "ENERC":
            continue
        unit = (foodvalue.findtext("v_unit") or "").strip()
        if unit == "kcal":
            kcal_present = True
            kcal_text = foodvalue.findtext("best_location")
        elif unit == "kJ":
            kj_present = True
            kj_text = foodvalue.findtext("best_location")

    if kcal_present:
        return _resolve_value(kcal_text), "kcal"
    if kj_present:
        return round(_resolve_value(kj_text) / KJ_PER_KCAL, 2), "kJ"
    return None, "ninguna"


def extract_nutrient(food_elem: ET.Element, eur_name: str) -> float | None:
    """None solo si el foodvalue no existe en absoluto. Si existe pero
    viene vacio, se resuelve a 0.0 (ver _resolve_value)."""
    for foodvalue in food_elem.findall("foodvalue"):
        if foodvalue.findtext("eur_name") == eur_name:
            return _resolve_value(foodvalue.findtext("best_location"))
    return None


def parse_food(food_elem: ET.Element) -> tuple[dict | None, SkippedFood | None, str]:
    """Devuelve (row, skip, energy_branch). row es None si se salta."""
    f_id = food_elem.findtext("f_id")
    name = food_elem.findtext("f_ori_name")

    kcal_100g, energy_branch = extract_energy_kcal(food_elem)

    # search_name no se calcula aqui: lo rellena siempre un trigger en
    # Postgres (normalize_search_name), que ignora lo que mande el
    # cliente. Mandarlo desde Python solo duplicaria la logica.
    row = {
        "user_id": None,
        "name": name,
        "source": BEDCA_SOURCE,
        "source_ref": f_id,
        "kcal_100g": kcal_100g,
        "protein_100g": extract_nutrient(food_elem, "PROT"),
        "carbs_100g": extract_nutrient(food_elem, "CHO"),
        "fat_100g": extract_nutrient(food_elem, "FAT"),
        "fiber_100g": extract_nutrient(food_elem, "FIBT"),
    }

    for column in REQUIRED_COLUMNS:
        if row[column] is None:
            return None, SkippedFood(f_id=f_id, name=name, missing=column), energy_branch

    return row, None, energy_branch


def transform_all(raw_xml_path: Path) -> tuple[list[dict], list[SkippedFood], dict[str, int]]:
    tree = ET.parse(raw_xml_path)
    root = tree.getroot()

    rows = []
    skipped = []
    energy_branch_counts = {"kcal": 0, "kJ": 0, "ninguna": 0}

    for food_elem in root.find("foods").findall("food"):
        row, skip, branch = parse_food(food_elem)
        energy_branch_counts[branch] += 1
        if row is not None:
            rows.append(row)
        else:
            skipped.append(skip)

    return rows, skipped, energy_branch_counts


def write_skipped_csv(skipped: list[SkippedFood]) -> None:
    with open(SKIPPED_CSV_PATH, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["f_id", "name", "missing"])
        for item in skipped:
            writer.writerow([item.f_id, item.name, item.missing])


def main() -> None:
    if not RAW_XML_PATH.exists():
        print(f"No existe {RAW_XML_PATH}. Ejecuta antes download_bedca.py", file=sys.stderr)
        sys.exit(1)

    rows, skipped, energy_branch_counts = transform_all(RAW_XML_PATH)
    write_skipped_csv(skipped)

    print(f"Filas listas para insertar: {len(rows)}")
    print(f"Alimentos saltados (incompletos): {len(skipped)} -> {SKIPPED_CSV_PATH}")
    print("Rama usada para ENERC:")
    print(f"  v_unit=kcal directo: {energy_branch_counts['kcal']}")
    print(f"  v_unit=kJ convertido: {energy_branch_counts['kJ']}")
    print(f"  ninguna (contribuye a saltados): {energy_branch_counts['ninguna']}")


if __name__ == "__main__":
    main()
