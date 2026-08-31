"""Lectura y validación del Excel manual de precios OIC.

`data/manual/BD_precios_ico_actualizado.xlsx` se carga a mano: la OIC no
tiene una URL de descarga automática identificada (ver sección 2.1 del
blueprint), así que estos precios —originalmente extraídos de un PDF vía
`camelot`— se mantienen en este Excel, que alguien actualiza y sube al
repo. `scrape.py` ya cubre las fuentes que sí tienen descarga automática
(FNC, yfinance); este módulo solo lee y valida esta hoja manual.

Esquema de columnas confirmado contra el archivo real
(`BD_precios_ICO_actualizada.xlsx`, hoja única `Sheet1`, una fila por
fecha, sin nulos, datos desde 2019-07-01): ICO Composite Indicator,
Colombian Milds, Other Milds, Brazilian Naturals y Robustas (todas en
US¢ por libra), más dos columnas de spread ya calculadas en el propio
Excel (Colombian Milds vs Brazilian Naturals / vs Robustas) — estas
últimas son opcionales, se capturan si están presentes pero no hacen
fallar la validación si faltan. El matching de columnas es tolerante a
variaciones menores de acentos/mayúsculas/espacios.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from pathlib import Path
from typing import Optional, Union

import pandas as pd

DEFAULT_MANUAL_EXCEL_PATH = Path("data/manual/BD_precios_ICO_actualizada.xlsx")

# columna canónica -> alias aceptados (comparados ya normalizados: sin
# acentos, en minúsculas, con espacios colapsados)
EXPECTED_COLUMNS: dict[str, tuple[str, ...]] = {
    "fecha": ("fecha", "date"),
    "ico_composite": (
        "ico composite indicator (us por libra)",
        "ico composite",
        "ico compuesto",
        "composite indicator",
    ),
    "colombian_milds": ("colombian milds (us por libra)", "colombian milds", "suaves colombianos"),
    "other_milds": ("other milds (us por libra)", "otros suaves", "other milds"),
    "brazilian_naturals": (
        "brazilian naturals (us por libra)",
        "naturales",
        "brazilian naturals",
        "naturales brasilenos",
    ),
    "robustas": ("robustas (us por libra)", "robustas"),
}

# columnas opcionales: se capturan si están presentes (el Excel real ya
# trae estos spreads precalculados), pero no son obligatorias.
OPTIONAL_COLUMNS: dict[str, tuple[str, ...]] = {
    "spread_col_milds_vs_bra_naturals": ("spread col milds vs bra naturals",),
    "spread_col_milds_vs_bra_robustas": ("spread col milds vs bra robustas",),
}


class ExcelValidationError(Exception):
    """El Excel manual no tiene el formato acordado (falta columna o tipo inválido)."""


@dataclass
class OICPriceRow:
    fecha: pd.Timestamp
    ico_composite: Optional[float]
    colombian_milds: Optional[float]
    other_milds: Optional[float]
    brazilian_naturals: Optional[float]
    robustas: Optional[float]
    spread_col_milds_vs_bra_naturals: Optional[float] = None
    spread_col_milds_vs_bra_robustas: Optional[float] = None


def _normalize(name: str) -> str:
    text = unicodedata.normalize("NFKD", str(name)).encode("ascii", "ignore").decode("ascii")
    text = text.strip().lower()
    return re.sub(r"\s+", " ", text)


def _match_columns(columns: list[str], schema: dict[str, tuple[str, ...]]) -> dict[str, str]:
    """Mapea cada columna canónica de `schema` a su nombre real en el DataFrame."""
    normalized_to_original = {_normalize(c): c for c in columns}
    resolved: dict[str, str] = {}
    for canonical, aliases in schema.items():
        for alias in aliases:
            if alias in normalized_to_original:
                resolved[canonical] = normalized_to_original[alias]
                break
    return resolved


def _to_optional_float(value) -> Optional[float]:
    if pd.isna(value):
        return None
    return float(value)


def read_oic_prices(
    path: Union[Path, str] = DEFAULT_MANUAL_EXCEL_PATH, *, sheet_name: Union[str, int] = 0
) -> list[OICPriceRow]:
    """Lee y valida el Excel manual de precios OIC.

    Lanza ExcelValidationError si el archivo no existe, si no se puede
    parsear como Excel, si falta alguna columna esperada, o si la columna
    de fecha no se puede interpretar como fecha — fallo rápido y
    descriptivo en vez de propagar datos con formato inesperado al resto
    del pipeline.
    """
    path = Path(path)
    if not path.exists():
        raise ExcelValidationError(
            f"No se encontró el Excel manual en {path}. Debe subirse a mano en esa ruta fija "
            "antes de correr el pipeline (ver Fase 3 del blueprint)."
        )

    try:
        df = pd.read_excel(path, sheet_name=sheet_name, engine="openpyxl")
    except Exception as exc:
        raise ExcelValidationError(f"No se pudo leer {path} como Excel: {exc}") from exc

    resolved = _match_columns(list(df.columns), EXPECTED_COLUMNS)
    missing = set(EXPECTED_COLUMNS) - set(resolved)
    if missing:
        raise ExcelValidationError(
            f"Al Excel manual {path} le faltan columnas esperadas: {', '.join(sorted(missing))}. "
            f"Columnas encontradas: {list(df.columns)}. Esquema esperado documentado en "
            "scripts/read_excel.py (EXPECTED_COLUMNS)."
        )

    resolved_optional = _match_columns(list(df.columns), OPTIONAL_COLUMNS)

    all_resolved = {**resolved, **resolved_optional}
    df = df.rename(columns={original: canonical for canonical, original in all_resolved.items()})
    present_canonical_columns = list(EXPECTED_COLUMNS) + list(resolved_optional)
    df = df[present_canonical_columns]

    try:
        df["fecha"] = pd.to_datetime(df["fecha"])
    except Exception as exc:
        raise ExcelValidationError(
            f"La columna de fecha de {path} no se pudo interpretar como fecha: {exc}"
        ) from exc

    df = df.dropna(subset=["fecha"])

    return [
        OICPriceRow(
            fecha=row["fecha"],
            ico_composite=_to_optional_float(row["ico_composite"]),
            colombian_milds=_to_optional_float(row["colombian_milds"]),
            other_milds=_to_optional_float(row["other_milds"]),
            brazilian_naturals=_to_optional_float(row["brazilian_naturals"]),
            robustas=_to_optional_float(row["robustas"]),
            spread_col_milds_vs_bra_naturals=_to_optional_float(
                row["spread_col_milds_vs_bra_naturals"]
            )
            if "spread_col_milds_vs_bra_naturals" in df.columns
            else None,
            spread_col_milds_vs_bra_robustas=_to_optional_float(
                row["spread_col_milds_vs_bra_robustas"]
            )
            if "spread_col_milds_vs_bra_robustas" in df.columns
            else None,
        )
        for _, row in df.iterrows()
    ]
