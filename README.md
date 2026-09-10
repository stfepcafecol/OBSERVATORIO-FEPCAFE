# OBSERVATORIO-FEPCAF-

Repositorio creado para el procesamiento de datos relacionados con el Observatorio de datos FEPCafé.

## Pipeline de dashboard automatizado

Este repositorio está siendo construido siguiendo el blueprint del pipeline que consolida datos de
scraping web (FNC, mercado vía `yfinance`) y de un Excel de precios OIC cargado manualmente, genera
un dataset y lo publica en un dashboard HTML estático vía GitHub Pages.

### Arquitectura general

```
[Excel manual de precios OIC] ──push a data/manual/──┐
                                                      ├──▶ Script Python ──▶ data/output/*.json ──▶ Dashboard HTML (GitHub Pages)
[Scraping web: FNC + mercado] ──dispara el mismo workflow──┘
```

- **Scraping automático** (`scripts/scrape.py`, Fase 2): Precios y Exportaciones de la FNC
  (scraping HTML + descarga de Excel) y Contrato C / USD-BRL / USD-COP vía `yfinance`.
- **Excel manual** (`scripts/read_excel.py`, Fase 3): `data/manual/BD_precios_ICO_actualizada.xlsx`
  con los precios de la OIC (ICO Composite, Colombian Milds, Otros Suaves, Naturales, Robustas) —
  la OIC no tiene URL de descarga automática identificada, así que estos precios (originalmente
  extraídos de un PDF vía `camelot`) se actualizan y suben a mano a esa ruta fija.
- **Disparadores**: `push` sobre `data/manual/**` (subir un Excel nuevo dispara la corrida) +
  `workflow_dispatch` (corrida manual desde la pestaña Actions). **Sin `schedule`/cron a propósito**
  — ver Fase 6 abajo.
- **Salida del script**: uno o más JSON/CSV en `data/output/`, versionados en el repo.
- **Dashboard**: HTML/CSS/JS estático que hace `fetch` de los JSON en `data/output/` — sin backend,
  sin build step.
- **Despliegue**: GitHub Pages vía `actions/deploy-pages`, publicando el repositorio completo como
  artifact (así `dashboard/index.html` puede seguir haciendo `fetch('../data/output/dataset.json')`
  con rutas relativas, sin tener que copiar archivos entre carpetas).

### Estructura de repositorio

```
/
├── .github/
│   └── workflows/
│       └── update-dashboard.yml   # workflow de CI/CD (Fase 6)
├── scripts/
│   ├── scrape.py           # extracción de fuentes web (Fase 2)
│   ├── read_excel.py       # lectura y normalización del Excel manual (Fase 3)
│   ├── consolidate.py      # une ambas fuentes, calcula métricas (Fase 4)
│   ├── validate.py         # valida rangos/columnas antes de publicar (Fase 4)
│   └── main.py             # orquesta scrape → read_excel → consolidate → validate → export (Fase 5)
├── data/
│   ├── manual/              # Excel de precios OIC subido a mano (ruta fija y estable)
│   │   └── BD_precios_ICO_actualizada.xlsx
│   └── output/               # JSON/CSV generados (se sobrescriben cada corrida)
│       └── dataset.json
├── dashboard/               # Fase 7 — sin librerías externas, sin build step
│   ├── index.html
│   ├── style.css
│   └── app.js
├── tests/
│   └── test_consolidate.py  # Fase 8 — pendiente
├── requirements.txt
└── README.md
```

### Estado actual

- **Fase 1 (scaffolding)**: hecha. Estructura de carpetas creada.
- **Fase 2 (`scripts/scrape.py`)**: hecha para las fuentes con URL de descarga identificada:
  - `fetch_fnc_excels` — Precios y Exportaciones de la FNC (scraping HTML + descarga de Excel).
  - `fetch_all_market_quotes` — Contrato C (`KC=F`), USD/BRL (`USDBRL=X`) y USD/COP (`COP=X`)
    vía `yfinance`, con la regla de descarte antes de las 2pm hora local.
  - `fetch_oic_prices` — **pendiente**, lanza `NotImplementedError` a propósito: no hay URL de
    descarga automática identificada para el PDF de la OIC (`I-CIP.pdf`); requiere descarga
    manual y extracción vía `camelot`.
  - Todas las funciones que sí dependen de red usan reintentos con backoff exponencial y lanzan
    excepciones explícitas (`SourceUnavailableError`, `SourceStructureChangedError`) en vez de
    fallar en silencio o devolver datos parciales sin marcar.
