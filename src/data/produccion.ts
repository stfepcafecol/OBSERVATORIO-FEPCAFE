import { seededRandom, monthRange, round } from './utils'

const rnd = seededRandom(101)
const MESES_COSECHA = ['Oct', 'Nov', 'Dic', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep']

// Producción colombiana de café (Acumulado 12 meses), miles de sacos 60kg,
// una serie por año cafetero, eje Oct-Sep.
function buildAcumulada12M(base: number, amplitude: number, phase: number, noise: number) {
  return MESES_COSECHA.map((mes, i) => {
    const v = base + amplitude * Math.sin((i / 12) * Math.PI * 2 + phase) + (rnd() - 0.5) * noise
    return { mes, value: round(v) }
  })
}

const series2022 = buildAcumulada12M(13000, 900, 0.6, 300)
const series2023 = buildAcumulada12M(12200, 700, 1.4, 300)
const series2024 = buildAcumulada12M(12300, 700, 2.2, 300)
const series2025 = buildAcumulada12M(11900, 500, -1.0, 250)
const series2026 = buildAcumulada12M(12200, 300, 3.0, 200).slice(0, 6)

export const produccionAcumulada12M = MESES_COSECHA.map((mes, i) => ({
  mes,
  '2022': series2022[i].value,
  '2023': series2023[i].value,
  '2024': series2024[i].value,
  '2025': series2025[i].value,
  '2026': i < series2026.length ? series2026[i].value : null,
}))

// Producción mensual de café (últimos 10 años del mes de referencia), miles de sacos 60kg
const meses10Anios = monthRange(2016, 7, 109) // 08/2016 .. 08/2025
export const produccionMensual10Anios = meses10Anios.map(({ label, month0 }, i) => {
  const trend = i < 70 ? 500 + i * 3 : 700 + (i - 70) * 12
  const estacional = 200 * Math.sin((month0 / 12) * Math.PI * 2 + 1.2)
  const value = Math.max(250, trend + estacional + (rnd() - 0.5) * 120)
  return { label, value: round(value) }
})

// Producción colombiana de café [Año cafetero] (Acumulado 1 mes), miles de sacos 60kg
function buildAnioCafetero(base: number, dip: number, noise: number) {
  return MESES_COSECHA.map((mes, i) => {
    const uShape = dip * Math.cos((i / 11) * Math.PI)
    const value = base - uShape + (rnd() - 0.5) * noise
    return round(value)
  })
}

const anio2223 = buildAnioCafetero(950, 220, 40)
const anio2324 = buildAnioCafetero(920, 200, 40)
const anio2425 = buildAnioCafetero(950, 210, 40)
const anio2526 = buildAnioCafetero(880, 0, 20).slice(0, 3)

export const produccionAnioCafetero = MESES_COSECHA.map((mes, i) => ({
  mes,
  '2022-23': anio2223[i],
  '2023-24': anio2324[i],
  '2024-25': anio2425[i],
  '2025-26': i < anio2526.length ? anio2526[i] : null,
}))

// Índice Oceánico Relativo El Niño (RONI), serie mensual 09/2016 - 09/2026
const roniMeses = monthRange(2016, 8, 121)
const rnd2 = seededRandom(202)
export const roniSerie = roniMeses.map(({ label }, i) => {
  const ninoHump = 3.6 * Math.exp(-Math.pow((i - 50) / 10, 2))
  const minorHump = 1.2 * Math.exp(-Math.pow((i - 100) / 6, 2))
  const base = 0.4 * Math.sin(i / 14) + (rnd2() - 0.5) * 0.5
  return { label, value: round(ninoHump + minorHump + base, 2) }
})

// Pronóstico RONI con intervalo de confianza P25-P75
const forecastMeses = monthRange(2023, 0, 44) // 01/2023 - 08/2026
const rnd3 = seededRandom(303)
const OBSERVADO_HASTA = 30
export const roniForecast = forecastMeses.map(({ label }, i) => {
  const hump = 0.7 * Math.exp(-Math.pow((i - 12) / 8, 2))
  const rising = i > 32 ? (i - 32) * 0.08 : 0
  const p50 = 0.1 + hump + rising + (rnd3() - 0.5) * 0.15
  const band = 0.35 + (i > 32 ? (i - 32) * 0.02 : 0)
  const p25 = i >= OBSERVADO_HASTA ? round(p50 - band, 2) : null
  const p75 = i >= OBSERVADO_HASTA ? round(p50 + band, 2) : null
  return {
    label,
    observado: i <= OBSERVADO_HASTA ? round(p50, 2) : null,
    p50: i >= OBSERVADO_HASTA ? round(p50, 2) : null,
    p25,
    p75,
    rango: p25 !== null && p75 !== null ? round(p75 - p25, 2) : null,
  }
})
