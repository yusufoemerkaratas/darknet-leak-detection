const WIDTHS = ['w-2/3', 'w-1/2', 'w-1/4', 'w-20', 'w-16', 'w-12', 'w-1/3', 'w-16']

export function SkeletonTableRows({ rows = 5, widths }: { rows?: number; widths?: string[] }) {
  const w = widths ?? WIDTHS
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r}>
          {w.map((wCls, c) => (
            <td key={c} className="px-5 py-4">
              <div className={`h-4 ${wCls} rounded animate-pulse bg-[var(--border)]`} />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

export function SkeletonLine({ className = '' }: { className?: string }) {
  return <div className={`rounded animate-pulse bg-[var(--border)] ${className}`} />
}
