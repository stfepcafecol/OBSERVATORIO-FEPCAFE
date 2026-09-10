import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card, ChartHeader, SectionBanner } from '../components/Card'
import { CATEGORIA_COLOR, CATEGORIA_LABEL, ipcData, ippData, type IndiceCategoria } from '../data/indices'

function Legend() {
  const cats: IndiceCategoria[] = ['alto', 'medio', 'bajo', 'negativo']
  return (
    <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-500">
      {cats.map((c) => (
        <span key={c} className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: CATEGORIA_COLOR[c] }} />
          {CATEGORIA_LABEL[c]}
        </span>
      ))}
    </div>
  )
}

function IndiceChart({ eyebrow, title, data }: { eyebrow: string; title: string; data: typeof ipcData }) {
  return (
    <Card>
      <ChartHeader eyebrow={eyebrow} title={title} />
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={data} layout="vertical" margin={{ left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
          <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={90} />
          <Tooltip formatter={(v: number) => `${v}%`} />
          <Bar dataKey="value">
            {data.map((row, i) => (
              <Cell key={i} fill={CATEGORIA_COLOR[row.categoria]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <Legend />
    </Card>
  )
}

export function IndicesPrecios() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <SectionBanner eyebrow="Inflación" title="Variación anual índice de precios a julio 2026: (a) Consumidor y (b) Productor" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <IndiceChart eyebrow="Variación anual % · Julio 2026" title="(a) Índice de Precios al Consumidor (IPC)" data={ipcData} />
        <IndiceChart eyebrow="Variación anual % · Julio 2026" title="(b) Índice de Precios al Productor (IPP)" data={ippData} />
      </div>
    </div>
  )
}
