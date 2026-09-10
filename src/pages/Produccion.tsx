import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, ChartHeader, SectionBanner } from '../components/Card'
import {
  produccionAcumulada12M,
  produccionAnioCafetero,
  produccionMensual10Anios,
  roniForecast,
  roniSerie,
} from '../data/produccion'

const AÑO_COLORS: Record<string, string> = {
  '2022': '#1f3a5f',
  '2023': '#2f6b3c',
  '2024': '#5c9a5f',
  '2025': '#e8963c',
  '2026': '#8fa8d9',
}

const AÑO_CAFETERO_COLORS: Record<string, string> = {
  '2022-23': '#1f3a5f',
  '2023-24': '#2f6b3c',
  '2024-25': '#5c9a5f',
  '2025-26': '#e8963c',
}

export function Produccion() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <Card>
        <ChartHeader eyebrow="Miles de sacos 60 kg" title="Producción colombiana de café (Acumulado 12 meses)" />
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={produccionAcumulada12M}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
            <YAxis domain={[10000, 15000]} tick={{ fontSize: 11 }} width={50} />
            <Tooltip />
            <Legend />
            {Object.keys(AÑO_COLORS).map((year) => (
              <Line key={year} type="monotone" dataKey={year} stroke={AÑO_COLORS[year]} dot={false} strokeWidth={2} connectNulls />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <ChartHeader eyebrow="Miles de sacos 60 kg" title="Producción mensual de café (Últimos 10 años del mes de referencia)" />
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={produccionMensual10Anios}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="label" tick={{ fontSize: 9 }} interval={11} />
              <YAxis tick={{ fontSize: 11 }} width={50} />
              <Tooltip />
              <Bar dataKey="value" fill="#2f6b3c" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <ChartHeader eyebrow="Miles de sacos 60 kg" title="Producción colombiana de café [Año cafetero] (Acumulado 1 Mes)" />
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={produccionAnioCafetero}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
              <YAxis domain={[600, 1200]} tick={{ fontSize: 11 }} width={50} />
              <Tooltip />
              <Legend />
              {Object.keys(AÑO_CAFETERO_COLORS).map((year) => (
                <Line
                  key={year}
                  type="monotone"
                  dataKey={year}
                  stroke={AÑO_CAFETERO_COLORS[year]}
                  dot={false}
                  strokeWidth={2}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <SectionBanner eyebrow="Condiciones" title="Condición Agroclimática y Fitosanitaria" />

      <Card>
        <ChartHeader eyebrow="Serie mensual" title="Índice Oceánico Relativo El Niño (RONI)" />
        <div className="mb-2 flex gap-4 text-xs">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" /> El Niño (&gt; 0.5)</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-300" /> La Niña (&lt; -0.5)</span>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={roniSerie}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey="label" tick={{ fontSize: 9 }} interval={11} />
            <YAxis domain={[-2.5, 4.2]} tick={{ fontSize: 11 }} width={40} />
            <Tooltip />
            <ReferenceLine y={0.5} stroke="#d64545" strokeDasharray="4 4" />
            <ReferenceLine y={-0.5} stroke="#8fa8d9" strokeDasharray="4 4" />
            <Bar dataKey="value" fill="#1f2937" />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card>
        <ChartHeader eyebrow="Con intervalos de confianza P25-P75" title="Pronóstico del Índice Oceánico Relativo El Niño" />
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={roniForecast}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey="label" tick={{ fontSize: 9 }} interval={5} />
            <YAxis domain={[-2, 2]} tick={{ fontSize: 11 }} width={40} />
            <Tooltip />
            <Legend />
            <ReferenceLine y={0.5} stroke="#d64545" strokeDasharray="4 4" />
            <ReferenceLine y={-0.5} stroke="#8fa8d9" strokeDasharray="4 4" />
            <Area dataKey="p25" name="P25" stackId="ci" stroke="none" fill="transparent" legendType="none" />
            <Area dataKey="rango" name="P75" stackId="ci" stroke="#7cb87a" fill="#7cb87a" fillOpacity={0.25} />
            <Line dataKey="observado" name="Observado" stroke="#1f3a5f" dot={false} strokeWidth={2} connectNulls />
            <Line dataKey="p50" name="Pronóstico P50" stroke="#1f3a5f" strokeDasharray="5 3" dot={false} strokeWidth={2} connectNulls />
          </ComposedChart>
        </ResponsiveContainer>
      </Card>
    </div>
  )
}
