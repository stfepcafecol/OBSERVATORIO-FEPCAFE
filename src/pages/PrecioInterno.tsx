import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, ChartHeader } from '../components/Card'
import { KpiCard } from '../components/KpiCard'
import {
  contratoCTiempo,
  descomposicionPrecio,
  diferencialTiempo,
  kpis,
  precioInternoTiempo,
  sensibilidadKC,
  sensibilidadMatriz,
  sensibilidadTRM,
  tasaCambioTiempo,
} from '../data/precioInterno'

function TimeSeriesCard({
  eyebrow,
  title,
  data,
  color,
  valueFormatter,
}: {
  eyebrow: string
  title: string
  data: { label: string; value: number }[]
  color: string
  valueFormatter?: (v: number) => string
}) {
  return (
    <Card>
      <ChartHeader eyebrow={eyebrow} title={title} />
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={Math.floor(data.length / 6)} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={valueFormatter} width={60} />
          <Tooltip formatter={(v: number) => (valueFormatter ? valueFormatter(v) : v)} />
          <Line type="monotone" dataKey="value" stroke={color} dot={false} strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  )
}

function heatColor(value: number, min: number, max: number) {
  const t = (value - min) / (max - min || 1)
  const from = [253, 246, 236] // pale cream
  const to = [47, 107, 60] // forest green
  const mix = from.map((c, i) => Math.round(c + (to[i] - c) * t))
  return `rgb(${mix[0]}, ${mix[1]}, ${mix[2]})`
}

function SensibilidadHeatmap() {
  const flat = sensibilidadMatriz.flat()
  const min = Math.min(...flat)
  const max = Math.max(...flat)
  return (
    <Card>
      <div className="mb-4">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
          Variaciones en la TRM y el Contrato C
        </div>
        <div className="text-base font-semibold text-navy-900">
          Análisis de Sensibilidad del Precio Interno de Referencia
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-center text-xs">
          <thead>
            <tr>
              <th className="bg-navy p-2 text-white">KC \ TRM</th>
              {sensibilidadTRM.map((trm) => (
                <th key={trm} className="bg-navy p-2 font-semibold text-white">
                  {trm.toLocaleString('es-CO')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sensibilidadKC.map((kc, ri) => (
              <tr key={kc}>
                <td className="bg-forest p-2 font-semibold text-white">{kc}</td>
                {sensibilidadMatriz[ri].map((val, ci) => (
                  <td key={ci} className="p-2 font-medium text-navy-900" style={{ backgroundColor: heatColor(val, min, max) }}>
                    {val}k
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex items-center gap-2 text-[11px] text-gray-400">
        <span>Bajo</span>
        <div
          className="h-2 flex-1 rounded"
          style={{ background: `linear-gradient(to right, ${heatColor(min, min, max)}, ${heatColor(max, min, max)})` }}
        />
        <span>Alto</span>
        <span className="italic">COP/carga (miles)</span>
      </div>
    </Card>
  )
}

export function PrecioInterno() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.titulo} {...kpi} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TimeSeriesCard
          eyebrow="Serie de tiempo"
          title="Precio Interno del Café"
          data={precioInternoTiempo}
          color="#1f3a5f"
          valueFormatter={(v) => `$${Math.round(v / 1000)}k`}
        />
        <TimeSeriesCard eyebrow="Serie de tiempo" title="Contrato C · ICE" data={contratoCTiempo} color="#2f6b3c" />
        <TimeSeriesCard eyebrow="Serie de tiempo" title="Diferencial UGQ" data={diferencialTiempo} color="#3c7a45" />
        <TimeSeriesCard
          eyebrow="Serie de tiempo"
          title="Tasa de Cambio (TRM)"
          data={tasaCambioTiempo}
          color="#e8963c"
          valueFormatter={(v) => `$${(v / 1000).toFixed(1)}k`}
        />
      </div>

      <Card>
        <ChartHeader eyebrow="" title="Descomposición del Precio Interno de Referencia [Var. mensual]" />
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={descomposicionPrecio} stackOffset="sign">
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${Math.round(v / 1000)}k`} width={60} />
            <Tooltip formatter={(v: number) => `$${v.toLocaleString('es-CO')}`} />
            <Legend />
            <Bar dataKey="contratoC" name="Efecto Contrato C" stackId="s" fill="#1f3a5f" />
            <Bar dataKey="diferencial" name="Efecto Diferencial" stackId="s" fill="#7cb87a" />
            <Bar dataKey="trm" name="Efecto TRM" stackId="s" fill="#2f6b3c" />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <SensibilidadHeatmap />
    </div>
  )
}
