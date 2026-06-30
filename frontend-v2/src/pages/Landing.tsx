import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

export function Landing() {
  const navigate = useNavigate()
  const [phase, setPhase] = useState<'enter' | 'hold' | 'exit'>('enter')

  useEffect(() => {
    const hold = setTimeout(() => setPhase('hold'), 100)
    const exit = setTimeout(() => setPhase('exit'), 2200)
    const nav  = setTimeout(() => navigate('/overview'), 2800)
    return () => { clearTimeout(hold); clearTimeout(exit); clearTimeout(nav) }
  }, [navigate])

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center"
      style={{
        background: 'var(--bg)',
        zIndex: 100,
        opacity: phase === 'exit' ? 0 : 1,
        transition: phase === 'exit' ? 'opacity 0.6s ease' : 'none',
      }}
    >
      {/* Aurora */}
      <div aria-hidden className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
        <div className="aurora-blob aurora-1" />
        <div className="aurora-blob aurora-2" />
        <div className="aurora-blob aurora-3" />
        <div className="aurora-blob aurora-4" />
      </div>

      {/* Content */}
      <div
        className="relative z-10 flex flex-col items-center text-center select-none"
        style={{
          transform: phase === 'enter' ? 'scale(0.82)' : phase === 'hold' ? 'scale(1)' : 'scale(1.12)',
          opacity: phase === 'enter' ? 0 : 1,
          transition: phase === 'enter'
            ? 'none'
            : phase === 'hold'
            ? 'transform 1.1s cubic-bezier(0.16,1,0.3,1), opacity 0.7s ease'
            : 'transform 0.6s ease, opacity 0.6s ease',
        }}
      >
        <h1
          className="font-black tracking-tight leading-none"
          style={{ fontSize: 'clamp(3.5rem, 10vw, 7rem)', color: 'var(--text)' }}
        >
          Dark<span style={{ color: '#60a5fa' }}>Leak</span>
        </h1>
        <p
          className="mt-4 text-xs font-medium tracking-[0.3em] uppercase"
          style={{ color: 'var(--text-muted)' }}
        >
          Darknet Threat Intelligence Platform
        </p>
      </div>
    </div>
  )
}
