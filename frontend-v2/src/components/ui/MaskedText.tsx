import { useState } from 'react'

const EyeOpen = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
    <path d="M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
    <path fillRule="evenodd" d="M.664 10.59a1.651 1.651 0 0 1 0-1.186A10.004 10.004 0 0 1 10 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0 1 10 17c-4.257 0-7.893-2.66-9.336-6.41ZM14 10a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" clipRule="evenodd" />
  </svg>
)

const EyeSlash = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
    <path fillRule="evenodd" d="M3.28 2.22a.75.75 0 0 0-1.06 1.06l14.5 14.5a.75.75 0 1 0 1.06-1.06l-1.745-1.745a10.029 10.029 0 0 0 3.3-4.38 1.651 1.651 0 0 0 0-1.185A10.004 10.004 0 0 0 9.999 3a9.956 9.956 0 0 0-4.744 1.194L3.28 2.22ZM7.752 6.69l1.092 1.092a2.5 2.5 0 0 1 3.374 3.373l1.091 1.092a4 4 0 0 0-5.557-5.557Z" clipRule="evenodd" />
    <path d="M10.748 13.93l2.523 2.524a10.065 10.065 0 0 1-3.27.547c-4.258 0-7.894-2.66-9.337-6.41a1.651 1.651 0 0 1 0-1.186A10.007 10.007 0 0 1 2.839 6.02L6.07 9.252a4 4 0 0 0 4.678 4.678Z" />
  </svg>
)

interface MaskedTextProps {
  value: string
  placeholder?: string
  className?: string
}

export function MaskedText({ value, placeholder = '••••••••••', className = '' }: MaskedTextProps) {
  const [revealed, setRevealed] = useState(false)

  return (
    <span className={`inline-flex items-center gap-1.5 group ${className}`}>
      <span
        className={
          revealed
            ? 'text-[var(--text)]'
            : 'tracking-[0.18em] text-[var(--text-muted)] select-none text-[10px]'
        }
      >
        {revealed ? value : placeholder}
      </span>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setRevealed((v) => !v) }}
        className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 text-[var(--text-muted)] hover:text-[var(--primary)]"
        title={revealed ? 'Hide' : 'Reveal'}
      >
        {revealed ? <EyeOpen /> : <EyeSlash />}
      </button>
    </span>
  )
}
