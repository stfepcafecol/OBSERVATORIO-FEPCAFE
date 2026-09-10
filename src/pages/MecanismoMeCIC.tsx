import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card, ChartHeader } from '../components/Card'
import { mecicAlertasConMedia, mecicReferenciaColumnas, mecicReferenciaFilas } from '../data/mecic'

function ReferenciaTabla() {
  return (
    <Card>
      <ChartHeader eyebrow="Mecanismo MeCIC" title="Tabla de referencia" />
      <table className="w-full text-center text-sm">
        <thead>
          <tr>
            {mecicReferenciaColumnas.map((col) => (
              <th key={col} className="bg-navy p-2 text-white">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: mecicReferenciaFilas }).map((_, i) => (
            <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-cream'}>
              {mecicReferenciaColumnas.map((col) => (
                <td key={col} className="p-3 text-gray-400">
                  —
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}

export function MecanismoMeCIC() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <ReferenciaTabla />
        <Card>
          <ChartHeader eyebrow="COP/Carga" title="Sistema de Alertas Mecanismo MeCIC" />
          <ResponsiveContainer width="100%" height={340}>
            <LineChart data={mecicAlertasConMedia}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="label" tick={{ fontSize: 9 }} interval={5} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${Math.round(v / 1000)}k`} width={60} domain={[1200000, 2000000]} />
              <Tooltip formatter={(v: number) => `$${v.toLocaleString('es-CO')}`} />
              <Legend />
              <Line type="monotone" dataKey="costoMedio" name="Costo Medio de Producción" stroke="#1f3a5f" dot={false} strokeWidth={2} />
              <Line
                type="monotone"
                dataKey="limiteSuperior"
                name="Límite Superior"
                stroke="#d64545"
                strokeDasharray="5 3"
                dot={false}
                strokeWidth={2}
              />
              <Line type="monotone" dataKey="mediaMovil" name="Media Móvil del precio FF94" stroke="#2f6b3c" dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="precioInterno" name="Precio Interno" stroke="#e8963c" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  )
}
