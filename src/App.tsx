import { useAuth } from './auth'
import { Login } from './Login'
import { Lijst } from './Lijst'
import { useOnline } from './offline'

/** Amber strip over everything: the shell still works, the data is stale. */
function OfflineBanner() {
  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        insetInline: 0,
        top: 0,
        zIndex: 99,
        padding: '6px 12px',
        paddingTop: 'max(6px, env(safe-area-inset-top))',
        background: '#F0A32B',
        color: '#121310',
        font: '600 13px/1.3 "Space Grotesk", system-ui, sans-serif',
        textAlign: 'center',
      }}
    >
      Geen internet — streepjes worden niet bijgewerkt
    </div>
  )
}

export function App() {
  const [user, authError] = useAuth()
  const online = useOnline()

  if (user === undefined) return null

  return (
    <>
      {!online && <OfflineBanner />}
      {user === null ? <Login uitnodigingsFout={authError} /> : <Lijst user={user} />}
    </>
  )
}
