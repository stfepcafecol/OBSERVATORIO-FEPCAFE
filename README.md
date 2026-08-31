# OBSERVATORIO-FEPCAF-

Repositorio creado para el procesamiento de datos relacionados con el Observatorio de datos FEPCafé.

## Pipeline de dashboard automatizado

Este repositorio está siendo construido siguiendo el blueprint del pipeline que consolida datos de
scraping web y de un Excel cargado manualmente, genera un dataset y lo publica en un dashboard HTML
estático vía GitHub Pages.

### Arquitectura general

```
[Excel manual] ──push a data/manual/──┐
                                       ├──▶ Script Python ──▶ data/output/*.json ──▶ Dashboard HTML (GitHub Pages)
[Scraping web] ──cron GitHub Actions──┘
```

- **Disparadores**: `schedule` (cron) + `push` sobre `data/manual/**` en el mismo workflow, para que
  subir un Excel nuevo también dispare una corrida sin esperar el próximo cron.
- **Salida del script**: uno o más JSON/CSV en `data/output/`, versionados en el repo.
- **Dashboard**: HTML/CSS/JS estático que hace `fetch` de los JSON en `data/output/` — sin backend,
  sin build step.
- **Despliegue**: GitHub Pages sirviendo la rama (o carpeta `/docs`) donde vive el dashboard; el
  propio workflow hace commit de los datos nuevos.

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
│   ├── manual/              # Excel subido a mano (ruta fija y estable)
│   │   └── ultimo.xlsx
│   └── output/               # JSON/CSV generados (se sobrescriben cada corrida)
│       └── dataset.json
├── dashboard/
│   ├── index.html          # Fase 7
│   ├── style.css
│   └── app.js
├── tests/
│   └── test_consolidate.py  # Fase 8
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
- **Fases 3 en adelante** (`read_excel.py`, `consolidate.py`, `validate.py`, `main.py`, dashboard,
  tests, workflow de Actions): pendientes.

dashboard/, tests/ y .github/workflows/ siguen con `.gitkeep` como marcador temporal hasta que se
agregue su contenido real.

Antes de avanzar más allá hace falta confirmar, con el equipo técnico, los "supuestos a confirmar"
de la Fase 0 del blueprint:

- URLs/fuentes exactas de scraping y qué dato se extrae de cada una.
- Estructura de columnas del Excel manual (nombres, tipos, hoja).
- Métricas/KPIs que debe mostrar el dashboard (define el esquema del JSON de salida).
- Frecuencia real del cron (diaria, varias veces al día, semanal).
- Nombre y formato fijo del Excel (`ultimo.xlsx` vs. nombre con fecha).
- Si GitHub Pages sirve desde `main` o desde una rama/carpeta `docs/`.

### Fuentes y cálculos identificados (referencia del notebook original)

| Fuente | Método | Detalle |
|---|---|---|
| FNC — Precios y Exportaciones | Scraping (`requests` + `BeautifulSoup`) | Busca en `federaciondecafeteros.org/wp/estadisticas-cafeteras/` el link cuyo `href` matchea "Precios" / "Exportaciones" por regex, descarga el Excel |
| Producción y valor de cosecha | Lectura de Excel (hojas `9. Producción mensual`, `10. Valor cosecha`) | Del mismo Excel que descarga la FNC |
| Exportaciones (volumen y valor) | Lectura de Excel (hojas `1. Total_Volumen`, `2. Total_Valor`) | Ídem |
| OIC (precio ICO composite, Colombian Milds, etc.) | Extracción de tabla de PDF vía `camelot` | El PDF (`I-CIP.pdf`) ya está descargado a mano — no hay URL de descarga automática identificada |
| Contrato C (café, ICE) | `yfinance`, ticker `KC=F` | Descarta el dato del día si la hora local es antes de las 2pm (mercado sin cerrar) |
| USD/BRL | `yfinance`, ticker `USDBRL=X` | Misma regla de las 2pm |
| USD/COP | `yfinance`, ticker `COP=X` | Misma regla de las 2pm |
| Diferencial UGQ | Cálculo | `Colombian Milds (OIC) − Contrato C`, filtrado desde julio 2019 |
| Año Cafetero | Cálculo | Oct.–Sept.: si el mes es < 10, el año inicial es `año−1`; si es ≥ 10, el año inicial es el año en curso |

**Riesgo a vigilar antes de automatizar con cron**: la extracción de la OIC vía `camelot` sobre un
PDF es la parte más frágil de todo el pipeline — cualquier cambio de formato en el PDF rompe el
parseo sin aviso.

### Cómo correr el pipeline localmente (para pruebas, sin depender del cron)

Una vez implementados los scripts (Fase 5 en adelante), el pipeline completo se ejecutará con:

```bash
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python scripts/main.py
```

Esto generará `data/output/dataset.json`, que el dashboard (`dashboard/index.html`) consume vía
`fetch` — no requiere levantar un servidor backend.

### Próximos pasos

Ver el blueprint completo para el detalle de cada fase (2 a 8). No se avanza a la Fase 6
(automatización con GitHub Actions) hasta validar localmente que los números del pipeline
coinciden con el reporte de referencia (Fase 5.5).
