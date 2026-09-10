import { seededRandom, monthRange, round } from './utils'

const rnd = seededRandom(404)

// Costo Medio de Producción, COP/carga 125kg CPS, mensual 01/2019 - 09/2026
const meses = monthRange(2019, 0, 93)
export const costoMedioSerie = meses.map(({ label }, i) => {
  const trend = 1150000 + i * 5200
  const noise = (rnd() - 0.5) * 30000
  return { label, value: round(trend + noise) }
})

export const costoMedioActual = costoMedioSerie[costoMedioSerie.length - 1].value
export const costoMedioVarMes = 1.5
export const costoMedioVarAnio = 8.2

export const estructuraCosto = [
  { name: 'Mano de obra', value: 69 },
  { name: 'Insumos', value: 25 },
  { name: 'Adm. y Generales', value: 6 },
]

export const estructuraDetallada = [
  { name: 'Recolección', value: 52 },
  { name: 'Nutrición', value: 18 },
  { name: 'Instalación', value: 10 },
  { name: 'Admón-Grales', value: 6 },
  { name: 'Manejo Arvenses', value: 5 },
  { name: 'Beneficio', value: 4 },
  { name: 'Control Fitos.', value: 2.5 },
  { name: 'Reg. Sombrío', value: 1.5 },
  { name: 'Otras', value: 1 },
]

// Evolución de precios de insumos, COP, mensual 01/2020 - 09/2026
const mesesInsumos = monthRange(2020, 0, 81)
const rnd2 = seededRandom(505)
export const insumosPrecios = mesesInsumos.map(({ label }, i) => {
  const decay = Math.max(0, 1 - i / 70)
  const fert = 20000 + 25000 * decay * (0.6 + 0.4 * Math.sin(i / 6)) + (rnd2() - 0.5) * 3000
  const fung = 14000 + 6000 * Math.sin(i / 8 + 1) + (rnd2() - 0.5) * 2500
  const herb = 13000 + 5000 * Math.sin(i / 7 + 2) - i * 20 + (rnd2() - 0.5) * 2500
  return {
    label,
    fertilizantes: round(fert),
    fungicidas: round(fung),
    herbicidas: round(Math.max(3000, herb)),
  }
})
