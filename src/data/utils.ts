// Small deterministic helpers used to build realistic-looking mock series.
// Swap these data modules for real data sources later; components only depend
// on the shapes exported from each data file, not on how they're produced.

export function seededRandom(seed: number) {
  let s = seed % 2147483647
  if (s <= 0) s += 2147483646
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

const MONTH_ABBR = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
]

export function monthLabel(year: number, monthIndex0: number, format: 'short' | 'numeric' = 'numeric') {
  const y = String(year).slice(2)
  if (format === 'short') return `${MONTH_ABBR[monthIndex0]}`
  return `${String(monthIndex0 + 1).padStart(2, '0')}/${year}`
}

export function monthRange(startYear: number, startMonth0: number, count: number) {
  const out: { year: number; month0: number; label: string }[] = []
  let y = startYear
  let m = startMonth0
  for (let i = 0; i < count; i++) {
    out.push({ year: y, month0: m, label: monthLabel(y, m) })
    m++
    if (m > 11) {
      m = 0
      y++
    }
  }
  return out
}

export function round(n: number, decimals = 0) {
  const f = Math.pow(10, decimals)
  return Math.round(n * f) / f
}

export function formatCOP(n: number) {
  return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(n)
}
