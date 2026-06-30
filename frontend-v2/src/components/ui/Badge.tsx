interface BadgeProps {
  variant?: 'default' | 'success' | 'danger' | 'warning' | 'info'
  children: React.ReactNode
  className?: string
}

type VariantStyle = { light: { bg: string; color: string }; dark: { bg: string; color: string } }

const variantStyles: Record<NonNullable<BadgeProps['variant']>, VariantStyle> = {
  default: {
    light: { bg: 'var(--border)',          color: 'var(--text-muted)' },
    dark:  { bg: 'var(--border)',          color: 'var(--text-muted)' },
  },
  success: {
    light: { bg: 'rgba(134,239,172,0.30)', color: '#166534' },
    dark:  { bg: 'rgba(34,197,94,0.18)',   color: '#4ade80' },
  },
  danger: {
    light: { bg: 'rgba(252,165,165,0.35)', color: '#991b1b' },
    dark:  { bg: 'rgba(239,68,68,0.18)',   color: '#f87171' },
  },
  warning: {
    light: { bg: 'rgba(253,211,77,0.30)',  color: '#92400e' },
    dark:  { bg: 'rgba(245,158,11,0.18)',  color: '#fbbf24' },
  },
  info: {
    light: { bg: 'rgba(147,197,253,0.35)', color: '#1e40af' },
    dark:  { bg: 'rgba(59,130,246,0.18)',  color: '#60a5fa' },
  },
}

export function Badge({ variant = 'default', children, className = '' }: BadgeProps) {
  const v = variantStyles[variant]
  return (
    <span
      className={`badge-${variant} inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${className}`}
      style={
        {
          '--badge-bg-light': v.light.bg,
          '--badge-color-light': v.light.color,
          '--badge-bg-dark': v.dark.bg,
          '--badge-color-dark': v.dark.color,
        } as React.CSSProperties
      }
    >
      {children}
    </span>
  )
}