- **Fase 3 (`scripts/read_excel.py`)**: hecha y validada contra el archivo real.
  - `read_oic_prices` — lee `data/manual/BD_precios_ICO_actualizada.xlsx` (hoja única `Sheet1`,
    nombre de archivo fijo — confirmado con el equipo y verificado contra el archivo real), valida
    que existan las columnas esperadas (Fecha, Ico Composite Indicator, Colombian Milds, Other
    Milds, Brazilian Naturals, Robustas — todas en US¢ por libra) tolerando variaciones menores de
    acentos/mayúsculas/espacios en los encabezados, y lanza `ExcelValidationError` (fallo rápido y
    descriptivo) si el archivo no existe, no se puede parsear, falta alguna columna o la fecha no
    es interpretable.
  - El archivo real también trae dos columnas de spread ya calculadas (Colombian Milds vs Brazilian
    Naturals / vs Robustas); `read_oic_prices` las captura como campos opcionales
    (`spread_col_milds_vs_bra_naturals`, `spread_col_milds_vs_bra_robustas`) sin exigirlas.
  - Probado end-to-end contra `data/manual/BD_precios_ICO_actualizada.xlsx`: 2.466 filas, del
    2019-07-01 al 2026-03-31, sin nulos.
  - El archivo real (`data/manual/BD_precios_ICO_actualizada.xlsx`) ya está commiteado en el repo —
    es la carga manual vigente, no un fixture de prueba.
- **Fase 4 (`scripts/consolidate.py` + `scripts/validate.py`)**: hecha, validada contra los archivos
  reales de OIC y de Precios/Producción de la FNC.
  - `consolidate()` arma un `ConsolidatedDataset` con:
    - `serie_diaria`: una fila por fecha de la OIC (2019-07-01 en adelante) con los 5 precios OIC,
      el **año cafetero** calculado (`compute_ano_cafetero`, regla oct.–sept.) y el **diferencial
      UGQ** (`Colombian Milds − Contrato C`) cuando hay cotización histórica de Contrato C para esa
      fecha — si no la hay, queda `None` en esa fila en vez de inventar un valor.
    - `cotizaciones_actuales`: snapshot de Contrato C / USD-BRL / USD-COP (Fase 2), aparte de la
      serie diaria — `scrape.py` solo trae el último cierre de esos tickers, no histórico.
    - `produccion_mensual` y `valor_cosecha` (por año calendario y por año cafetero): parseadas del
      Excel de Precios de la FNC (`parse_fnc_production`, `parse_fnc_harvest_value`) localizando
      encabezados por contenido, no por posición fija de fila/columna, para tolerar cambios menores
      de formato entre publicaciones mensuales de la FNC.
    - `exportaciones`: **pendiente**, `parse_fnc_exports` lanza `NotImplementedError` a propósito —
      la FNC publica Exportaciones en un Excel aparte al de Precios y todavía no se compartió un
      archivo de ejemplo para verificar la estructura de sus hojas.
  - Se agregó `scrape.fetch_market_quote_history(ticker, start=...)` (histórico diario vía
    `yfinance`) porque el diferencial UGQ necesita la serie completa de Contrato C, no solo el
    último cierre que ya traía `fetch_market_quote`.
  - `validate_dataset()` distingue **crítico** (`DatasetValidationError`: serie diaria vacía, fechas
    futuras o duplicadas, precios fuera de rango, o una cotización nula que no fue descartada por
    la regla de las 2pm) de **advertencia** (fuente opcional vacía o cotización descartada por
    intradía — el pipeline igual publica, con esas advertencias visibles). Fase 5 (`main.py`) debe
    capturar `DatasetValidationError` y hacer `sys.exit(1)`.
  - Probado end-to-end con los archivos reales: `parse_fnc_production` (847 filas, 1956–2026-07),
    `parse_fnc_harvest_value` (26 años calendario, 25 años cafeteros, descartando años futuros sin
    valor aún), `build_daily_series` (2.466 filas) y ambos niveles de `validate_dataset` (caso
    feliz + los dos casos críticos).
