import { seededRandom, monthRange, round } from './utils'

// Sistema de Alertas Mecanismo MeCIC, COP/carga, mensual 01/2021 - 07/2025
const meses = monthRange(2021, 0, 55)
const rnd = seededRandom(707)

export const mecicAlertas = meses.map(({ label }, i) => {
  const costoMedio = 1300000 + i * 4200 + (rnd() - 0.5) * 20000
  const limiteSuperior = costoMedio * (1.12 + 0.05 * Math.sin(i / 10)) + 60000
  const precioInterno =
    1350000 +
    260000 * Math.sin(i / 7 + 0.5) +
    (i > 30 ? (i - 30) * 3000 : 0) +
    (rnd() - 0.5) * 60000
  return { label, costoMedio, limiteSuperior, precioInterno: round(precioInterno) }
})

// Media móvil (12m) del precio interno, usada como proxy de "precio FF94"
export const mecicAlertasConMedia = mecicAlertas.map((row, i, arr) => {
  const window = arr.slice(Math.max(0, i - 11), i + 1)
  const media = window.reduce((sum, r) => sum + r.precioInterno, 0) / window.length
  return { ...row, costoMedio: round(row.costoMedio), limiteSuperior: round(row.limiteSuperior), mediaMovil: round(media) }
})

// Sin datos publicados aún (placeholder, igual al diseño de referencia)
export const mecicReferenciaColumnas = ['Col A', 'Col B', 'Col C']
export const mecicReferenciaFilas = 4
