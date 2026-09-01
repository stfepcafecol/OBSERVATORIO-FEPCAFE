"""Consolida las fuentes de scrape.py y read_excel.py en el dataset del dashboard.

Combina:
- La serie diaria de precios OIC (`read_excel.read_oic_prices`) con el
  diferencial UGQ (Colombian Milds − Contrato C) y el año cafetero
  calculados sobre cada fecha.
- Las cotizaciones de mercado más recientes (`scrape.fetch_all_market_quotes`)
  como snapshot aparte — no se mezclan con la serie diaria de OIC porque
  scrape.py solo trae el último cierre, no histórico, para esos tickers.
- Las hojas del Excel de "Precios" de la FNC que ya se pudieron verificar
  contra un archivo real: Producción mensual y Valor cosecha.

Exportaciones (hojas "Total_Volumen"/"Total_Valor") queda pendiente:
la FNC las publica en un Excel de "Exportaciones" aparte que todavía no
se compartió para verificar su estructura — `parse_fnc_exports` lanza
NotImplementedError a propósito, mismo patrón que `scrape.fetch_oic_prices`.

`consolidate()` solo arma el dataset a partir de piezas ya obtenidas — no
descarga ni parsea nada por sí mismo. Obtener cada fuente y decidir qué
hacer si falla (abortar vs. continuar con advertencia) es responsabilidad
de `main.py` (Fase 5), que sí importa y llama a `parse_fnc_production` /
`parse_fnc_harvest_value` directamente antes de pasarle el resultado a
`consolidate()`.
"""

from __future__ import annotations

import io
import re
from dataclasses import dataclass
from datetime import date
from typing import Optional, Union

import pandas as pd

from read_excel import OICPriceRow
from scrape import MarketQuote

# Desde esta fecha hay serie diaria de la OIC y tiene sentido el diferencial UGQ.
UGQ_DIFFERENTIAL_SINCE = date(2019, 7, 1)

# Nombres de hoja confirmados contra el archivo real
# (PreciosAreaYProduccionDeCafe...xlsx). El notebook de referencia los
# llamaba "9."/"10."; en el archivo real son "8."/"9." — puede variar
# entre publicaciones mensuales de la FNC, por eso el parseo busca las
# hojas por nombre exacto pero localiza filas/columnas por contenido, no
# por posición fija.
FNC_PRODUCTION_SHEET = "8. Producción mensual"
FNC_HARVEST_VALUE_SHEET = "9. Valor cosecha"


class FNCSheetStructureError(Exception):
    """La hoja de la FNC no tiene la estructura esperada (etiqueta no encontrada)."""


@dataclass
class FNCProductionRow:
    mes: date
    produccion_miles_sacos_60kg: Optional[float]


@dataclass
class FNCHarvestValueRow:
    anio: str  # "2000" (año calendario) o "2000/01" (año cafetero)
    valor_cosecha_millones_cop: Optional[float]


@dataclass
class FNCHarvestValueData:
    por_anio_calendario: list[FNCHarvestValueRow]
    por_anio_cafetero: list[FNCHarvestValueRow]


@dataclass
class DailySeriesRow:
    fecha: date
    ico_composite: Optional[float]
    colombian_milds: Optional[float]
    other_milds: Optional[float]
    brazilian_naturals: Optional[float]
    robustas: Optional[float]
    ano_cafetero: str
    contrato_c: Optional[float] = None
    diferencial_ugq: Optional[float] = None


@dataclass
class ConsolidatedDataset:
    serie_diaria: list[DailySeriesRow]
    cotizaciones_actuales: list[MarketQuote]
    produccion_mensual: list[FNCProductionRow]
    valor_cosecha: FNCHarvestValueData
    exportaciones: None = None  # pendiente, ver parse_fnc_exports