- **Fase 5 (`scripts/main.py`)**: hecha y probada end-to-end (con red simulada, ver abajo).
  - `run()` orquesta: lee OIC → descarga y parsea FNC Precios → descarga histórico de Contrato C →
    obtiene cotizaciones actuales → `consolidate()` → `validate_dataset()` → arma el dict de salida.
  - **Regla de fallo acordada con el equipo**: el Excel manual de OIC es fatal si falla (aborta con
    `sys.exit(1)`, no se escribe `dataset.json`); las fuentes secundarias (Excel de Precios de la
    FNC, histórico de Contrato C, cotizaciones actuales) fallan "suave" — si `scrape.py` no puede
    obtenerlas o cambió su formato, el pipeline sigue con esa fuente vacía y una advertencia. Un
    problema crítico de `validate_dataset()` (fechas futuras, precios fuera de rango, etc.) también
    aborta con `sys.exit(1)`, incluso si todas las fuentes se obtuvieron bien.
  - `data/output/dataset.json` incluye `generated_at` (timestamp UTC de la corrida) y `warnings`
    (las advertencias de `validate_dataset()`, ej. "Exportaciones no implementado", "USD/COP
    descartado por intradía") — visibles para que el dashboard (Fase 7) las muestre al usuario
    final, no solo en el log de Actions.
  - Probado end-to-end: caso feliz (con los archivos reales de OIC y FNC, cotizaciones de mercado
    simuladas — sin red disponible en este entorno) escribe un JSON válido de 2.466 filas en
    `serie_diaria`; caso de falla del Excel de OIC hace `sys.exit(1)` sin escribir el archivo de
    salida. **Falta correr contra las fuentes de red reales** (FNC, `yfinance`) — eso es
    precisamente la Fase 5.5 de abajo.
- **Fase 6 (`.github/workflows/update-dashboard.yml`)**: hecha, **sin trigger de `schedule`/cron a
  propósito** — todavía falta correr la Fase 5.5 (validar `main.py` contra las fuentes de red
  reales) antes de automatizar corridas periódicas. Por ahora el workflow solo corre con:
  - `push` sobre `data/manual/**` (subir un Excel nuevo dispara la corrida).
  - `workflow_dispatch` (botón "Run workflow" en la pestaña Actions, para correrlo a demanda).
  - Pasos: checkout → Python 3.12 → `pip install -r requirements.txt` → `python scripts/main.py` →
    si `data/output/dataset.json` cambió, lo commitea y pushea con el `GITHUB_TOKEN` por defecto →
    publica el repositorio completo como artifact de Pages → `actions/deploy-pages` lo despliega.
  - Para activarlo la primera vez hace falta configurar, en Settings → Pages del repositorio,
    **Source: GitHub Actions** (no "Deploy from a branch") — eso no se puede hacer desde un push,
    es un ajuste manual de la configuración del repo.
  - **Agregar el cron es un cambio de una línea** (`schedule: - cron: "..."` en el `on:` del
    workflow) una vez completada la Fase 5.5 — ver README del blueprint para la hora en UTC.
- **Fase 7 (`dashboard/`)**: hecha — `index.html` + `style.css` + `app.js`, sin librerías externas ni
  build step (gráficos SVG a mano, siguiendo la guía de dataviz del proyecto: paleta validada por
  contraste/daltonismo, tooltip con crosshair, leyenda con toggle por serie, vista de tabla como
  gemelo accesible de cada gráfico, modo oscuro vía `prefers-color-scheme`).
  - Muestra: fecha de última actualización y advertencias de `validate.py` (banner visible, no solo
    en el log de Actions); cotizaciones actuales (Contrato C, USD/BRL, USD/COP) + últimos valores de
    Colombian Milds y diferencial UGQ como stat tiles; precios diarios OIC (5 series, con filtro de
    rango de fechas: último año / últimos 5 años / todo); diferencial UGQ (con línea base en cero);
    producción mensual y valor de cosecha por año cafetero (FNC); un aviso de que Exportaciones
    todavía está pendiente.
  - **Selección de KPIs/gráficos sin confirmar formalmente con el equipo** (ver "supuestos" abajo) —
    se construyó con lo que el dataset consolidado ya tiene disponible; ajustar si el equipo pide
    otras métricas.
  - Probado en un navegador real (Chromium vía Playwright) contra un `dataset.json` generado con los
    archivos reales de OIC/FNC (cotizaciones de mercado simuladas, sin red en este entorno):
    tooltip/crosshair, toggle de leyenda, vista de tabla, filtro de rango y modo claro/oscuro
    funcionan correctamente. **Sin probar contra datos 100% reales de mercado** — eso llega con la
    Fase 5.5.
  - **Paleta de color es un placeholder**: se usó la paleta de referencia validada de la guía de
    dataviz (no hay colores/branding de FEPCafé definidos todavía) — sustituir cuando estén.
- **Fase 8** (tests): pendiente.

tests/ sigue con `.gitkeep` como marcador temporal hasta que se agregue su contenido real.

Antes de avanzar más allá hace falta confirmar, con el equipo técnico, los "supuestos a confirmar"
de la Fase 0 del blueprint:

- ~~Estructura de columnas del Excel manual~~ — resuelto y verificado contra el archivo real: ver
  Fase 3 arriba.
- ~~Nombre y formato fijo del Excel~~ — resuelto: `BD_precios_ICO_actualizada.xlsx`, nombre fijo.
- URLs/fuentes exactas de scraping y qué dato se extrae de cada una (más allá de lo ya cubierto en
  Fase 2 — ver tabla de fuentes abajo).
- Métricas/KPIs que debe mostrar el dashboard — Fase 7 se construyó con una selección razonable
  según los datos disponibles (ver Fase 7 arriba), no confirmada formalmente con el equipo.
- ~~Si GitHub Pages sirve desde `main` o desde una rama/carpeta `docs/`~~ — resuelto de otra forma:
  el workflow (Fase 6) despliega con `actions/deploy-pages` publicando el repo completo como
  artifact, así que no depende de la convención de branch/carpeta de GitHub Pages.
- Frecuencia del cron — **todavía no aplica**: Fase 6 se construyó sin `schedule` a propósito (ver
  arriba), hasta que se corra la Fase 5.5.

### Fuentes y cálculos identificados (referencia del notebook original)

| Fuente | Método | Detalle |
|---|---|---|
| FNC — Precios y Exportaciones | Scraping (`requests` + `BeautifulSoup`) | Busca en `federaciondecafeteros.org/wp/estadisticas-cafeteras/` el link cuyo `href` matchea "Precios" / "Exportaciones" por regex, descarga el Excel |
| Producción y valor de cosecha | Lectura de Excel (`scripts/consolidate.py`) | Del mismo Excel de Precios que descarga la FNC. Hojas confirmadas contra un archivo real: `8. Producción mensual`, `9. Valor cosecha` (el notebook de referencia las numeraba `9.`/`10.` — el número de hoja puede variar entre publicaciones, por eso el parseo busca encabezados por contenido) |
| Exportaciones (volumen y valor) | Pendiente (`parse_fnc_exports`, sin implementar) | La FNC las publica en un Excel de "Exportaciones" aparte al de Precios; aún no se compartió un archivo de ejemplo para verificar la estructura de las hojas `1. Total_Volumen` / `2. Total_Valor` |
| OIC (ICO Composite, Colombian Milds, Other Milds, Brazilian Naturals, Robustas) | Excel manual (`scripts/read_excel.py`) | No hay URL de descarga automática identificada para el PDF de la OIC. Estos precios se cargan a mano en `data/manual/BD_precios_ICO_actualizada.xlsx` (2.466 filas, desde 2019-07-01) |
| Contrato C (café, ICE) | `yfinance`, ticker `KC=F` | Descarta el dato del día si la hora local es antes de las 2pm (mercado sin cerrar) |
| USD/BRL | `yfinance`, ticker `USDBRL=X` | Misma regla de las 2pm |
| USD/COP | `yfinance`, ticker `COP=X` | Misma regla de las 2pm |
| Diferencial UGQ | Cálculo | `Colombian Milds (OIC) − Contrato C`, filtrado desde julio 2019 |
| Año Cafetero | Cálculo | Oct.–Sept.: si el mes es < 10, el año inicial es `año−1`; si es ≥ 10, el año inicial es el año en curso |

**Riesgo a vigilar antes de automatizar con cron**: la extracción de la OIC vía `camelot` sobre un
PDF es la parte más frágil de todo el pipeline — cualquier cambio de formato en el PDF rompe el
parseo sin aviso.

### Cómo correr el pipeline localmente (para pruebas, sin depender del cron)

```bash
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python scripts/main.py
```

Esto genera `data/output/dataset.json`, que `dashboard/index.html` consume vía `fetch` — no requiere
levantar un servidor backend, basta con abrir el HTML a través de cualquier servidor estático (ej.
`python -m http.server` desde la raíz del repo) porque `fetch` no funciona sobre `file://`. Requiere
tener `data/manual/BD_precios_ICO_actualizada.xlsx` en el repo (ya está commiteado) y conexión a
internet para la FNC y `yfinance`.

### Corrida real (2026-09-10) — `data/output/dataset.json`

Se corrió `python scripts/main.py` end-to-end contra el Excel real de OIC (commiteado en el repo) y
se sirvió `dashboard/index.html` con un servidor estático real, verificado en Chromium (sin errores
de consola, gráficos y stat tiles renderizando bien). Resultado:

- **OIC (fuente crítica)**: éxito — 2.466 filas leídas y consolidadas (2019-07-01 a 2026-03-31), tal
  como esperaba la Fase 3.
- **FNC (Precios/Producción/Valor de cosecha) y `yfinance` (Contrato C, USD/BRL, USD/COP)**: el
  entorno donde se corrió esta vez también tiene salida de red restringida por política de
  organización (`federaciondecafeteros.org` y `query1.finance.yahoo.com` devuelven 403 en el proxy
  de salida) — **no** fue posible acceder a las fuentes reales. El pipeline degradó "suave" como
  está diseñado: siguió sin esas fuentes, dejó las 4 advertencias correspondientes en
  `dataset.json` y el dashboard las muestra en su banner, en vez de fallar.
- Intentar disparar el workflow `update-dashboard.yml` (que sí correría en un runner de GitHub con
  internet real) con `workflow_dispatch` falló con 404: **GitHub solo reconoce workflows presentes
  en la rama default (`main`)**, y este workflow todavía vive solo en ramas de trabajo, no en
  `main`. Confirmado también que GitHub Pages sigue en el modo legado ("Deploy from a branch"), no
  en "GitHub Actions" (ver punto 2 de próximos pasos).

**Conclusión de la Fase 5.5 sigue pendiente**: no se pudo completar la validación contra fuentes de
red 100% reales de FNC/mercado en ningún entorno de desarrollo probado hasta ahora — hace falta
correrla desde un runner de GitHub Actions (una vez el workflow esté en `main`) o desde una máquina
sin esa restricción de salida.

### Próximos pasos

1. **Fase 5.5 (pendiente, obligatoria antes de activar un cron)**: fusionar este trabajo a `main`
   (o al menos el workflow) y correr `update-dashboard.yml` vía `workflow_dispatch` en un runner de
   GitHub Actions (con acceso real a internet) para comparar los números del `dataset.json`
   resultante contra el reporte de referencia — ver "Corrida real" arriba.
2. Configurar **Settings → Pages → Source: GitHub Actions** en el repositorio (ajuste manual, una
   sola vez) para que el workflow de la Fase 6 pueda desplegar — sigue en modo "Deploy from a
   branch" (confirmado en la corrida de arriba).
3. Confirmar con el equipo la selección de KPIs del dashboard (Fase 7) y el Excel de Exportaciones
   de la FNC (para completar `parse_fnc_exports`, pendiente desde la Fase 4).
4. Una vez validada la Fase 5.5, agregar el trigger `schedule` al workflow (una línea) con la
   frecuencia que el equipo confirme.
5. Fase 8: tests con fixtures fijos para `consolidate.py`/`validate.py`.
