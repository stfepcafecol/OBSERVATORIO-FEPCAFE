import { Card } from './Card'
import { Badge } from './Badge'

export function KpiCard({
  titulo,
  subtitulo,
  valor,
  unidad,
  variacion,
  min,
  max,
}: {
  titulo: string
  subtitulo: string
  valor: string
  unidad: string
  variacion: number
  min: string
  max: string
}) {
  return (
    <Card>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{titulo}</div>
      <div className="mb-2 text-xs text-gray-500">{subtitulo}</div>
      <div className="mb-1 flex flex-wrap items-baseline gap-2">
        <span className="whitespace-nowrap text-2xl font-bold text-navy-900">{valor}</span>
        {unidad && <span className="whitespace-nowrap text-sm text-gray-500">{unidad}</span>}
        <Badge value={variacion} />
      </div>
      <div className="text-xs text-gray-400">
        Mín: {min} &nbsp;&nbsp; Máx: {max}
      </div>
    </Card>
  )
}