def compute_ano_cafetero(fecha: Union[date, pd.Timestamp]) -> str:
    """Año cafetero colombiano: octubre a septiembre.

    Si el mes es < 10 (antes de octubre), el año cafetero empezó el año
    calendario anterior; si es >= 10, empezó el año calendario actual.
    Formato "AAAA/AA", igual al que ya usa la FNC en la hoja de Valor
    cosecha (ej. "2019/20").
    """
    start_year = fecha.year - 1 if fecha.month < 10 else fecha.year
    return f"{start_year}/{str(start_year + 1)[-2:]}"


def _to_optional_float(value) -> Optional[float]:
    if value is None or (isinstance(value, float) and pd.isna(value)) or pd.isna(value):
        return None
    return float(value)


def _normalize_label(text) -> str:
    return re.sub(r"\s+", " ", str(text)).strip().lower()


def _find_label_cell(df: pd.DataFrame, label: str) -> Optional[tuple[int, int]]:
    """Busca una celda cuyo texto (normalizado) sea exactamente `label`.

    Las hojas de la FNC traen varias filas de metadatos (título, unidad,
    fuente) antes del encabezado real, y la posición de las columnas
    puede variar de una publicación a otra — por eso se busca por
    contenido en vez de asumir una fila/columna fija.
    """
    target = _normalize_label(label)
    for row_idx in range(df.shape[0]):
        for col_idx in range(df.shape[1]):
            value = df.iat[row_idx, col_idx]
            if isinstance(value, str) and _normalize_label(value) == target:
                return row_idx, col_idx
    return None


def parse_fnc_production(
    content: bytes, *, sheet_name: str = FNC_PRODUCTION_SHEET
) -> list[FNCProductionRow]:
    """Parsea la hoja de Producción mensual del Excel de Precios de la FNC.

    Busca la columna "Mes" (la de valores está inmediatamente a su
    derecha) y lee desde ahí hasta el final de la hoja. Lanza
    FNCSheetStructureError si no encuentra la columna esperada — señal
    de que la FNC cambió el formato del reporte.
    """
    df = pd.read_excel(io.BytesIO(content), sheet_name=sheet_name, header=None)

    header_cell = _find_label_cell(df, "Mes")
    if header_cell is None:
        raise FNCSheetStructureError(
            f"No se encontró la columna 'Mes' en la hoja '{sheet_name}'. "
            "La FNC pudo haber cambiado el formato del reporte de Producción mensual."
        )
    header_row, mes_col = header_cell
    value_col = mes_col + 1

    data = df.iloc[header_row + 1 :, [mes_col, value_col]].copy()
    data.columns = ["mes", "produccion"]
    data = data.dropna(subset=["mes"])

    return [
        FNCProductionRow(
            mes=pd.Timestamp(row["mes"]).date(),
            produccion_miles_sacos_60kg=_to_optional_float(row["produccion"]),
        )
        for _, row in data.iterrows()
    ]


def _extract_year_value_series(
    df: pd.DataFrame, header_cell: tuple[int, int]
) -> list[FNCHarvestValueRow]:
    header_row, year_col = header_cell
    value_col = year_col + 1
    data = df.iloc[header_row + 1 :, [year_col, value_col]].copy()
    data.columns = ["anio", "valor"]
    data = data.dropna(subset=["anio", "valor"])  # descarta años futuros sin dato aún
    return [
        FNCHarvestValueRow(
            anio=str(row["anio"]).strip(),
            valor_cosecha_millones_cop=_to_optional_float(row["valor"]),
        )
        for _, row in data.iterrows()
    ]


def parse_fnc_harvest_value(
    content: bytes, *, sheet_name: str = FNC_HARVEST_VALUE_SHEET
) -> FNCHarvestValueData:
    """Parsea la hoja de Valor cosecha del Excel de Precios de la FNC.

    La hoja trae dos tablas lado a lado: Valor de la cosecha por año
    calendario y por año cafetero. Se descartan filas de años futuros sin
    valor aún (la FNC deja esas filas en el reporte como placeholder).
    """
    df = pd.read_excel(io.BytesIO(content), sheet_name=sheet_name, header=None)

    calendar_cell = _find_label_cell(df, "Año Calendario")
    coffee_year_cell = _find_label_cell(df, "Año Cafetero")
    if calendar_cell is None or coffee_year_cell is None:
        missing = [
            label
            for label, cell in (("Año Calendario", calendar_cell), ("Año Cafetero", coffee_year_cell))
            if cell is None
        ]
        raise FNCSheetStructureError(
            f"No se encontraron las columnas {missing} en la hoja '{sheet_name}'. "
            "La FNC pudo haber cambiado el formato del reporte de Valor cosecha."
        )

    return FNCHarvestValueData(
        por_anio_calendario=_extract_year_value_series(df, calendar_cell),
        por_anio_cafetero=_extract_year_value_series(df, coffee_year_cell),
    )


