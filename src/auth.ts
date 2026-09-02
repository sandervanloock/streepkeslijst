import { useEffect, useState } from 'react'
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as fbSignOut,
  type User,
} from 'firebase/auth'
import { doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { auth, db, googleProvider } from './firebase'

/** The users/{uid} payload. merge:true makes it create-on-first-login and refresh after. */
export const userDoc = (user: Pick<User, 'displayName' | 'email' | 'photoURL'>) => ({
  name: user.displayName,
  // nick is the Anton row name on the lijst; no profile screen yet to set it explicitly (TASK-3).
  nick: user.displayName?.split(' ')[0] ?? '?',
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
        if (u) setDoc(doc(db, 'users', u.uid), userDoc(u), { merge: true })
      }),
    [],
  )

  return user
}
