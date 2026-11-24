"""Cesta de los scrapers: termino de busqueda en la tienda -> nombre EXACTO
del alimento `is_staple` al que se enlaza el producto.

Es un dato de cada usuario (lo que compra), no codigo: vive en
`basket.json`, que NO se versiona (.gitignore). Si no existe, se usa
`basket.example.json`, una cesta generica de ejemplo.

Para empezar:  cp services/scrapers/basket.example.json services/scrapers/basket.json
y edita los terminos y alimentos. Cada valor tiene que ser el `name`
exacto de un alimento de `foods`.

Regla dura 8/12 (CLAUDE.md): para legumbres y conservas, busca el termino
que describa el estado ("lentejas secas"), nunca el generico -- el
scraper no infiere si lo que encuentra esta seco, cocido o escurrido.
"""

import json
from pathlib import Path

HERE = Path(__file__).parent
BASKET_FILE = HERE / "basket.json"
EXAMPLE_FILE = HERE / "basket.example.json"


def load_basket() -> dict[str, str]:
    path = BASKET_FILE if BASKET_FILE.exists() else EXAMPLE_FILE
    print(f"Cesta: {path.name}" + ("  (ejemplo; copia a basket.json para usar la tuya)" if path == EXAMPLE_FILE else ""))
    basket = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(basket, dict) or not all(
        isinstance(k, str) and isinstance(v, str) for k, v in basket.items()
    ):
        raise ValueError(f"{path.name}: tiene que ser un objeto JSON {{termino: nombre_de_alimento}}")
    return basket
