export function Badge({ value }: { value: number }) {
  const positive = value >= 0
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
        positive ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'
      }`}
    >
      {positive ? '+' : ''}
      {value}%
    </span>
  )
}
