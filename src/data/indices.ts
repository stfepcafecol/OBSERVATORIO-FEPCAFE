export type IndiceCategoria = 'alto' | 'medio' | 'bajo' | 'negativo'

function categoria(value: number): IndiceCategoria {
  if (value < 0) return 'negativo'
  if (value > 10) return 'alto'
  if (value >= 5) return 'medio'
  return 'bajo'
}

function withCategoria(rows: { name: string; value: number }[]) {
  return rows.map((r) => ({ ...r, categoria: categoria(r.value) }))
}

export const ipcData = withCategoria([
  { name: 'General', value: 0.6 },
  { name: 'Alimentos', value: 9.4 },
  { name: 'Vivienda', value: 4.1 },
  { name: 'Ropa', value: 4.6 },
  { name: 'Educación', value: 4.3 },
  { name: 'Salud', value: 10.8 },
  { name: 'Transporte', value: 8.5 },
  { name: 'Comunicaciones', value: 0.4 },
])

export const ippData = withCategoria([
  { name: 'General', value: -1.6 },
  { name: 'Agropecuario', value: 13.4 },
  { name: 'Industrial', value: 2.9 },
  { name: 'Minería', value: -2.1 },
  { name: 'Café', value: 14.1 },
  { name: 'Otros agríc.', value: 10.6 },
  { name: 'Pecuario', value: 9.9 },
  { name: 'Energía', value: 6.2 },
])

export const CATEGORIA_COLOR: Record<IndiceCategoria, string> = {
  alto: '#a12f2f',
  medio: '#e8963c',
  bajo: '#3c7a45',
  negativo: '#8fa8d9',
}

export const CATEGORIA_LABEL: Record<IndiceCategoria, string> = {
  alto: '> 10%',
  medio: '5-10%',
  bajo: '0-5%',
  negativo: 'Negativo',
}
