import { useState } from 'react'
import { Header, type TabName } from './components/Header'
import { PrecioInterno } from './pages/PrecioInterno'
import { Produccion } from './pages/Produccion'
import { CostoMedioProduccion } from './pages/CostoMedioProduccion'
import { IndicesPrecios } from './pages/IndicesPrecios'
import { MecanismoPAI } from './pages/MecanismoPAI'
import { MecanismoMeCIC } from './pages/MecanismoMeCIC'

const PAGES: Record<TabName, () => JSX.Element> = {
  'Precio Interno': PrecioInterno,
  Producción: Produccion,
  'Costo Medio de Producción': CostoMedioProduccion,
  'Índices de Precios': IndicesPrecios,
  'Mecanismo PAI': MecanismoPAI,
  'Mecanismo MeCIC': MecanismoMeCIC,
}

export default function App() {
  const [tab, setTab] = useState<TabName>('Precio Interno')
  const Page = PAGES[tab]
  return (
    <div className="min-h-screen bg-cream">
      <Header active={tab} onChange={setTab} />
      <main className="mx-auto max-w-[1400px]">
        <Page />
      </main>
    </div>
  )
}
