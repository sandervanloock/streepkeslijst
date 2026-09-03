import { useEffect, useState } from 'react'

/**
 * Which screen is open, kept in the URL so a refresh (or a shared link, or the
 * back button) lands where you were. The hash and not the path on purpose: this
 * is an offline-first PWA, and a hash needs no hosting rewrite and no service
 * worker navigation fallback to survive a hard reload.
 *
 * The slugs are the design's own nav keys (design line 1697-1705); the labels
 * are what the menu and the screens already use.
 */
const schermen: Record<string, string> = {
  afsluiten: 'Afsluiten',
  beheer: 'Beheer',
  profiel: 'Mijn profiel',
  betalen: 'Betalen',
  inningen: 'Inningen',
  meldingen: 'Meldingen',
}

const slugs: Record<string, string> = Object.fromEntries(
  Object.entries(schermen).map(([slug, label]) => [label, slug]),
)

/** undefined = the lijst, which is the bare app with no hash. An unknown slug is
 *  not an error worth a screen: it just falls back to the lijst. */
export const schermVanHash = (hash: string) => schermen[hash.replace(/^#\/?/, '')]

export const hashVanScherm = (scherm: string | undefined) => (scherm ? '#/' + slugs[scherm] : '#/')

export function useScherm(): [string | undefined, (scherm: string | undefined) => void] {
  const [scherm, setScherm] = useState<string | undefined>(() => schermVanHash(location.hash))

  useEffect(() => {
    const lees = () => setScherm(schermVanHash(location.hash))
    window.addEventListener('hashchange', lees)
    return () => window.removeEventListener('hashchange', lees)
  }, [])

  // Set both: the hash so a refresh comes back here, the state so the screen
  // moves now instead of waiting on a hashchange event. The listener above still
  // covers the back button, and re-setting the same screen is a no-op.
  return [
    scherm,
    (next) => {
      location.hash = hashVanScherm(next)
      setScherm(next)
    },
  ]
}
