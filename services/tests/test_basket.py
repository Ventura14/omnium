"""La cesta de ejemplo debe ser coherente con el seed de alimentos base, y
una cesta mal formada debe fallar alto, no cargarse a medias."""

import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "services" / "scrapers"))
import basket  # noqa: E402

STAPLES_SEED = ROOT / "supabase" / "seed" / "01_staples.sql"


def test_example_basket_only_uses_seeded_staples():
    example = json.loads(basket.EXAMPLE_FILE.read_text(encoding="utf-8"))
    seed = STAPLES_SEED.read_text(encoding="utf-8")
    missing = [food for food in example.values() if f"'{food}'" not in seed]
    assert not missing, f"alimentos de la cesta de ejemplo que 01_staples.sql no marca: {missing}"


@pytest.mark.parametrize("content", ['["arroz"]', '{"arroz": 3}', '"arroz"'])
def test_bad_basket_shape_is_rejected(tmp_path, monkeypatch, content):
    bad = tmp_path / "basket.json"
    bad.write_text(content, encoding="utf-8")
    monkeypatch.setattr(basket, "BASKET_FILE", bad)
    with pytest.raises(ValueError):
        basket.load_basket()
