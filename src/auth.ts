import { useEffect, useState } from 'react'
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as fbSignOut,
  type User,
} from 'firebase/auth'
import { doc, getDoc, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore'
import { auth, db, googleProvider } from './firebase'

/** The users/{uid} payload refreshed on every login. merge:true makes it create-on-first-login too.
 *  nick is NOT here: once a user sets their own nick (TASK-5's Mijn profiel), logging in again must
 *  not overwrite it. The derived fallback nick is seeded once, only when the doc doesn't exist yet. */
export const userDoc = (user: Pick<User, 'displayName' | 'email' | 'photoURL'>) => ({
  name: user.displayName,
  email: user.email,
  photoURL: user.photoURL,
  lastLogin: serverTimestamp(),
})

export const signIn = () => signInWithPopup(auth, googleProvider)
export const signOut = () => fbSignOut(auth)

/** Consumes an invite atomically: users/{uid} is only created in the same batch
 *  that deletes invites/{email}, so the invite can never be spent twice (TASK-7
 *  AC7). firestore.rules only allows the create half when that invite doc still
 *  exists, so an uninvited address makes this batch fail as a whole. */
const claimInvite = (u: User) => {
  const batch = writeBatch(db)
  batch.set(doc(db, 'users', u.uid), {
    ...userDoc(u),
    nick: u.displayName?.split(' ')[0] ?? '?',
    role: 'lid',
  })
  batch.delete(doc(db, 'invites', (u.email ?? '').toLowerCase()))
  return batch.commit()
}

/** undefined = still checking, user = signed in, null = signed out.
 *  authError carries "you're not invited" for Login to show (AC8): that failure
 *  only surfaces after the popup has already closed and onAuthStateChanged has
 *  fired, so signIn()'s own promise in Login.tsx can't catch it. */
export function useAuth() {
  const [user, setUser] = useState<User | null>()
  const [authError, setAuthError] = useState<string>()

  useEffect(
    () =>
      onAuthStateChanged(auth, (u) => {
        setUser(u)
        if (!u) return
        setAuthError(undefined)

        const ref = doc(db, 'users', u.uid)
        getDoc(ref)
          .then((snap) => {
            if (snap.exists()) {
              // Al lid: alleen de Google-profielvelden verversen, nick en role nooit aanraken.
              return setDoc(ref, userDoc(u), { merge: true })
            }
            return claimInvite(u).catch(() => {
              setAuthError('Dit Google-account is niet uitgenodigd voor deze groep.')
              return fbSignOut(auth)
            })
          })
          .catch(() => {
            // Reading/refreshing your own doc failed for another reason — rules not
            // deployed yet is exactly this shape. Fail closed instead of leaving an
            // uncaught rejection and the user stuck on a blank screen.
            setAuthError('Aanmelden lukte niet. Probeer het opnieuw.')
            fbSignOut(auth)
          })
      }),
    [],
  )

  return [user, authError] as const
}
