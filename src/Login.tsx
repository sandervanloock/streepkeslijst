import { useState } from 'react'
import { signIn } from './auth'

// Same palette/type as Lijst.tsx; the canvas glow + scanline live on body in index.html.
const paper = '#F4F1E6'
const lime = '#D8F651'
const red = '#E4483A'

export function Login() {
  const [error, setError] = useState<string>()

  const onClick = () =>
    signIn().catch((e) => setError(e instanceof Error ? e.message : String(e)))

  return (
    <main
      style={{
        boxSizing: 'border-box',
        minHeight: '100dvh',
        color: paper,
        // Wordmark in the upper third, button pushed down to thumb reach, so the
        // layout spans the screen instead of huddling in the middle.
        padding: '18vh 18px calc(24px + env(safe-area-inset-bottom))',
        display: 'flex',
        flexDirection: 'column',
        gap: 22,
      }}
    >
      <div>
        <div style={{ font: '400 10px ui-monospace,monospace', letterSpacing: '.16em', color: 'rgba(244,241,230,.45)' }}>
          CHIRO ELZESTRAAT
        </div>
        <h1
          style={{
            margin: '10px 0 0',
            font: '400 44px/0.95 Anton,sans-serif',
            letterSpacing: '-.01em',
            textTransform: 'uppercase',
            color: paper,
          }}
        >
          Streepkeslijst
        </h1>
        <p style={{ margin: '10px 0 0', font: '400 12.5px/1.55 "Space Grotesk",sans-serif', color: 'rgba(244,241,230,.55)' }}>
          Meld je aan om streepjes te zetten voor jezelf en de rest van de ploeg.
        </p>
      </div>

      <button
        onClick={onClick}
        style={{
          flex: 'none',
          marginTop: 'auto',
          width: '100%',
          minHeight: 58,
          padding: 16,
          border: 'none',
          borderRadius: 8,
          background: lime,
          color: '#121310',
          font: '400 17px/1 Anton,sans-serif',
          letterSpacing: '.04em',
          textTransform: 'uppercase',
          cursor: 'pointer',
        }}
      >
        Aanmelden met Google
      </button>

      {error && (
        <div
          role="alert"
          style={{
            padding: '10px 11px',
            borderRadius: 8,
            background: 'rgba(228,72,58,.16)',
            border: `1px solid ${red}`,
            font: '500 11.5px/1.45 "Space Grotesk",sans-serif',
            color: paper,
          }}
        >
          {error}
        </div>
      )}
    </main>
  )
}
