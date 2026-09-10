import type { ReactNode } from 'react'

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-black/5 bg-white p-5 shadow-sm ${className}`}>{children}</div>
  )
}

export function ChartHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mb-4">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{eyebrow}</div>
      <div className="text-base font-semibold text-navy-900">{title}</div>
    </div>
  )
}

export function SectionBanner({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="rounded-xl bg-navy px-5 py-4 text-white shadow-sm">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-white/70">{eyebrow}</div>
      <div className="text-base font-semibold">{title}</div>
    </div>
  )
}
