const TABS = [
  'Precio Interno',
  'Producción',
  'Costo Medio de Producción',
  'Índices de Precios',
  'Mecanismo PAI',
  'Mecanismo MeCIC',
] as const

export type TabName = (typeof TABS)[number]

export function Header({ active, onChange }: { active: TabName; onChange: (tab: TabName) => void }) {
  return (
    <div className="sticky top-0 z-10 bg-navy shadow-md">
      <div className="flex items-center gap-3 px-6 pt-3 pb-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-forest-light/90 text-lg">
          ☕
        </div>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-white/70">
            Fondo de Estabilización de Precios
          </div>
          <div className="text-lg font-semibold text-white">Observatorio Cafetero · Informe Mensual</div>
        </div>
      </div>
      <nav className="flex overflow-x-auto px-4">
        {TABS.map((tab) => {
          const isActive = tab === active
          return (
            <button
              key={tab}
              onClick={() => onChange(tab)}
              className={`whitespace-nowrap px-4 py-3 text-sm font-medium transition-colors ${
                isActive
                  ? 'border-b-2 border-forest-light bg-white/5 text-white'
                  : 'border-b-2 border-transparent text-white/60 hover:text-white/90'
              }`}
            >
              {tab}
            </button>
          )
        })}
      </nav>
    </div>
  )
}

export { TABS }
