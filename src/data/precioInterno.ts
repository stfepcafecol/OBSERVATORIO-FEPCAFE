import { seededRandom, monthRange, round } from './utils'

const meses = monthRange(2022, 0, 57) // 01/2022 - 09/2026
const rnd = seededRandom(808)

function smoothSeries(base: number, amp: number, phase: number, trend: number, noiseFrac: number) {
  return meses.map((_, i) => round(base + amp * Math.sin(i / 6 + phase) + trend * i + (rnd() - 0.5) * base * noiseFrac))
}

const precioInternoSerie = smoothSeries(950000, 80000, 0.4, 3200, 0.03)
const contratoCSerie = smoothSeries(200, 20, 1.2, 0.15, 0.03)
const diferencialSerie = smoothSeries(22, 6, 2.1, 0.02, 0.12)
const trmSerie = smoothSeries(4000, 150, 0.8, 1.5, 0.02)

export const precioInternoTiempo = meses.map(({ label }, i) => ({ label, value: precioInternoSerie[i] }))
export const contratoCTiempo = meses.map(({ label }, i) => ({ label, value: contratoCSerie[i] }))
export const diferencialTiempo = meses.map(({ label }, i) => ({ label, value: round(diferencialSerie[i], 1) }))
export const tasaCambioTiempo = meses.map(({ label }, i) => ({ label, value: trmSerie[i] }))

const last = meses.length - 1
export const kpis = [
  {
    titulo: 'PRECIO INTERNO DEL CAFÉ',
    subtitulo: 'Precio de referencia del FoNC · COP/Carga 125 Kg CPS',
    valor: `$ ${precioInternoSerie[last].toLocaleString('es-CO')}`,
    unidad: 'COP',
    variacion: -4.5,
    min: `$ ${Math.min(...precioInternoSerie).toLocaleString('es-CO')}`,
    max: `$ ${Math.max(...precioInternoSerie).toLocaleString('es-CO')}`,
  },
  {
    titulo: 'CONTRATO C',
    subtitulo: 'Precio internacional cafés Arábicas · ICE',
    valor: `${contratoCSerie[last].toFixed(1).replace('.', ',')}`,
    unidad: 'cts/lb',
    variacion: 2.2,
    min: Math.min(...contratoCSerie).toFixed(1).replace('.', ','),
    max: Math.max(...contratoCSerie).toFixed(1).replace('.', ','),
  },
  {
    titulo: 'DIFERENCIAL UGQ',
    subtitulo: 'Prima de calidad para el café de Colombia',
    valor: `+${diferencialSerie[last].toFixed(1).replace('.', ',')}`,
    unidad: 'cts/lb',
    variacion: 0.4,
    min: Math.min(...diferencialSerie).toFixed(1).replace('.', ','),
    max: Math.max(...diferencialSerie).toFixed(1).replace('.', ','),
  },
  {
    titulo: 'TASA DE CAMBIO',
    subtitulo: 'Peso colombiano frente al dólar · USD/COP',
    valor: `$ ${trmSerie[last].toLocaleString('es-CO')}`,
    unidad: 'COP/USD',
    variacion: 1.5,
    min: `$ ${Math.min(...trmSerie).toLocaleString('es-CO')}`,
    max: `$ ${Math.max(...trmSerie).toLocaleString('es-CO')}`,
  },
]

// Descomposición del Precio Interno de Referencia [Var. mensual], 03/2024 - 07/2025
const decompMeses = monthRange(2024, 2, 17)
const rnd2 = seededRandom(909)
export const descomposicionPrecio = decompMeses.map(({ label }, i) => {
  const contratoC = round((rnd2() - 0.45) * 45000)
  const diferencial = round((rnd2() - 0.5) * 12000)
  const trm = round((rnd2() - 0.45) * 15000)
  return { label, contratoC, diferencial, trm }
})

// Análisis de Sensibilidad del Precio Interno de Referencia: matriz KC x TRM
const KC_VALUES = [170, 180, 190, 200, 210, 220, 230]
const TRM_VALUES = [3800, 3900, 4000, 4100, 4200, 4300, 4400, 4500]
const rnd3 = seededRandom(1010)
export const sensibilidadKC = KC_VALUES
export const sensibilidadTRM = TRM_VALUES
export const sensibilidadMatriz = KC_VALUES.map((kc) =>
  TRM_VALUES.map((trm) => {
    const base = (kc * trm) / 46000
    return Math.max(3, Math.round(base + (rnd3() - 0.5) * 6))
  }),
)
