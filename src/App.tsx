import { useAuth } from './auth'
import { Login } from './Login'
import { Lijst } from './Lijst'

export function App() {
  const user = useAuth()

  if (user === undefined) return null
  if (user === null) return <Login />

  return <Lijst user={user} />
}
