import { seededRandom, monthRange, round } from './utils'

export const fertilizantesTabla = [
  { fertilizante: '17-6-18-2', precio: 1842000, varMes: -1.2, varAnio: 8.4 },
  { fertilizante: '25-4-24', precio: 2104000, varMes: 0.8, varAnio: 12.1 },
  { fertilizante: 'KCL', precio: 1365000, varMes: 2.3, varAnio: 5.7 },
  { fertilizante: 'DAP', precio: 1980000, varMes: -0.5, varAnio: 9.2 },
  { fertilizante: 'Urea', precio: 1620000, varMes: 1.1, varAnio: 6.8 },
  { fertilizante: '23-4-20-3', precio: 1756000, varMes: -0.3, varAnio: 7.5 },
  { fertilizante: '26-4-22', precio: 1890000, varMes: 0.6, varAnio: 11.0 },
  { fertilizante: 'Promedio', precio: 1794000, varMes: 0.4, varAnio: 8.7 },
]

// Evolución precios fertilizantes de referencia, últimos 48 meses, COP
const meses = monthRange(2022, 8, 48) // 09/2022 - 08/2026
const rnd = seededRandom(606)
function serie(base: number, amp: number, phase: number, trend: number) {
  return meses.map((_, i) => round(base + amp * Math.sin(i / 9 + phase) + trend * i + (rnd() - 0.5) * base * 0.03))
}

const s17 = serie(1900000, 250000, 0.2, -1500)
const s2340203 = serie(1700000, 220000, 1.1, -1000)
const s2542 = serie(1950000, 300000, 2.0, 2000)
const s2642 = serie(1750000, 260000, 0.6, -500)
const sDAP = serie(1850000, 350000, 1.6, 1200)
const sKCL = serie(1650000, 300000, 2.6, -800)
const sUrea = serie(1800000, 200000, 0.9, 500)

export const fertilizantesSerie = meses.map(({ label }, i) => {
  const promedio = round((s17[i] + s2340203[i] + s2542[i] + s2642[i] + sDAP[i] + sKCL[i] + sUrea[i]) / 7)
  return {
    label,
    '17-6-18-2': s17[i],
    '23-4-20-3': s2340203[i],
    '25-4-24': s2542[i],
    '26-4-22': s2642[i],
    DAP: sDAP[i],
    KCL: sKCL[i],
    Urea: sUrea[i],
    Promedio: promedio,
  }
})

// Programa de Apoyo a la Inversión: sin datos publicados aún (placeholder, igual al diseño de referencia)
export const programaApoyoColumnas = ['Área en Renovación (40%)', 'Área en Producción (30%)']
export const programaApoyoFilas = ['Costo Fertilización Ha/Año', 'Incentivo por Ha', 'Bono por Equidad (5%)']
