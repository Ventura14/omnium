"""Descarga unica del catalogo publico de BEDCA a un XML local.

BEDCA (bdpub/procquery.php) no es SOAP real: acepta POST de XML plano
en un lenguaje de consulta propio y devuelve XML plano. No hay WSDL ni
documentacion oficial; el formato de este script se verifico contra el
servicio real, no contra ningun wrapper de terceros.

Uso: uv run services/nutrition/download_bedca.py

Salida: services/nutrition/data/bedca_raw.xml (se commitea: si BEDCA
cae, seguimos teniendo los datos). Cache intermedio en
services/nutrition/data/.bedca_cache/ para poder reanudar si el
servicio se cae a mitad de la descarga (es historicamente inestable).
"""

import ssl
import sys
import time
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

import certifi

BASE_URL = "https://www.bedca.net/bdpub/procquery.php"

# El Python del framework de macOS no trae su propio almacen de
# certificados raiz; sin esto, urlopen falla con
# CERTIFICATE_VERIFY_FAILED aunque el certificado del servidor sea valido.
SSL_CONTEXT = ssl.create_default_context(cafile=certifi.where())

# BEDCA agrega datos de varias instituciones bajo "f_origen". Verificado
# contra el servicio real: BEDCA y BEDCA2 son conjuntos SIN solape entre
# si (mismo alimento nunca aparece en ambos). El resto de origenes
# (TOTAL, UGR, UCM, CESNID, UCO, COMPLEMENTO, HPH, UMU, UGR2015) se
# descartan: TOTAL en concreto se confirmo como duplicado inferior de
# BEDCA2 (mismos valores, pero sin ENERC ni varios micronutrientes).
INCLUDED_ORIGINS = {"BEDCA", "BEDCA2"}

DATA_DIR = Path(__file__).parent / "data"
CACHE_DIR = DATA_DIR / ".bedca_cache"
OUTPUT_FILE = DATA_DIR / "bedca_raw.xml"

REQUEST_DELAY_SECONDS = 0.2
MAX_ATTEMPTS = 4
RETRY_BACKOFF_SECONDS = 2

GROUPS_QUERY = """<?xml version="1.0" encoding="utf-8"?>
<foodquery>
    <type level="3"/>
    <selection>
        <atribute name="fg_id"/>
        <atribute name="fg_ori_name"/>
    </selection>
    <order ordtype="ASC">
        <atribute3 name="fg_id"/>
    </order>
</foodquery>
"""

FOODS_IN_GROUP_QUERY = """<?xml version="1.0" encoding="utf-8"?>
<foodquery>
    <type level="1"/>
    <selection>
        <atribute name="f_id"/>
        <atribute name="f_ori_name"/>
        <atribute name="f_origen"/>
    </selection>
    <condition>
        <cond1>
            <atribute1 name="foodgroup_id"/>
        </cond1>
        <relation type="EQUAL"/>
        <cond3>{group_id}</cond3>
    </condition>
    <order ordtype="ASC">
        <atribute3 name="f_ori_name"/>
    </order>
</foodquery>
"""

FOOD_DETAIL_QUERY = """<?xml version="1.0" encoding="utf-8"?>
<foodquery>
    <type level="2"/>
    <selection>
        <atribute name="f_id"/>
        <atribute name="f_ori_name"/>
        <atribute name="f_eng_name"/>
        <atribute name="componentgroup_id"/>
        <atribute name="c_id"/>
        <atribute name="c_ori_name"/>
        <atribute name="eur_name"/>
        <atribute name="best_location"/>
        <atribute name="v_unit"/>
    </selection>
    <condition>
        <cond1>
            <atribute1 name="f_id"/>
        </cond1>
        <relation type="EQUAL"/>
        <cond3>{food_id}</cond3>
    </condition>
    <condition>
        <cond1>
            <atribute1 name="publico"/>
        </cond1>
        <relation type="EQUAL"/>
        <cond3>1</cond3>
    </condition>
    <order ordtype="ASC">
        <atribute3 name="componentgroup_id"/>
    </order>
</foodquery>
"""


