import { useState } from 'react'
import { signIn } from './auth'

export function Login() {
  const [error, setError] = useState<string>()

  const onClick = () =>
    signIn().catch((e) => setError(e instanceof Error ? e.message : String(e)))

  return (
    <main
      style={{
        font: '16px/1.5 system-ui, sans-serif',
        padding: 24,
        background: '#121310',
        color: '#F4F1E6',
        minHeight: '100vh',
        display: 'grid',
        placeContent: 'center',
        textAlign: 'center',
        gap: 24,
      }}
    >
      <h1>Streepkeslijst</h1>
      <button
        onClick={onClick}
        style={{ font: 'inherit', padding: '16px 24px', width: '100%', minHeight: 56 }}
      >
        Aanmelden met Google
      </button>
      {error && <p style={{ color: '#E88' }}>{error}</p>}
    </main>
  )
}
