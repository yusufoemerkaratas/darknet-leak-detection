interface KbdProps {
  children: React.ReactNode
  className?: string
}

export function Kbd({ children, className = '' }: KbdProps) {
  return (
    <kbd
      className={`inline-flex items-center justify-center px-1.5 py-0.5 min-w-[1.25rem] rounded text-[10px] font-mono border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] leading-none select-none ${className}`}
    >
      {children}
    </kbd>
  )
}