def parse_fnc_exports(*_args, **_kwargs):
    """Pendiente: la FNC publica Exportaciones en un Excel aparte al de Precios.

    No se ha compartido un archivo de ejemplo para verificar la estructura
    de las hojas "1. Total_Volumen" y "2. Total_Valor" que menciona el
    notebook de referencia — hasta entonces, no se adivina el formato.
    """
    raise NotImplementedError(
        "parse_fnc_exports no está implementado: falta un archivo de ejemplo del Excel de "
        "Exportaciones de la FNC para verificar la estructura real de sus hojas."
    )


def build_daily_series(
    oic_rows: list[OICPriceRow],
    contrato_c_history: list[MarketQuote],
    *, since: date = UGQ_DIFFERENTIAL_SINCE,
) -> list[DailySeriesRow]:
    """Une la serie diaria de la OIC con el histórico de Contrato C por fecha.

    Calcula el diferencial UGQ (Colombian Milds − Contrato C) y el año
    cafetero para cada fecha. Si no hay cotización de Contrato C para una
    fecha de la OIC (día sin mercado, feriado, etc.), el diferencial queda
    en None para esa fila en vez de inventar un valor o descartar la fila.
    """
    contrato_c_by_date = {q.quote_date: q.value for q in contrato_c_history if q.value is not None}

    rows = []
    for oic in oic_rows:
        fecha = oic.fecha.date() if isinstance(oic.fecha, pd.Timestamp) else oic.fecha
        if fecha < since:
            continue

        contrato_c = contrato_c_by_date.get(fecha)
        diferencial = (
            oic.colombian_milds - contrato_c
            if contrato_c is not None and oic.colombian_milds is not None
            else None
        )

        rows.append(
            DailySeriesRow(
                fecha=fecha,
                ico_composite=oic.ico_composite,
                colombian_milds=oic.colombian_milds,
                other_milds=oic.other_milds,
                brazilian_naturals=oic.brazilian_naturals,
                robustas=oic.robustas,
                ano_cafetero=compute_ano_cafetero(fecha),
                contrato_c=contrato_c,
                diferencial_ugq=diferencial,
            )
        )
    return rows


def consolidate(
    *,
    oic_rows: list[OICPriceRow],
    contrato_c_history: list[MarketQuote],
    market_quotes: list[MarketQuote],
    produccion_mensual: Optional[list[FNCProductionRow]] = None,
    valor_cosecha: Optional[FNCHarvestValueData] = None,
) -> ConsolidatedDataset:
    """Arma el ConsolidatedDataset a partir de las piezas ya obtenidas/parseadas.

    Este módulo no decide qué hacer si una fuente falló — eso es
    responsabilidad de quien orquesta (`main.py`, Fase 5), que intenta
    obtener y parsear cada fuente y decide si continuar con advertencia
    o abortar. Por eso `produccion_mensual`/`valor_cosecha` llegan ya
    resueltos (o vacíos) en vez de que `consolidate()` intente parsear un
    Excel crudo y pueda hacer explotar la consolidación completa por un
    cambio de formato en una fuente secundaria.
    """
    serie_diaria = build_daily_series(oic_rows, contrato_c_history)

    return ConsolidatedDataset(
        serie_diaria=serie_diaria,
        cotizaciones_actuales=market_quotes,
        produccion_mensual=produccion_mensual or [],
        valor_cosecha=valor_cosecha or FNCHarvestValueData(por_anio_calendario=[], por_anio_cafetero=[]),
    )
