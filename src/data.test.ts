import { act, renderHook } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import { addBak, addGuest, addStreep, removeOne, undo, useEntries } from './data'

// The Firestore SDK is mocked down to paths and payloads: what we want to know
// is that the writers land on periods/{pid}/entries with the right delta, and
// that useEntries re-renders on an incoming snapshot (someone else's write).
const calls = { added: [] as [string, Record<string, unknown>][], deleted: [] as string[] }
let emit: ((snap: { docs: { id: string; data: () => unknown }[] }) => void) | undefined

vi.mock('./firebase', () => ({ db: {} }))

vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, ...path: string[]) => path.join('/'),
  doc: (_db: unknown, ...path: string[]) => path.join('/'),
  addDoc: (path: string, data: Record<string, unknown>) => {
    calls.added.push([path, data])
    return Promise.resolve({ id: 'nieuw' })
  },
  deleteDoc: (path: string) => {
    calls.deleted.push(path)
    return Promise.resolve()
  },
  getDoc: () => Promise.resolve({ exists: () => true }),
  setDoc: () => Promise.resolve(),
  onSnapshot: (_path: string, cb: NonNullable<typeof emit>) => {
    emit = cb
    return () => {
      emit = undefined
    }
  },
  serverTimestamp: () => 'TS',
}))

beforeEach(() => {
  calls.added = []
  calls.deleted = []
  emit = undefined
})

test('useEntries leest de periode-boekingen en volgt wat anderen erbij schrijven', () => {
  const { result } = renderHook(() => useEntries('p1'))
  expect(result.current).toEqual([])

  // een andere leider schrijft een streep: onSnapshot levert hem aan, geen refresh
  act(() =>
    emit!({ docs: [{ id: 'e1', data: () => ({ personRef: 'user:u2', kind: 'streep', delta: 1, byNick: 'Wollie' }) }] }),
  )

  expect(result.current).toEqual([
    { id: 'e1', personRef: 'user:u2', kind: 'streep', delta: 1, byNick: 'Wollie' },
  ])
})

test('useEntries wacht op een periode en zegt zijn abonnement op', () => {
  renderHook(() => useEntries(undefined))
  expect(emit).toBeUndefined()

  const { unmount } = renderHook(() => useEntries('p1'))
  expect(emit).toBeDefined()
  unmount()
  expect(emit).toBeUndefined()
})

test('boekingen landen op periods/{pid}/entries met wie, voor wie, wat en wanneer', async () => {
  await addStreep('p1', 'user:u2', 'u1', 'Sander')
  await addBak('p1', 'guest:g0', 'u1', 'Sander', 3)
  await removeOne('p1', 'user:u2', 'streep', 'u1', 'Sander')

  expect(calls.added).toEqual([
    ['periods/p1/entries', { personRef: 'user:u2', kind: 'streep', delta: 1, by: 'u1', byNick: 'Sander', at: 'TS' }],
    ['periods/p1/entries', { personRef: 'guest:g0', kind: 'bak', delta: 3, by: 'u1', byNick: 'Sander', at: 'TS' }],
    ['periods/p1/entries', { personRef: 'user:u2', kind: 'streep', delta: -1, by: 'u1', byNick: 'Sander', at: 'TS' }],
  ])
})

test('ongedaan maken verwijdert precies die ene boeking', async () => {
  await undo('p1', 'e7')
  expect(calls.deleted).toEqual(['periods/p1/entries/e7'])
})

test('een gast hoort bij één periode', async () => {
  await addGuest('p1', 'Wollie', 'Wout D.', null, 'u1')
  expect(calls.added).toEqual([
    ['periods/p1/guests', { nick: 'Wollie', naam: 'Wout D.', mail: null, by: 'u1', at: 'TS' }],
  ])
})
