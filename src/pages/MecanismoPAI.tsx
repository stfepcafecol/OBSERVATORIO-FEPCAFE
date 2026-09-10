import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend as RLegend } from 'recharts'
import { Card, ChartHeader } from '../components/Card'
import { fertilizantesSerie, fertilizantesTabla, programaApoyoColumnas, programaApoyoFilas } from '../data/pai'

const SERIE_COLORS: Record<string, string> = {
  '17-6-18-2': '#1f3a5f',
  '23-4-20-3': '#8fbf6a',
  '25-4-24': '#4a8752',
  '26-4-22': '#a12f2f',
  DAP: '#e8963c',
  KCL: '#2f6b3c',
  Urea: '#8fa8d9',
}

function VarPill({ value }: { value: number }) {
  const positive = value >= 0
  return (
    <span className={positive ? 'text-emerald-700' : 'text-red-600'}>
      {positive ? '+' : ''}
      {value.toFixed(1)}%
    </span>
  )
}

function FertilizantesTabla() {
  return (
    <Card>
      <ChartHeader eyebrow="Mecanismo PAI" title="Variación del Precio de Fertilizantes de Referencia para Café" />
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-xs uppercase text-gray-400">
            <th className="py-2">Fertilizante</th>
            <th className="py-2">Precio Promedio</th>
            <th className="py-2">Var. (%) Mes</th>
            <th className="py-2">Var. (%) Año</th>
          </tr>
        </thead>
        <tbody>
          {fertilizantesTabla.map((row) => (
            <tr
              key={row.fertilizante}
              className={`border-b border-gray-100 ${row.fertilizante === 'Promedio' ? 'bg-emerald-50 font-semibold' : ''}`}
            >
              <td className="py-2">{row.fertilizante}</td>
              <td className="py-2">$ {row.precio.toLocaleString('es-CO')}</td>
              <td className="py-2"><VarPill value={row.varMes} /></td>
              <td className="py-2"><VarPill value={row.varAnio} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}

function ProgramaApoyoTabla() {
  return (
    <Card>
      <ChartHeader eyebrow="Programa de Apoyo a la Inversión" title="Indicadores de Costo de la Fertilización" />
      <table className="w-full text-center text-sm">
        <thead>
          <tr>
            <th className="p-2" />
            {programaApoyoColumnas.map((col) => (
              <th key={col} className="bg-navy p-2 text-white">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {programaApoyoFilas.map((fila, i) => (
            <tr key={fila} className={i % 2 === 0 ? 'bg-cream' : 'bg-white'}>
              <td className="p-3 text-left font-medium text-gray-600">{fila}</td>
              <td className="p-3 text-gray-400">—</td>
              <td className="p-3 text-gray-400">—</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}

export function MecanismoPAI() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <FertilizantesTabla />
        <Card>
          <ChartHeader eyebrow="Últimos 48 meses · COP" title="Evolución precios fertilizantes de referencia" />
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={fertilizantesSerie}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="label" tick={{ fontSize: 9 }} interval={5} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000000).toFixed(1)}M`} width={60} />
              <Tooltip formatter={(v: number) => `$${v.toLocaleString('es-CO')}`} />
              <RLegend />
              {Object.keys(SERIE_COLORS).map((key) => (
                <Line key={key} type="monotone" dataKey={key} stroke={SERIE_COLORS[key]} dot={false} strokeWidth={1.5} />
              ))}
              <Line type="monotone" dataKey="Promedio" stroke="#8a6d3b" strokeDasharray="5 3" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <ProgramaApoyoTabla />
    </div>
  )
}
