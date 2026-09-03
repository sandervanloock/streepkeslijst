import { act, renderHook } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import { userDoc, useAuth } from './auth'

// The atomic-claim path (AC7/AC8) is driven at the writeBatch level: a batch
// records what it was asked to set/delete, and its own commit() either
// resolves (the invite existed, firestore.rules let it through) or rejects
// (no invite -> the caller signs back out), same as the real rules would.
let authCb: ((u: unknown) => void) | undefined
const calls = { setDoc: [] as [string, unknown][], batchSet: [] as [string, unknown][], batchDelete: [] as string[] }
const fbSignOut = vi.fn(() => Promise.resolve())
let bestaatAl = false
let commitFaalt = false

vi.mock('./firebase', () => ({ auth: {}, db: {}, googleProvider: {} }))

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth: unknown, cb: (u: unknown) => void) => {
    authCb = cb
    return () => {
      authCb = undefined
    }
  },
  signInWithPopup: vi.fn(),
  signOut: () => fbSignOut(),
}))

let getDocFaalt = false

vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, ...path: string[]) => path.join('/'),
  getDoc: () => (getDocFaalt ? Promise.reject(new Error('permission-denied')) : Promise.resolve({ exists: () => bestaatAl })),
  setDoc: (path: string, data: unknown) => {
    calls.setDoc.push([path, data])
    return Promise.resolve()
  },
  serverTimestamp: () => 'TS',
  writeBatch: () => ({
    set: (path: string, data: unknown) => calls.batchSet.push([path, data]),
    delete: (path: string) => calls.batchDelete.push(path),
    commit: () => (commitFaalt ? Promise.reject(new Error('permission-denied')) : Promise.resolve()),
  }),
}))

beforeEach(() => {
  authCb = undefined
  calls.setDoc = []
  calls.batchSet = []
  calls.batchDelete = []
  fbSignOut.mockClear()
  bestaatAl = false
  commitFaalt = false
  getDocFaalt = false
})

/** Flushes the getDoc().then(...) -> claimInvite().catch(...) chain: a real
 *  setTimeout tick, not fake timers, so every pending microtask runs first. */
const wacht = () => act(() => new Promise((r) => setTimeout(r, 0)))

test('the user record keeps the Google profile fields', () => {
  const { name, email, photoURL, lastLogin } = userDoc({
    displayName: 'Jan Peeters',
    email: 'jan@example.com',
    photoURL: 'https://example.com/jan.jpg',
  })
  expect({ name, email, photoURL }).toEqual({
    name: 'Jan Peeters',
    email: 'jan@example.com',
    photoURL: 'https://example.com/jan.jpg',
  })
  expect(lastLogin).toBeDefined()
})

test('a missing profile field stays null instead of undefined (Firestore rejects undefined)', () => {
  const d = userDoc({ displayName: null, email: null, photoURL: null })
  expect(d.name).toBeNull()
  expect(d.email).toBeNull()
  expect(d.photoURL).toBeNull()
})

test('AC7: userDoc no longer carries a nick, so it can never overwrite one the user set themselves', () => {
  const d = userDoc({ displayName: 'Jan Peeters', email: 'jan@example.com', photoURL: null })
  expect(d).not.toHaveProperty('nick')
})

test('AC7: an invited address claims the invite atomically and creates users/{uid} with role lid', async () => {
  bestaatAl = false
  const { result } = renderHook(() => useAuth())
  const nieuw = { uid: 'u9', displayName: 'Nieuwe Naam', email: 'Nieuw@Mail.be', photoURL: null }

  act(() => authCb!(nieuw))
  await wacht()

  expect(calls.batchSet).toEqual([
    ['users/u9', { name: 'Nieuwe Naam', email: 'Nieuw@Mail.be', photoURL: null, lastLogin: 'TS', nick: 'Nieuwe', role: 'lid' }],
  ])
  // het adres wordt lowercased: het invite-document staat op het lowercased adres
  expect(calls.batchDelete).toEqual(['invites/nieuw@mail.be'])
  expect(result.current[0]).toBe(nieuw)
  expect(result.current[1]).toBeUndefined()
  expect(fbSignOut).not.toHaveBeenCalled()
})

test('AC8: an uninvited address never gets a users/{uid} doc and is signed back out', async () => {
  bestaatAl = false
  commitFaalt = true // firestore.rules zou de create weigeren zonder invite-doc
  const { result } = renderHook(() => useAuth())
  const vreemde = { uid: 'u9', displayName: 'Vreemde', email: 'vreemde@mail.be', photoURL: null }

  act(() => authCb!(vreemde))
  await wacht()

  expect(fbSignOut).toHaveBeenCalledTimes(1)
  expect(result.current[1]).toBe('Dit Google-account is niet uitgenodigd voor deze groep.')
})

test('reading your own doc failing (e.g. rules not deployed yet) signs out instead of an uncaught rejection', async () => {
  getDocFaalt = true
  const { result } = renderHook(() => useAuth())
  const iemand = { uid: 'u9', displayName: 'Iemand', email: 'iemand@mail.be', photoURL: null }

  act(() => authCb!(iemand))
  await wacht()

  expect(fbSignOut).toHaveBeenCalledTimes(1)
  expect(result.current[1]).toBe('Aanmelden lukte niet. Probeer het opnieuw.')
})

test('an existing member only gets the Google profile fields refreshed, not a fresh nick or role', async () => {
  bestaatAl = true
  renderHook(() => useAuth())
  const bekend = { uid: 'u1', displayName: 'Sander', email: 'sander@mail.be', photoURL: null }

  act(() => authCb!(bekend))
  await wacht()

  expect(calls.setDoc).toEqual([['users/u1', { name: 'Sander', email: 'sander@mail.be', photoURL: null, lastLogin: 'TS' }]])
  expect(calls.batchSet).toEqual([])
  expect(calls.batchDelete).toEqual([])
})
