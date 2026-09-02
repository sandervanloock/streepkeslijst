import { useEffect, useState } from 'react'

/**
 * Whether the browser has network. The service worker keeps the shell loading
 * offline, but the streepjes come from Firestore — so the screen has to say
 * out loud that what you see may be stale.
 */
export function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine)

  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  return online
}
