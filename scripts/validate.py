"""Reglas de sanidad sobre el dataset consolidado, antes de publicarlo.

Distingue dos niveles, según lo acordado con el equipo:

- **Crítico** (`DatasetValidationError`): la serie diaria de OIC está
  vacía, tiene fechas futuras o duplicadas, algún precio está fuera de
  rango, o una cotización de mercado es nula sin haber sido descartada a
  propósito (`discarded_intraday`). Fase 5 (`main.py`) debe capturar esta
  excepción y hacer `sys.exit(1)` — así el job de Actions falla y nadie
  publica un dashboard con datos corruptos en silencio.
- **Advertencia** (se acumula en `ValidationResult.warnings`, no aborta):
  una fuente opcional falta o vino vacía (cotización descartada por ser
  antes de las 2pm, Producción/Valor cosecha/Exportaciones ausentes) — el
  pipeline igual publica, pero el dashboard debería mostrar esas
  advertencias para que quede claro qué está pendiente o desactualizado.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date

from consolidate import ConsolidatedDataset

# Rango razonable de precios OIC/Contrato C en US¢ por libra: por debajo de
# 0 o por encima de este techo es casi seguro un error de parseo, no un
# precio real de mercado.
PRICE_MIN = 0.0
PRICE_MAX = 1000.0


class DatasetValidationError(Exception):
    """El dataset consolidado tiene un problema crítico: no se debe publicar."""


@dataclass
class ValidationResult:
    warnings: list[str] = field(default_factory=list)

    def warn(self, message: str) -> None:
        self.warnings.append(message)


def _check_price_range(value: float | None, *, campo: str, fecha: date, errors: list[str]) -> None:
    if value is None:
        return
    if not (PRICE_MIN < value < PRICE_MAX):
        errors.append(f"{campo}={value} fuera de rango ({PRICE_MIN}, {PRICE_MAX}) en {fecha}")


def validate_dataset(dataset: ConsolidatedDataset, *, today: date | None = None) -> ValidationResult:
    """Valida `dataset` y devuelve las advertencias no fatales.

    Lanza DatasetValidationError en el primer problema crítico encontrado
    (con todos los detalles agregados en el mensaje, no solo el primero,
    para no obligar a corregir uno por uno).
    """
    today = today or date.today()
    result = ValidationResult()
    errors: list[str] = []

    if not dataset.serie_diaria:
        errors.append("La serie diaria de OIC está vacía.")
    else:
        seen_dates: set[date] = set()
        for row in dataset.serie_diaria:
            if row.fecha > today:
                errors.append(f"Fecha futura en la serie diaria: {row.fecha} (hoy: {today}).")
            if row.fecha in seen_dates:
                errors.append(f"Fecha duplicada en la serie diaria: {row.fecha}.")
            seen_dates.add(row.fecha)

            _check_price_range(row.ico_composite, campo="ico_composite", fecha=row.fecha, errors=errors)
            _check_price_range(
                row.colombian_milds, campo="colombian_milds", fecha=row.fecha, errors=errors
            )
            _check_price_range(row.other_milds, campo="other_milds", fecha=row.fecha, errors=errors)
            _check_price_range(
                row.brazilian_naturals, campo="brazilian_naturals", fecha=row.fecha, errors=errors
            )
            _check_price_range(row.robustas, campo="robustas", fecha=row.fecha, errors=errors)
            _check_price_range(row.contrato_c, campo="contrato_c", fecha=row.fecha, errors=errors)

        if not any(row.contrato_c is not None for row in dataset.serie_diaria):
            result.warn(
                "Ninguna fecha de la serie diaria tiene Contrato C histórico — el diferencial "
                "UGQ quedó vacío en todo el dataset."
            )

    for quote in dataset.cotizaciones_actuales:
        if quote.value is None and not quote.discarded_intraday:
            errors.append(
                f"Cotización de {quote.label} ({quote.ticker}) es nula sin haber sido descartada "
                "por la regla de las 2pm — la fuente pudo haber fallado sin avisar."
            )
        elif quote.discarded_intraday:
            result.warn(
                f"Cotización de {quote.label} ({quote.ticker}) descartada: corrida antes de las "
                "2pm hora local, mercado sin cerrar."
            )

    if not dataset.produccion_mensual:
        result.warn("Producción mensual de la FNC vino vacía o no se procesó en esta corrida.")
    if not dataset.valor_cosecha.por_anio_calendario and not dataset.valor_cosecha.por_anio_cafetero:
        result.warn("Valor cosecha de la FNC vino vacío o no se procesó en esta corrida.")
    if dataset.exportaciones is None:
        result.warn(
            "Exportaciones de la FNC no está implementado todavía (parse_fnc_exports pendiente)."
        )

    if errors:
        raise DatasetValidationError(
            f"{len(errors)} problema(s) crítico(s) en el dataset consolidado:\n"
            + "\n".join(f"- {e}" for e in errors)
        )

    return result
