import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

// The only place the Firebase project config lives (see CLAUDE.md). The apiKey
// is a public client identifier, not a secret.
const firebaseConfig = {
  apiKey: 'AIzaSyBNXY6BhGs2fC0pCrOciH_yHiJJ7LNkf-U',
  authDomain: 'streepkeslijst.firebaseapp.com',
  projectId: 'streepkeslijst',
  storageBucket: 'streepkeslijst.firebasestorage.app',
  messagingSenderId: '29072640211',
  appId: '1:29072640211:web:b84db942a413d100cfac26',
}

/**
 * Which named Firestore database to talk to. A production build gets 'prod',
 * anything else gets 'develop', so `npm run dev` can never reach prod data by
 * accident. VITE_FIRESTORE_DB overrides both, for a prod bundle that has to
 * point somewhere else (a staging deploy, say).
 */
export const databaseId = (override: string | undefined, isProd: boolean) =>
  override?.trim() || (isProd ? 'prod' : 'develop')

export const dbId = databaseId(import.meta.env.VITE_FIRESTORE_DB, import.meta.env.PROD)

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const googleProvider = new GoogleAuthProvider()
export const db = getFirestore(app, dbId)
