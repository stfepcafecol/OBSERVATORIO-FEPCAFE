"""Scraping de fuentes web para el pipeline del Observatorio FEPCafé.

Una función por fuente. Cada función retorna una estructura de datos
tipada (dataclass) con esquema fijo, nunca HTML/bytes crudos hacia el
resto del pipeline. Si una fuente no responde o cambia su estructura
esperada, se lanza una excepción explícita (ver ScrapeError y
subclases) — nunca un fallo silencioso.
"""

from __future__ import annotations

import logging
import re
import time
from dataclasses import dataclass
from datetime import date, datetime
from typing import Optional

import requests
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

FNC_STATS_URL = "https://federaciondecafeteros.org/wp/estadisticas-cafeteras/"
REQUEST_TIMEOUT = 30  # segundos
MAX_RETRIES = 3
BACKOFF_BASE_SECONDS = 2

# Regla del notebook original: antes de esta hora local se descarta el dato
# del día porque el mercado (ICE / FX) todavía no cerró.
MARKET_CLOSE_HOUR_LOCAL = 14

MARKET_TICKERS = {
    "KC=F": "Contrato C (café, ICE)",
    "USDBRL=X": "USD/BRL",
    "COP=X": "USD/COP",
}


class ScrapeError(Exception):
    """Error explícito de scraping: base de las excepciones de este módulo."""


class SourceUnavailableError(ScrapeError):
    """La fuente no respondió tras agotar los reintentos."""


class SourceStructureChangedError(ScrapeError):
    """La fuente respondió pero no se encontró lo esperado (ej. link de Excel)."""


@dataclass
class FNCExcelLink:
    label: str  # "Precios" o "Exportaciones"
    url: str
    fetched_at: datetime


@dataclass
class FNCExcelFile:
    label: str
    url: str
    content: bytes  # bytes crudos del .xlsx, para que read_excel.py los procese
    fetched_at: datetime


@dataclass
class MarketQuote:
    ticker: str
    label: str
    value: Optional[float]
    quote_date: Optional[date]
    fetched_at: datetime
    discarded_intraday: bool = False  # True si se descartó por ser antes de las 2pm


def _request_with_retries(
    url: str, *, timeout: int = REQUEST_TIMEOUT, max_retries: int = MAX_RETRIES
) -> requests.Response:
    """GET con reintentos y backoff exponencial.

    Lanza SourceUnavailableError si se agotan los reintentos sin éxito.
    """
    last_exc: Optional[Exception] = None
    for attempt in range(1, max_retries + 1):
        try:
            response = requests.get(
                url,
                timeout=timeout,
                headers={"User-Agent": "Mozilla/5.0 (Observatorio-FEPCafe pipeline)"},
            )
            response.raise_for_status()
            return response
        except requests.RequestException as exc:
            last_exc = exc
            wait = BACKOFF_BASE_SECONDS**attempt
            logger.warning(
                "Intento %d/%d fallido para %s: %s (reintentando en %ds)",
                attempt,
                max_retries,
                url,
                exc,
                wait,
            )
            if attempt < max_retries:
                time.sleep(wait)
    raise SourceUnavailableError(
        f"No se pudo obtener {url} tras {max_retries} intentos: {last_exc}"
    ) from last_exc


def fetch_fnc_excel_links(stats_url: str = FNC_STATS_URL) -> list[FNCExcelLink]:
    """Busca los links de descarga de Excel de "Precios" y "Exportaciones".

    Recorre los `<a href>` de la página de estadísticas cafeteras de la FNC
    y matchea por regex sobre el href y el texto del link. Lanza
    SourceStructureChangedError si no encuentra alguno de los dos — señal
    de que el sitio cambió su HTML y el regex necesita actualizarse.
    """
    response = _request_with_retries(stats_url)
    soup = BeautifulSoup(response.content, "html.parser")

    patterns = {
        "Precios": re.compile(r"precios", re.IGNORECASE),
        "Exportaciones": re.compile(r"exportaciones", re.IGNORECASE),
    }

    found: dict[str, str] = {}
    for anchor in soup.find_all("a", href=True):
        href = anchor["href"]
        text = anchor.get_text(strip=True)
        haystack = f"{href} {text}"
        for label, pattern in patterns.items():
            if label not in found and pattern.search(haystack):
                found[label] = href

    missing = set(patterns) - set(found)
    if missing:
        raise SourceStructureChangedError(
            f"No se encontraron links para: {', '.join(sorted(missing))} en {stats_url}. "
            "El sitio de la FNC pudo haber cambiado su estructura HTML."
        )

    fetched_at = datetime.utcnow()
    return [
        FNCExcelLink(label=label, url=url, fetched_at=fetched_at)
        for label, url in found.items()
    ]


