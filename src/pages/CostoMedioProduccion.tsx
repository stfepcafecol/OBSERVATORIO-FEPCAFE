import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, ChartHeader } from '../components/Card'
import { Badge } from '../components/Badge'
import {
  costoMedioActual,
  costoMedioSerie,
  costoMedioVarAnio,
  costoMedioVarMes,
  estructuraCosto,
  estructuraDetallada,
  insumosPrecios,
} from '../data/costos'

const PIE_COLORS = ['#2f6b3c', '#7cb87a', '#c8e0c0']
const BAR_COLORS = ['#2f6b3c', '#3c7a45', '#4a8752', '#5c9a5f', '#6fae6f', '#8fc088', '#a8d0a0', '#c1dfb9', '#dbeed4']

export function CostoMedioProduccion() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="rounded-xl bg-navy p-6 text-white shadow-sm">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-white/70">Indicador Principal</div>
        <div className="mb-2 text-sm text-white/80">Costo Medio de Producción · COP por Carga – 125 Kg C.P.S.</div>
        <div className="flex items-baseline gap-3">
          <span className="text-3xl font-bold">$ {costoMedioActual.toLocaleString('es-CO')}</span>
          <Badge value={costoMedioVarMes} />
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
            +{costoMedioVarAnio}% año
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <ChartHeader eyebrow="Serie de tiempo · COP/carga" title="Costo Medio de Producción" />
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={costoMedioSerie}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="label" tick={{ fontSize: 9 }} interval={11} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${Math.round(v / 1000)}k`} width={60} />
              <Tooltip formatter={(v: number) => `$${v.toLocaleString('es-CO')}`} />
              <Line type="monotone" dataKey="value" stroke="#1f3a5f" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <ChartHeader eyebrow="Distribución porcentual" title="Estructura del Costo de Producción" />
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={estructuraCosto} dataKey="value" nameKey="name" outerRadius={90} label={(d) => `${d.value}%`}>
                {estructuraCosto.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => `${v}%`} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <ChartHeader eyebrow="Distribución por componente (%)" title="Estructura Detallada de Costos" />
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={estructuraDetallada} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={110} />
              <Tooltip formatter={(v: number) => `${v}%`} />
              <Bar dataKey="value">
                {estructuraDetallada.map((_, i) => (
                  <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <ChartHeader eyebrow="Herbicidas · Fungicidas · Fertilizantes" title="Evolución de Precios de Insumos" />
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={insumosPrecios}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="label" tick={{ fontSize: 9 }} interval={11} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${Math.round(v / 1000)}k`} width={50} />
              <Tooltip formatter={(v: number) => `$${v.toLocaleString('es-CO')}`} />
              <Legend />
              <Line type="monotone" dataKey="fertilizantes" name="Fertilizantes" stroke="#1f3a5f" dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="fungicidas" name="Fungicidas" stroke="#e8963c" dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="herbicidas" name="Herbicidas" stroke="#a12f2f" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  )
}
