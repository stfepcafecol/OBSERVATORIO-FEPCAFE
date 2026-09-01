"use strict";

/* Observatorio FEPCafé — dashboard estático.
 * Sin dependencias externas: SVG construido a mano siguiendo la guía de
 * dataviz del proyecto (marca de 2px, hairlines, tooltip con crosshair,
 * leyenda con toggle, vista de tabla como gemelo accesible de cada
 * gráfico). Lee data/output/dataset.json, generado por scripts/main.py.
 */

const DATASET_URL = "../data/output/dataset.json";
const SVG_NS = "http://www.w3.org/2000/svg";

const numberFormatter = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 });
const integerFormatter = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });
const centsFormatter = new Intl.NumberFormat("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateFormatter = new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short", year: "numeric" });
const dateTimeFormatter = new Intl.DateTimeFormat("es-CO", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const OIC_SERIES_DEFS = [
  { key: "ico_composite", label: "ICO Composite", colorVar: "--series-1" },
  { key: "colombian_milds", label: "Colombian Milds", colorVar: "--series-2" },
  { key: "other_milds", label: "Other Milds", colorVar: "--series-3" },
  { key: "brazilian_naturals", label: "Brazilian Naturals", colorVar: "--series-4" },
  { key: "robustas", label: "Robustas", colorVar: "--series-5" },
];

const state = {
  dataset: null,
  oicDomain: null, // [Date, Date] — filtra oic-chart y ugq-chart
};

init();

async function init() {
  try {
    const response = await fetch(DATASET_URL, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    state.dataset = await response.json();
  } catch (err) {
    showError(err);
    return;
  }
  showContent();
  render(state.dataset);
}

function showError(err) {
  document.getElementById("loading-state").hidden = true;
  const el = document.getElementById("error-state");
  el.hidden = false;
  el.textContent =
    "No se pudo cargar data/output/dataset.json. Puede que el pipeline todavía no se haya " +
    "ejecutado, o que estés viendo esta página fuera de GitHub Pages. (" + err.message + ")";
}

function showContent() {
  document.getElementById("loading-state").hidden = true;
  document.getElementById("content").hidden = false;
}

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function render(dataset) {
  renderStatusBar(dataset);
  renderWarnings(dataset.warnings || []);
  renderKpis(dataset);

  const dailyDates = (dataset.serie_diaria || []).map((r) => parseISODate(r.fecha));
  if (dailyDates.length > 0) {
    const minDate = dailyDates[0];
    const maxDate = dailyDates[dailyDates.length - 1];
    setupDateRangeFilter(minDate, maxDate);
  } else {
    document.getElementById("date-range-filter").parentElement.hidden = true;
  }

  renderOicChart(dataset);
  renderUgqChart(dataset);
  renderProduccionChart(dataset);
  renderCosechaChart(dataset);
  setupTableToggles();
}

/* ---------- Encabezado / estado ---------- */

function renderStatusBar(dataset) {
  const el = document.getElementById("status-bar");
  if (!dataset.generated_at) {
    el.textContent = "";
    return;
  }
  const d = new Date(dataset.generated_at);
  el.textContent = "Última actualización: " + dateTimeFormatter.format(d);
}

function renderWarnings(warnings) {
  const el = document.getElementById("warnings-banner");
  if (!warnings.length) {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  el.innerHTML = "";

  const icon = svgEl("svg", { class: "warnings-banner__icon", viewBox: "0 0 20 20", "aria-hidden": "true" });
  const path = svgEl("path", {
    d: "M10 2 L18.5 17 H1.5 Z",
    fill: "none",
    stroke: "var(--status-warning)",
    "stroke-width": "1.6",
    "stroke-linejoin": "round",
  });
  const dot = svgEl("circle", { cx: "10", cy: "14", r: "1", fill: "var(--status-warning)" });
  const bar = svgEl("rect", { x: "9.2", y: "7", width: "1.6", height: "5", fill: "var(--status-warning)" });
  icon.append(path, bar, dot);

  const body = document.createElement("div");
  const title = document.createElement("p");
  title.className = "warnings-banner__title";
  title.textContent = "Advertencia" + (warnings.length > 1 ? "s" : "") + " de la última corrida";
  const list = document.createElement("ul");
  for (const w of warnings) {
    const li = document.createElement("li");
    li.textContent = w; // textContent: las advertencias vienen del dataset, no se insertan como HTML
    list.appendChild(li);
  }
  body.append(title, list);
  el.append(icon, body);
}

/* ---------- KPIs ---------- */

function renderKpis(dataset) {
  const mount = document.getElementById("kpi-row");
  mount.innerHTML = "";

  const quotes = dataset.cotizaciones_actuales || [];
  for (const q of quotes) {
    mount.appendChild(buildQuoteTile(q));
  }

  const serie = dataset.serie_diaria || [];
  const lastRow = findLastWithValue(serie, "colombian_milds");
  if (lastRow) {
    mount.appendChild(
      buildStatTile("Colombian Milds (OIC)", formatCents(lastRow.colombian_milds), "Al " + formatDateEs(lastRow.fecha))
    );
  }
  const lastUgq = findLastWithValue(serie, "diferencial_ugq");
  if (lastUgq) {
    mount.appendChild(
      buildStatTile("Diferencial UGQ", formatCents(lastUgq.diferencial_ugq), "Al " + formatDateEs(lastUgq.fecha))
    );
  }
}

function findLastWithValue(rows, key) {
  for (let i = rows.length - 1; i >= 0; i--) {
    if (rows[i][key] !== null && rows[i][key] !== undefined) return rows[i];
  }
  return null;
}

function buildQuoteTile(quote) {
  if (quote.value === null || quote.value === undefined) {
    const note = quote.discarded_intraday
      ? "Sin actualizar: corrida antes de las 2pm hora local"
      : "Sin dato disponible";
    return buildStatTile(quote.label, "—", note, true);
  }
  const note = quote.quote_date ? "Al " + formatDateEs(quote.quote_date) : "";
  return buildStatTile(quote.label, formatQuoteValue(quote), note);
}

function formatQuoteValue(quote) {
  if (quote.ticker === "KC=F") return formatCents(quote.value);
  // Tasas de cambio: USD/BRL (~5) necesita más decimales que USD/COP (~4.000).
  const decimals = Math.abs(quote.value) < 10 ? 4 : 2;
  return new Intl.NumberFormat("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: decimals }).format(
    quote.value
  );
}

function buildStatTile(label, value, note, muted) {
  const tile = document.createElement("div");
  tile.className = "stat-tile";

  const labelEl = document.createElement("p");
  labelEl.className = "stat-tile__label";
  labelEl.textContent = label;

  const valueEl = document.createElement("p");
  valueEl.className = "stat-tile__value" + (muted ? " stat-tile__value--muted" : "");
  valueEl.textContent = value;

  tile.append(labelEl, valueEl);

  if (note) {
    const noteEl = document.createElement("p");
    noteEl.className = "stat-tile__note";
    noteEl.textContent = note;
    tile.appendChild(noteEl);
  }
  return tile;
}

function formatCents(v) {
  return centsFormatter.format(v) + " US¢/lb";
}

/* ---------- Filtro de rango de fechas (oic-chart + ugq-chart) ---------- */

function setupDateRangeFilter(minDate, maxDate) {
  const mount = document.getElementById("date-range-filter");
  mount.innerHTML = "";

  const presets = [
    { key: "1y", label: "Último año", months: 12 },
    { key: "5y", label: "Últimos 5 años", months: 60 },
    { key: "all", label: "Todo", months: null },
  ];

  function domainFor(preset) {
    if (preset.months === null) return [minDate, maxDate];
    const start = new Date(maxDate);
    start.setMonth(start.getMonth() - preset.months);
    return [start < minDate ? minDate : start, maxDate];
  }

  let defaultKey = "5y";
  for (const preset of presets) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "preset-btn";
    btn.textContent = preset.label;
    btn.setAttribute("aria-pressed", String(preset.key === defaultKey));
    btn.addEventListener("click", () => {
      for (const other of mount.querySelectorAll(".preset-btn")) other.setAttribute("aria-pressed", "false");
      btn.setAttribute("aria-pressed", "true");
      state.oicDomain = domainFor(preset);
      renderOicChart(state.dataset);
      renderUgqChart(state.dataset);
    });
    mount.appendChild(btn);
    if (preset.key === defaultKey) state.oicDomain = domainFor(preset);
  }
}

/* ---------- Gráfico multi-serie: precios diarios OIC ---------- */

function renderOicChart(dataset) {
  const rows = dataset.serie_diaria || [];
  const [domainStart, domainEnd] = state.oicDomain || [null, null];
  const filtered = domainStart
    ? rows.filter((r) => {
        const d = parseISODate(r.fecha);
        return d >= domainStart && d <= domainEnd;
      })
    : rows;

  const series = OIC_SERIES_DEFS.map((def) => ({
    ...def,
    color: cssVar(def.colorVar),
    data: filtered.map((r) => ({ date: parseISODate(r.fecha), value: r[def.key] })),
  }));

  const chart = buildMultiLineChart({
    series,
    formatValue: (v) => centsFormatter.format(v) + " US¢/lb",
  });

  const mount = document.getElementById("oic-chart");
  mount.innerHTML = "";
  mount.appendChild(chart.svg);

  renderLegend(document.getElementById("oic-legend"), series, chart.setSeriesVisible);
  renderDailyTable(document.getElementById("oic-table-wrap"), filtered, [
    { key: "ico_composite", label: "ICO Composite" },
    { key: "colombian_milds", label: "Colombian Milds" },
    { key: "other_milds", label: "Other Milds" },
    { key: "brazilian_naturals", label: "Brazilian Naturals" },
    { key: "robustas", label: "Robustas" },
  ]);
}

/* ---------- Gráfico de una serie: diferencial UGQ ---------- */

function renderUgqChart(dataset) {
  const rows = dataset.serie_diaria || [];
  const [domainStart, domainEnd] = state.oicDomain || [null, null];
  const filtered = domainStart
    ? rows.filter((r) => {
        const d = parseISODate(r.fecha);
        return d >= domainStart && d <= domainEnd;
      })
    : rows;

  const mount = document.getElementById("ugq-chart");
  mount.innerHTML = "";

  const data = filtered.map((r) => ({ date: parseISODate(r.fecha), value: r.diferencial_ugq }));
  if (!data.some((d) => d.value !== null && d.value !== undefined)) {
    mount.appendChild(emptyState("Sin datos de diferencial UGQ en el rango seleccionado."));
    document.getElementById("ugq-table-wrap").innerHTML = "";
    return;
  }

  const series = [{ key: "diferencial_ugq", label: "Diferencial UGQ", color: cssVar("--series-1"), data }];
  const chart = buildMultiLineChart({
    series,
    formatValue: (v) => centsFormatter.format(v) + " US¢/lb",
    showZeroBaseline: true,
  });
  mount.appendChild(chart.svg);

  renderDailyTable(document.getElementById("ugq-table-wrap"), filtered, [
    { key: "diferencial_ugq", label: "Diferencial UGQ" },
  ]);
}

/* ---------- Gráfico de una serie: producción mensual ---------- */

function renderProduccionChart(dataset) {
  const rows = dataset.produccion_mensual || [];
  const mount = document.getElementById("produccion-chart");
  mount.innerHTML = "";

  if (!rows.length) {
    mount.appendChild(emptyState("Producción mensual no disponible en esta corrida."));
    return;
  }

  const data = rows.map((r) => ({ date: parseISODate(r.mes), value: r.produccion_miles_sacos_60kg }));
  const series = [{ key: "produccion", label: "Producción", color: cssVar("--seq-blue-450"), data }];
  const chart = buildMultiLineChart({
    series,
    formatValue: (v) => integerFormatter.format(v) + " miles de sacos",
  });
  mount.appendChild(chart.svg);

  renderDailyTable(document.getElementById("produccion-table-wrap"), rows, [
    { key: "produccion_miles_sacos_60kg", label: "Producción (miles de sacos 60kg)" },
  ], "mes");
}

/* ---------- Gráfico de barras: valor de la cosecha por año cafetero ---------- */

function renderCosechaChart(dataset) {
  const rows = (dataset.valor_cosecha && dataset.valor_cosecha.por_anio_cafetero) || [];
  const mount = document.getElementById("cosecha-chart");
  mount.innerHTML = "";

  if (!rows.length) {
    mount.appendChild(emptyState("Valor de la cosecha no disponible en esta corrida."));
    return;
  }

  const chart = buildBarChart({
    items: rows.map((r) => ({ label: r.anio, value: r.valor_cosecha_millones_cop })),
    formatValue: (v) => integerFormatter.format(v) + " millones COP",
    color: cssVar("--seq-blue-450"),
  });
  mount.appendChild(chart.svg);

  const wrap = document.getElementById("cosecha-table-wrap");
  wrap.innerHTML = "";
  const table = document.createElement("table");
  const thead = document.createElement("thead");
  thead.innerHTML = "<tr><th>Año cafetero</th><th>Valor de la cosecha (millones COP)</th></tr>";
  const tbody = document.createElement("tbody");
  for (const r of rows) {
    const tr = document.createElement("tr");
    const tdYear = document.createElement("td");
    tdYear.textContent = r.anio;
    const tdVal = document.createElement("td");
    tdVal.textContent = r.valor_cosecha_millones_cop == null ? "—" : integerFormatter.format(r.valor_cosecha_millones_cop);
    tr.append(tdYear, tdVal);
    tbody.appendChild(tr);
  }
  table.append(thead, tbody);
  wrap.appendChild(table);
}

/* ---------- Tabla genérica de series diarias/mensuales ---------- */

function renderDailyTable(wrapEl, rows, columns, dateKey) {
  wrapEl.innerHTML = "";
  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  const thDate = document.createElement("th");
  thDate.textContent = "Fecha";
  headRow.appendChild(thDate);
  for (const col of columns) {
    const th = document.createElement("th");
    th.textContent = col.label;
    headRow.appendChild(th);
  }
  thead.appendChild(headRow);

  const tbody = document.createElement("tbody");
  const key = dateKey || "fecha";
  for (const row of rows) {
    const tr = document.createElement("tr");
    const tdDate = document.createElement("td");
    tdDate.textContent = row[key];
    tr.appendChild(tdDate);
    for (const col of columns) {
      const td = document.createElement("td");
      const v = row[col.key];
      td.textContent = v === null || v === undefined ? "—" : numberFormatter.format(v);
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  table.append(thead, tbody);
  wrapEl.appendChild(table);
}

function setupTableToggles() {
  for (const btn of document.querySelectorAll(".table-toggle")) {
    btn.addEventListener("click", () => {
      const target = document.getElementById(btn.dataset.target);
      target.hidden = !target.hidden;
      btn.textContent = target.hidden ? "Ver como tabla" : "Ocultar tabla";
    });
  }
}

/* ---------- Primitivas de gráfico (SVG a mano) ---------- */

const CHART_WIDTH = 960;
const CHART_HEIGHT = 300;
const MARGIN = { top: 16, right: 16, bottom: 28, left: 56 };

function svgEl(tag, attrs) {
  const el = document.createElementNS(SVG_NS, tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  }
  return el;
}

function niceTicks(min, max, count) {
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const span = max - min;
  const rawStep = span / count;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const residual = rawStep / magnitude;
  let step;
  if (residual > 5) step = 10 * magnitude;
  else if (residual > 2) step = 5 * magnitude;
  else if (residual > 1) step = 2 * magnitude;
  else step = magnitude;

  const niceMin = Math.floor(min / step) * step;
  const niceMax = Math.ceil(max / step) * step;
  const ticks = [];
  for (let t = niceMin; t <= niceMax + step / 2; t += step) ticks.push(Math.round(t / step) * step);
  return { ticks, min: niceMin, max: niceMax };
}

function emptyState(message) {
  const div = document.createElement("div");
  div.className = "empty-chart";
  div.textContent = message;
  return div;
}

/** Gráfico de líneas (una o varias series). Comparte ejes, crosshair y tooltip. */
function buildMultiLineChart({ series, formatValue, showZeroBaseline }) {
  const plotW = CHART_WIDTH - MARGIN.left - MARGIN.right;
  const plotH = CHART_HEIGHT - MARGIN.top - MARGIN.bottom;

  const allPoints = series.flatMap((s) => s.data);
  const dates = allPoints.map((d) => d.date.getTime());
  const values = allPoints.filter((d) => d.value !== null && d.value !== undefined).map((d) => d.value);

  const svg = svgEl("svg", { viewBox: `0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`, role: "img" });

  if (!values.length || !dates.length) {
    svg.appendChild(
      svgEl("text", { x: CHART_WIDTH / 2, y: CHART_HEIGHT / 2, "text-anchor": "middle" })
    ).textContent = "Sin datos en el rango seleccionado.";
    return { svg, setSeriesVisible: () => {} };
  }

  const xMin = Math.min(...dates);
  const xMax = Math.max(...dates);
  let yMin = Math.min(...values);
  let yMax = Math.max(...values);
  if (showZeroBaseline) {
    yMin = Math.min(yMin, 0);
    yMax = Math.max(yMax, 0);
  }
  const { ticks: yTicks, min: yNiceMin, max: yNiceMax } = niceTicks(yMin, yMax, 5);

  const xScale = (t) => MARGIN.left + ((t - xMin) / (xMax - xMin || 1)) * plotW;
  const yScale = (v) => MARGIN.top + plotH - ((v - yNiceMin) / (yNiceMax - yNiceMin || 1)) * plotH;

  const plotGroup = svgEl("g");

  // Gridlines horizontales + etiquetas del eje Y
  for (const tick of yTicks) {
    const y = yScale(tick);
    plotGroup.appendChild(
      svgEl("line", { class: "chart-gridline", x1: MARGIN.left, x2: CHART_WIDTH - MARGIN.right, y1: y, y2: y })
    );
    const label = svgEl("text", { x: MARGIN.left - 8, y: y + 3, "text-anchor": "end" });
    label.textContent = numberFormatter.format(tick);
    plotGroup.appendChild(label);
  }

  if (showZeroBaseline) {
    const y0 = yScale(0);
    plotGroup.appendChild(
      svgEl("line", { class: "chart-baseline", x1: MARGIN.left, x2: CHART_WIDTH - MARGIN.right, y1: y0, y2: y0 })
    );
  } else {
    plotGroup.appendChild(
      svgEl("line", {
        class: "chart-baseline",
        x1: MARGIN.left,
        x2: CHART_WIDTH - MARGIN.right,
        y1: MARGIN.top + plotH,
        y2: MARGIN.top + plotH,
      })
    );
  }

  // Etiquetas del eje X: primera, media y última fecha visible
  const xTickTimes = [xMin, (xMin + xMax) / 2, xMax];
  for (const t of xTickTimes) {
    const x = xScale(t);
    const label = svgEl("text", { x, y: CHART_HEIGHT - 6, "text-anchor": "middle" });
    label.textContent = dateFormatter.format(new Date(t));
    plotGroup.appendChild(label);
  }

  const seriesLayers = [];
  for (const s of series) {
    const points = s.data.filter((d) => d.value !== null && d.value !== undefined);
    const pathData = points
      .map((d, i) => `${i === 0 ? "M" : "L"} ${xScale(d.date.getTime())} ${yScale(d.value)}`)
      .join(" ");
    const path = svgEl("path", {
      d: pathData,
      fill: "none",
      stroke: s.color,
      "stroke-width": "2",
      "stroke-linejoin": "round",
      "stroke-linecap": "round",
    });
    plotGroup.appendChild(path);

    let endMarker = null;
    if (points.length) {
      const last = points[points.length - 1];
      endMarker = svgEl("circle", {
        cx: xScale(last.date.getTime()),
        cy: yScale(last.value),
        r: "4",
        fill: s.color,
        stroke: cssVar("--surface-1"),
        "stroke-width": "2",
      });
      plotGroup.appendChild(endMarker);
    }
    seriesLayers.push({ key: s.key, path, endMarker, sortedData: s.data });
  }

  svg.appendChild(plotGroup);

  // Crosshair + tooltip compartido
  const crosshair = svgEl("line", {
    class: "chart-crosshair",
    y1: MARGIN.top,
    y2: MARGIN.top + plotH,
    visibility: "hidden",
  });
  svg.appendChild(crosshair);

  const hitRect = svgEl("rect", {
    x: MARGIN.left,
    y: MARGIN.top,
    width: plotW,
    height: plotH,
    fill: "transparent",
  });
  svg.appendChild(hitRect);

  const tooltip = document.getElementById("tooltip");

  hitRect.addEventListener("pointermove", (evt) => {
    const rect = svg.getBoundingClientRect();
    const scaleX = CHART_WIDTH / rect.width;
    const px = (evt.clientX - rect.left) * scaleX;
    const t = xMin + ((px - MARGIN.left) / plotW) * (xMax - xMin);
    const nearestDate = nearestByTime(series[0].data, t);
    if (!nearestDate) return;

    crosshair.setAttribute("x1", xScale(nearestDate.date.getTime()));
    crosshair.setAttribute("x2", xScale(nearestDate.date.getTime()));
    crosshair.setAttribute("visibility", "visible");

    tooltip.innerHTML = "";
    const dateEl = document.createElement("p");
    dateEl.className = "tooltip__date";
    dateEl.textContent = dateFormatter.format(nearestDate.date);
    tooltip.appendChild(dateEl);

    for (const s of series) {
      const point = nearestByTime(s.data, t);
      if (!point || point.value === null || point.value === undefined) continue;
      const row = document.createElement("div");
      row.className = "tooltip-row";
      const key = document.createElement("span");
      key.className = "tooltip-row__key";
      key.style.background = s.color;
      const value = document.createElement("span");
      value.className = "tooltip-row__value";
      value.textContent = formatValue(point.value);
      const label = document.createElement("span");
      label.className = "tooltip-row__label";
      label.textContent = s.label;
      row.append(key, value, label);
      tooltip.appendChild(row);
    }

    tooltip.hidden = false;
    tooltip.style.left = evt.clientX + 14 + "px";
    tooltip.style.top = evt.clientY + 14 + "px";
  });

  hitRect.addEventListener("pointerleave", () => {
    crosshair.setAttribute("visibility", "hidden");
    tooltip.hidden = true;
  });

  function setSeriesVisible(key, visible) {
    const layer = seriesLayers.find((l) => l.key === key);
    if (!layer) return;
    const opacity = visible ? "1" : "0";
    layer.path.style.opacity = opacity;
    if (layer.endMarker) layer.endMarker.style.opacity = opacity;
  }

  return { svg, setSeriesVisible };
}

function nearestByTime(data, t) {
  const withValue = data;
  if (!withValue.length) return null;
  let lo = 0;
  let hi = withValue.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (withValue[mid].date.getTime() < t) lo = mid + 1;
    else hi = mid;
  }
  if (lo > 0) {
    const prev = withValue[lo - 1];
    const curr = withValue[lo];
    if (Math.abs(prev.date.getTime() - t) < Math.abs(curr.date.getTime() - t)) return prev;
  }
  return withValue[lo];
}

/** Gráfico de barras de una sola serie (magnitud, un solo hue). */
function buildBarChart({ items, formatValue, color }) {
  const plotW = CHART_WIDTH - MARGIN.left - MARGIN.right;
  const plotH = CHART_HEIGHT - MARGIN.top - MARGIN.bottom;

  const values = items.filter((d) => d.value !== null && d.value !== undefined).map((d) => d.value);
  const svg = svgEl("svg", { viewBox: `0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`, role: "img" });

  if (!values.length) {
    svg.appendChild(svgEl("text", { x: CHART_WIDTH / 2, y: CHART_HEIGHT / 2, "text-anchor": "middle" })).textContent =
      "Sin datos.";
    return { svg };
  }

  const yMax = Math.max(...values, 0);
  const yMin = Math.min(...values, 0);
  const { ticks: yTicks, min: yNiceMin, max: yNiceMax } = niceTicks(yMin, yMax, 5);
  const yScale = (v) => MARGIN.top + plotH - ((v - yNiceMin) / (yNiceMax - yNiceMin || 1)) * plotH;

  for (const tick of yTicks) {
    const y = yScale(tick);
    svg.appendChild(
      svgEl("line", { class: "chart-gridline", x1: MARGIN.left, x2: CHART_WIDTH - MARGIN.right, y1: y, y2: y })
    );
    const label = svgEl("text", { x: MARGIN.left - 8, y: y + 3, "text-anchor": "end" });
    label.textContent = integerFormatter.format(tick);
    svg.appendChild(label);
  }

  const y0 = yScale(0);
  svg.appendChild(
    svgEl("line", { class: "chart-baseline", x1: MARGIN.left, x2: CHART_WIDTH - MARGIN.right, y1: y0, y2: y0 })
  );

  const n = items.length;
  const slot = plotW / n;
  const barWidth = Math.min(24, slot * 0.7);
  const labelEvery = Math.ceil(n / 14); // evita que las etiquetas del eje X se amontonen

  const tooltip = document.getElementById("tooltip");

  items.forEach((item, i) => {
    const cx = MARGIN.left + slot * (i + 0.5);
    if (item.value !== null && item.value !== undefined) {
      const y = yScale(item.value);
      const top = Math.min(y, y0);
      const height = Math.abs(y0 - y);
      const bar = svgEl("rect", {
        x: cx - barWidth / 2,
        y: top,
        width: barWidth,
        height: Math.max(height, 1),
        fill: color,
        rx: "4",
      });
      svg.appendChild(bar);

      bar.addEventListener("pointermove", (evt) => {
        tooltip.innerHTML = "";
        const dateEl = document.createElement("p");
        dateEl.className = "tooltip__date";
        dateEl.textContent = String(item.label);
        const row = document.createElement("div");
        row.className = "tooltip-row";
        const value = document.createElement("span");
        value.className = "tooltip-row__value";
        value.textContent = formatValue(item.value);
        row.appendChild(value);
        tooltip.append(dateEl, row);
        tooltip.hidden = false;
        tooltip.style.left = evt.clientX + 14 + "px";
        tooltip.style.top = evt.clientY + 14 + "px";
      });
      bar.addEventListener("pointerleave", () => {
        tooltip.hidden = true;
      });
    }

    if (i % labelEvery === 0) {
      const label = svgEl("text", { x: cx, y: CHART_HEIGHT - 6, "text-anchor": "middle" });
      label.textContent = String(item.label);
      svg.appendChild(label);
    }
  });

  return { svg };
}

/* ---------- Leyenda ---------- */

function renderLegend(mount, series, setSeriesVisible) {
  mount.innerHTML = "";
  if (series.length < 2) return; // una sola serie no necesita leyenda: el título ya la nombra
  for (const s of series) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "legend-item";
    btn.setAttribute("aria-pressed", "true");
    const swatch = document.createElement("span");
    swatch.className = "legend-item__swatch";
    swatch.style.background = s.color;
    const label = document.createElement("span");
    label.textContent = s.label;
    btn.append(swatch, label);
    btn.addEventListener("click", () => {
      const nowVisible = btn.getAttribute("aria-pressed") !== "true";
      btn.setAttribute("aria-pressed", String(nowVisible));
      setSeriesVisible(s.key, nowVisible);
    });
    mount.appendChild(btn);
  }
}

/* ---------- Utilidades de fecha ---------- */

function parseISODate(value) {
  // "2019-07-01" o "2019-07-01T00:00:00" -> Date local a medianoche,
  // evita el corrimiento de un día que da `new Date("2019-07-01")` en UTC.
  const datePart = String(value).slice(0, 10);
  const [y, m, d] = datePart.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatDateEs(value) {
  return dateFormatter.format(parseISODate(value));
}