def download_fnc_excel(link: FNCExcelLink) -> FNCExcelFile:
    """Descarga el contenido binario del Excel referenciado por un FNCExcelLink."""
    response = _request_with_retries(link.url)
    content_type = response.headers.get("Content-Type", "")
    looks_like_excel = (
        "sheet" in content_type
        or "excel" in content_type
        or link.url.lower().endswith((".xlsx", ".xls"))
    )
    if not looks_like_excel:
        raise SourceStructureChangedError(
            f"El link '{link.label}' ({link.url}) no parece apuntar a un archivo Excel "
            f"(Content-Type: {content_type or 'desconocido'})."
        )
    return FNCExcelFile(
        label=link.label, url=link.url, content=response.content, fetched_at=datetime.utcnow()
    )


def fetch_fnc_excels(stats_url: str = FNC_STATS_URL) -> list[FNCExcelFile]:
    """Encuentra los links de Precios/Exportaciones de la FNC y descarga ambos Excel."""
    links = fetch_fnc_excel_links(stats_url)
    return [download_fnc_excel(link) for link in links]


def fetch_market_quote(
    ticker: str, label: Optional[str] = None, *, now: Optional[datetime] = None
) -> MarketQuote:
    """Obtiene la última cotización de `ticker` vía yfinance.

    Si la hora local actual es antes de las 2pm, el dato del día se
    descarta (`discarded_intraday=True`, `value=None`) porque el mercado
    aún no cerró — regla tomada del notebook original.
    """
    import yfinance as yf  # import perezoso: solo se necesita si se llama esta función

    label = label or MARKET_TICKERS.get(ticker, ticker)
    now = now or datetime.now()
    fetched_at = datetime.utcnow()

    if now.hour < MARKET_CLOSE_HOUR_LOCAL:
        logger.info(
            "Descartando cotización intradía de %s (%s): hora local %d < %d",
            ticker,
            label,
            now.hour,
            MARKET_CLOSE_HOUR_LOCAL,
        )
        return MarketQuote(
            ticker=ticker,
            label=label,
            value=None,
            quote_date=None,
            fetched_at=fetched_at,
            discarded_intraday=True,
        )

    try:
        history = yf.Ticker(ticker).history(period="5d")
    except Exception as exc:  # yfinance no expone una jerarquía de excepciones propia
        raise SourceUnavailableError(
            f"No se pudo obtener la cotización de {ticker} ({label}): {exc}"
        ) from exc

    if history.empty:
        raise SourceStructureChangedError(f"yfinance no devolvió datos para {ticker} ({label}).")

    last_close = float(history.iloc[-1]["Close"])
    quote_date = history.index[-1].date()
    return MarketQuote(
        ticker=ticker, label=label, value=last_close, quote_date=quote_date, fetched_at=fetched_at
    )


def fetch_all_market_quotes(*, now: Optional[datetime] = None) -> list[MarketQuote]:
    """Obtiene el Contrato C, USD/BRL y USD/COP en una sola llamada."""
    return [fetch_market_quote(ticker, label, now=now) for ticker, label in MARKET_TICKERS.items()]


def fetch_oic_prices(*_args, **_kwargs):
    """Pendiente: la OIC no tiene una URL de descarga automática identificada.

    En el notebook de referencia, el precio ICO composite y Colombian Milds
    se extraen vía `camelot` de un PDF (`I-CIP.pdf`) descargado a mano. Hasta
    confirmar una URL estable de descarga, esta fuente no se automatiza —
    ver README, sección "Riesgo a vigilar".
    """
    raise NotImplementedError(
        "fetch_oic_prices no está implementado: no hay URL de descarga automática "
        "identificada para el PDF de la OIC (I-CIP.pdf). Requiere descarga manual "
        "y extracción vía camelot; ver sección 2.1 del blueprint."
    )
