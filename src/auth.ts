import { useEffect, useState } from 'react'
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as fbSignOut,
  type User,
} from 'firebase/auth'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
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

/** undefined = still checking, null = signed out, User = signed in. */
export function useAuth() {
  const [user, setUser] = useState<User | null>()

  useEffect(
    () =>
      onAuthStateChanged(auth, (u) => {
        setUser(u)
        if (u) {
          const ref = doc(db, 'users', u.uid)
          getDoc(ref).then((snap) => {
            const payload: Record<string, unknown> = userDoc(u)
            if (!snap.exists()) {
              payload.nick = u.displayName?.split(' ')[0] ?? '?'
              // Seeded once, for the same reason as nick: a role handed out in
              // Beheer (TASK-6) must survive every later login.
              payload.role = 'lid'
            }
            setDoc(ref, payload, { merge: true })
          })
        }
      }),
    [],
  )

  return user
}