def post_query(xml_body: str) -> str:
    """POST una query al endpoint de BEDCA con reintentos, y devuelve el
    cuerpo de la respuesta como texto. BEDCA es historicamente inestable,
    de ahi los reintentos con backoff."""
    request = urllib.request.Request(
        BASE_URL,
        data=xml_body.encode("utf-8"),
        headers={"Content-Type": "text/xml"},
        method="POST",
    )

    last_error: Exception | None = None
    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            with urllib.request.urlopen(request, timeout=30, context=SSL_CONTEXT) as response:
                return response.read().decode("utf-8")
        except (urllib.error.URLError, TimeoutError) as error:
            last_error = error
            if attempt < MAX_ATTEMPTS:
                wait = RETRY_BACKOFF_SECONDS * attempt
                print(
                    f"  aviso: fallo intento {attempt}/{MAX_ATTEMPTS} "
                    f"({error}), reintento en {wait}s",
                    file=sys.stderr,
                )
                time.sleep(wait)

    raise RuntimeError(f"BEDCA no respondio tras {MAX_ATTEMPTS} intentos") from last_error


def fetch_group_ids() -> list[str]:
    xml_text = post_query(GROUPS_QUERY)
    root = ET.fromstring(xml_text)
    return [food.findtext("fg_id") for food in root.findall("food")]


def fetch_food_ids_for_group(group_id: str) -> list[tuple[str, str]]:
    """Devuelve [(f_id, f_ori_name), ...] para el grupo, filtrando por
    origen en Python: el filtro EQUAL del propio servicio hace
    coincidencia por prefijo (f_origen=BEDCA tambien devuelve BEDCA2),
    asi que no nos podemos fiar de filtrarlo en la query."""
    xml_body = FOODS_IN_GROUP_QUERY.format(group_id=group_id)
    xml_text = post_query(xml_body)
    root = ET.fromstring(xml_text)

    selected = []
    for food in root.findall("food"):
        origin = food.findtext("f_origen")
        if origin in INCLUDED_ORIGINS:
            selected.append((food.findtext("f_id"), food.findtext("f_ori_name")))
    return selected


def fetch_and_cache_food_detail(food_id: str) -> str:
    cache_path = CACHE_DIR / f"{food_id}.xml"
    if cache_path.exists():
        return cache_path.read_text(encoding="utf-8")

    xml_body = FOOD_DETAIL_QUERY.format(food_id=food_id)
    xml_text = post_query(xml_body)
    cache_path.write_text(xml_text, encoding="utf-8")
    time.sleep(REQUEST_DELAY_SECONDS)
    return xml_text


def main() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    CACHE_DIR.mkdir(parents=True, exist_ok=True)

    print("Consultando grupos de alimentos...")
    group_ids = fetch_group_ids()
    print(f"  {len(group_ids)} grupos")

    foods_to_fetch: dict[str, str] = {}
    for group_id in group_ids:
        for food_id, food_name in fetch_food_ids_for_group(group_id):
            foods_to_fetch[food_id] = food_name
        time.sleep(REQUEST_DELAY_SECONDS)

    print(f"Alimentos a descargar (BEDCA + BEDCA2, sin duplicados): {len(foods_to_fetch)}")

    component_list_elem: ET.Element | None = None
    food_elements: list[ET.Element] = []
    failed_ids: list[str] = []

    for index, (food_id, food_name) in enumerate(foods_to_fetch.items(), start=1):
        print(f"  [{index}/{len(foods_to_fetch)}] {food_id} {food_name}", end="\r")
        try:
            xml_text = fetch_and_cache_food_detail(food_id)
        except RuntimeError as error:
            print(f"\n  ERROR descargando f_id={food_id} ({food_name}): {error}", file=sys.stderr)
            failed_ids.append(food_id)
            continue

        root = ET.fromstring(xml_text)
        food_elem = root.find("food")
        if food_elem is None or len(food_elem) == 0:
            print(f"\n  aviso: f_id={food_id} ({food_name}) vino vacio, se omite", file=sys.stderr)
            continue

        food_elements.append(food_elem)

        if component_list_elem is None:
            component_list_elem = root.find("componentList")

    print()

    dump_root = ET.Element("bedca_dump")
    dump_root.set("origenes_incluidos", ",".join(sorted(INCLUDED_ORIGINS)))
    dump_root.set("total_alimentos", str(len(food_elements)))

    foods_container = ET.SubElement(dump_root, "foods")
    for food_elem in food_elements:
        foods_container.append(food_elem)

    if component_list_elem is not None:
        dump_root.append(component_list_elem)

    tree = ET.ElementTree(dump_root)
    ET.indent(tree, space="  ")
    tree.write(OUTPUT_FILE, encoding="utf-8", xml_declaration=True)

    print(f"Guardado: {OUTPUT_FILE} ({len(food_elements)} alimentos)")
    if failed_ids:
        print(f"Fallaron tras reintentos ({len(failed_ids)}): {', '.join(failed_ids)}", file=sys.stderr)


if __name__ == "__main__":
    main()
