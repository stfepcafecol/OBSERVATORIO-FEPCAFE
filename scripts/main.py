"""Punto de entrada único del pipeline: scrape → read_excel → consolidate → validate → export.

Corre con:

    python scripts/main.py

Reglas de fallo, acordadas con el equipo (ver README):
- El Excel manual de OIC (`read_excel.read_oic_prices`) es el corazón del
  dashboard: si falla, el pipeline aborta y sale con código 1.
- Las fuentes secundarias (Excel de Precios de la FNC, histórico de
  Contrato C, cotizaciones actuales de mercado) fallan "suave": si
  scrape.py no puede obtenerlas o el formato cambió, el pipeline sigue
  con esa fuente vacía y una advertencia — no se aborta por una fuente
  secundaria caída.
- validate.py puede seguir encontrando problemas críticos incluso con
  todas las fuentes obtenidas (fechas futuras, precios fuera de rango,
  etc.) — eso también aborta el pipeline con código 1.

Las advertencias (fuente faltante, cotización descartada por intradía,
etc.) quedan tanto en el log como dentro de data/output/dataset.json,
para que el dashboard las pueda mostrar al usuario final.
"""

from __future__ import annotations

import json
import logging
import sys
from dataclasses import asdict
from datetime import date, datetime
from pathlib import Path
from typing import Any, Optional

import consolidate
import read_excel
import scrape
import validate

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)

OUTPUT_PATH = Path("data/output/dataset.json")

# Coincide con consolidate.UGQ_DIFFERENTIAL_SINCE: no tiene sentido traer
# histórico de Contrato C de antes de esa fecha, no se va a usar.
CONTRATO_C_HISTORY_START = consolidate.UGQ_DIFFERENTIAL_SINCE.isoformat()


def _fetch_oic_rows() -> list[read_excel.OICPriceRow]:
    """Lee el Excel manual de OIC. Fatal si falla — se deja propagar la excepción."""
    logger.info("Leyendo Excel manual de precios OIC...")
    rows = read_excel.read_oic_prices()
    logger.info("OIC: %d filas leídas.", len(rows))
    return rows


def _fetch_fnc_precios(
    fnc_precios_url: str = scrape.FNC_STATS_URL,
) -> tuple[list[consolidate.FNCProductionRow], consolidate.FNCHarvestValueData]:
    """Descarga y parsea el Excel de Precios de la FNC. Falla suave: advierte y sigue."""
    logger.info("Descargando Excel de Precios de la FNC...")
    try:
        excels = scrape.fetch_fnc_excels(fnc_precios_url)
    except scrape.ScrapeError as exc:
        logger.warning("No se pudo descargar el Excel de Precios de la FNC: %s", exc)
        return [], consolidate.FNCHarvestValueData(por_anio_calendario=[], por_anio_cafetero=[])

    precios = next((e for e in excels if e.label == "Precios"), None)
    if precios is None:
        logger.warning("fetch_fnc_excels no devolvió un archivo etiquetado 'Precios'.")
        return [], consolidate.FNCHarvestValueData(por_anio_calendario=[], por_anio_cafetero=[])

    try:
        produccion_mensual = consolidate.parse_fnc_production(precios.content)
        valor_cosecha = consolidate.parse_fnc_harvest_value(precios.content)
    except consolidate.FNCSheetStructureError as exc:
        logger.warning("No se pudo parsear el Excel de Precios de la FNC: %s", exc)
        return [], consolidate.FNCHarvestValueData(por_anio_calendario=[], por_anio_cafetero=[])

    logger.info(
        "FNC Precios: %d filas de producción mensual, %d años de valor de cosecha.",
        len(produccion_mensual),
        len(valor_cosecha.por_anio_calendario),
    )
    return produccion_mensual, valor_cosecha


def _fetch_contrato_c_history() -> list[scrape.MarketQuote]:
    """Histórico diario de Contrato C, para el diferencial UGQ. Falla suave."""
    logger.info("Descargando histórico de Contrato C (KC=F) desde %s...", CONTRATO_C_HISTORY_START)
    try:
        history = scrape.fetch_market_quote_history("KC=F", start=CONTRATO_C_HISTORY_START)
    except scrape.ScrapeError as exc:
        logger.warning("No se pudo obtener el histórico de Contrato C: %s", exc)
        return []
    logger.info("Contrato C: %d cotizaciones históricas.", len(history))
    return history


def _fetch_market_quotes() -> list[scrape.MarketQuote]:
    """Snapshot de Contrato C / USD-BRL / USD-COP para el dashboard. Falla suave."""
    logger.info("Obteniendo cotizaciones actuales de mercado...")
    try:
        quotes = scrape.fetch_all_market_quotes()
    except scrape.ScrapeError as exc:
        logger.warning("No se pudieron obtener las cotizaciones actuales de mercado: %s", exc)
        return []
    logger.info("Cotizaciones actuales: %d obtenidas.", len(quotes))
    return quotes


def _json_default(value: Any) -> Any:
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    raise TypeError(f"Tipo no serializable a JSON: {type(value)!r}")


def run() -> dict:
    """Ejecuta el pipeline completo y devuelve el dict listo para volcar a JSON.

    Deja propagar ExcelValidationError (Excel de OIC roto) y
    DatasetValidationError (dataset consolidado con problemas críticos) —
    `main()` las captura y hace sys.exit(1).
    """
    oic_rows = _fetch_oic_rows()

    produccion_mensual, valor_cosecha = _fetch_fnc_precios()
    contrato_c_history = _fetch_contrato_c_history()
    market_quotes = _fetch_market_quotes()

    logger.info("Consolidando dataset...")
    dataset = consolidate.consolidate(
        oic_rows=oic_rows,
        contrato_c_history=contrato_c_history,
        market_quotes=market_quotes,
        produccion_mensual=produccion_mensual,
        valor_cosecha=valor_cosecha,
    )

    logger.info("Validando dataset...")
    result = validate.validate_dataset(dataset)
    for warning in result.warnings:
        logger.warning(warning)

    return {
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "warnings": result.warnings,
        "serie_diaria": [asdict(row) for row in dataset.serie_diaria],
        "cotizaciones_actuales": [asdict(q) for q in dataset.cotizaciones_actuales],
        "produccion_mensual": [asdict(row) for row in dataset.produccion_mensual],
        "valor_cosecha": asdict(dataset.valor_cosecha),
        "exportaciones": dataset.exportaciones,
    }


def main(output_path: Optional[Path] = None) -> None:
    output_path = output_path or OUTPUT_PATH

    try:
        output = run()
    except (read_excel.ExcelValidationError, validate.DatasetValidationError) as exc:
        logger.error("Pipeline abortado: %s", exc)
        sys.exit(1)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(output, ensure_ascii=False, indent=2, default=_json_default), encoding="utf-8"
    )
    logger.info(
        "Dataset escrito en %s (%d filas en serie_diaria, %d advertencias).",
        output_path,
        len(output["serie_diaria"]),
        len(output["warnings"]),
    )


if __name__ == "__main__":
    main()
