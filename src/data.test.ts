import { act, renderHook } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import {
  addBak,
  addGuest,
  addStreep,
  herroepBetaling,
  meldBetaling,
  removeOne,
  saveGroup,
  saveProfile,
  setRole,
  sluitPeriode,
  undo,
  useBetaling,
  useEntries,
  useGroup,
  useOwnEntries,
  usePeriodes,
  useProfile,
} from './data'
import type { Period } from './data'

// The Firestore SDK is mocked down to paths and payloads: what we want to know
// is that the writers land on periods/{pid}/entries with the right delta, and
// that useEntries re-renders on an incoming snapshot (someone else's write).
const calls = {
  added: [] as [string, Record<string, unknown>][],
  deleted: [] as string[],
  set: [] as [string, Record<string, unknown>][],
  batchSet: [] as [string, Record<string, unknown>, Record<string, unknown> | undefined][],
}
let emit: ((snap: unknown) => void) | undefined
let queryFilter: { field: string; value: unknown } | undefined
let getDocsResult: { empty: boolean } = { empty: true }

vi.mock('./firebase', () => ({ db: {} }))

vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, ...path: string[]) => path.join('/'),
  doc: (_db: unknown, ...path: string[]) => path.join('/'),
  query: (path: string, whereClause: { field: string; value: unknown }) => {
    queryFilter = whereClause
    return path
  },
  where: (field: string, _op: string, value: unknown) => ({ field, value }),
  addDoc: (path: string, data: Record<string, unknown>) => {
    calls.added.push([path, data])
    return Promise.resolve({ id: 'nieuw' })
  },
  deleteDoc: (path: string) => {
    calls.deleted.push(path)
    return Promise.resolve()
  },
  getDoc: () => Promise.resolve({ exists: () => true }),
  getDocs: () => Promise.resolve(getDocsResult),
  setDoc: (path: string, data: Record<string, unknown>) => {
    calls.set.push([path, data])
    return Promise.resolve()
  },
  onSnapshot: (_path: string, cb: NonNullable<typeof emit>) => {
    emit = cb
    return () => {
      emit = undefined
    }
  },
  serverTimestamp: () => 'TS',
  writeBatch: () => ({
    set: (path: string, data: Record<string, unknown>, opts?: Record<string, unknown>) => {
      calls.batchSet.push([path, data, opts])
    },
    commit: () => {
      calls.set.push(...calls.batchSet.map(([p, d]) => [p, d] as [string, Record<string, unknown>]))
      return Promise.resolve()
    },
  }),
  Timestamp: { fromDate: (d: Date) => 'TS:' + d.toISOString().slice(0, 10) },
}))

beforeEach(() => {
  calls.added = []
  calls.deleted = []
  calls.set = []
  calls.batchSet = []
  emit = undefined
  queryFilter = undefined
  getDocsResult = { empty: true }
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

test('useProfile leest users/{uid} en volgt wijzigingen', () => {
  const { result } = renderHook(() => useProfile('u1'))
  expect(result.current).toBeUndefined()

  act(() => emit!({ data: () => ({ nick: 'Wollie', name: 'Wout D.', mail: 'w@x.be' }) }))
  expect(result.current).toEqual({ nick: 'Wollie', naam: 'Wout D.', mail: 'w@x.be' })
})

test('saveProfile schrijft nick, naam en mail naar users/{uid} zonder de rest te overschrijven', async () => {
  await saveProfile('u1', 'Wollie', 'Wout D.', 'w@x.be')
  expect(calls.set).toEqual([['users/u1', { nick: 'Wollie', name: 'Wout D.', mail: 'w@x.be' }]])
})

/** The bug this field name exists to prevent: userDoc() refreshes `email` on every
 *  login, so a payout address saved there would be silently reverted. */
test('saveProfile raakt het email-veld van het Google-account niet aan', async () => {
  await saveProfile('u1', 'Wollie', 'Wout D.', 'anders@x.be')
  expect(Object.keys(calls.set[0][1] as object)).not.toContain('email')
})

test('setRole schrijft alleen de rol, de rest van het profiel blijft staan', async () => {
  await setRole('u2', 'drankleider')
  expect(calls.set).toEqual([['users/u2', { role: 'drankleider' }]])
})

test('saveGroup schrijft alleen de gegeven velden naar meta/group, de rest blijft staan', async () => {
  await saveGroup({ naam: 'Chiro Elzestraat' })
  expect(calls.set).toEqual([['meta/group', { naam: 'Chiro Elzestraat' }]])
})

test('TASK-9: saveGroup schrijft ook de rekeninggegevens', async () => {
  await saveGroup({ iban: 'BE68 5390 0754 7034', begunstigde: 'Chiro Elzestraat vzw' })
  expect(calls.set).toEqual([['meta/group', { iban: 'BE68 5390 0754 7034', begunstigde: 'Chiro Elzestraat vzw' }]])
})

/** The bug this guards: Beheer used to be hidden behind `group` being loaded, so a
 *  missing doc or a denied read (a rules change not yet deployed) silently showed
 *  the stub instead of the screen. A group name is cosmetic, so it falls back. */
test('useGroup geeft meteen de standaardwaarden, ook voor de eerste snapshot', () => {
  const { result } = renderHook(() => useGroup())
  expect(result.current).toEqual({ naam: 'Chiro Elzestraat', iban: '', begunstigde: '' })

  act(() => emit!({ data: () => ({ naam: 'Chiro Elzestraat Zuid' }) }))
  // een doc zonder iban/begunstigde (elke groep van vóór TASK-9) valt terug op de lege standaard
  expect(result.current).toEqual({ naam: 'Chiro Elzestraat Zuid', iban: '', begunstigde: '' })

  act(() => emit!({ data: () => ({ naam: 'Chiro Elzestraat Zuid', iban: 'BE68 5390 0754 7034', begunstigde: 'Chiro Elzestraat vzw' }) }))
  expect(result.current).toEqual({ naam: 'Chiro Elzestraat Zuid', iban: 'BE68 5390 0754 7034', begunstigde: 'Chiro Elzestraat vzw' })
})

test('TASK-10: usePeriodes leest de hele periods-collectie, gesorteerd op nr', () => {
  getDocsResult = { empty: false } // niet leeg, dus geen zaai-schrijf
  const { result } = renderHook(() => usePeriodes())

  act(() =>
    emit!({
      docs: [
        { id: 'p2', data: () => ({ nr: 2, start: '2026-08-01', eind: '2026-08-31', perBak: 24, prijs: 1.5, bakPrijs: 30 }) },
        { id: 'p1', data: () => ({ nr: 1, start: '2026-07-01', eind: '2026-07-31', perBak: 24, prijs: 1.5, bakPrijs: 30 }) },
        { id: 'p3', data: () => ({ nr: 3, start: '2026-09-01', eind: null, perBak: 24, prijs: 1.5, bakPrijs: 30 }) },
      ],
    }),
  )

  expect(result.current.map((p) => p.id)).toEqual(['p1', 'p2', 'p3'])
})

test('TASK-10: usePeriodes zaait periods/p1 als de collectie leeg is', async () => {
  getDocsResult = { empty: true }
  renderHook(() => usePeriodes())
  await Promise.resolve()
  await Promise.resolve()

  expect(calls.set).toHaveLength(1)
  const [path, data] = calls.set[0]
  expect(path).toBe('periods/p1')
  expect(data).toMatchObject({ nr: 1, eind: null, eindAt: null, perBak: 24, prijs: 1.5, bakPrijs: 30 })
})

test('TASK-10 AC5: useOwnEntries filtert de periode-boekingen op personRef', () => {
  const { result } = renderHook(() => useOwnEntries('p3', 'user:u1'))
  expect(queryFilter).toEqual({ field: 'personRef', value: 'user:u1' })

  act(() =>
    emit!({
      docs: [{ id: 'e1', data: () => ({ personRef: 'user:u1', kind: 'streep', delta: 3 }) }],
    }),
  )
  expect(result.current).toEqual([{ id: 'e1', personRef: 'user:u1', kind: 'streep', delta: 3 }])
})

test('TASK-10 AC3: sluitPeriode schrijft in één batch de einddatum op de sluitende periode en de nieuwe periode erna, zonder totals', async () => {
  const period: Period = {
    nr: 3,
    start: '2026-08-01',
    eind: null,
    startAt: 'TS:2026-08-01' as unknown as Period['startAt'],
    eindAt: null,
    perBak: 24,
    prijs: 1.5,
    bakPrijs: 30,
  }

  await sluitPeriode(period, '2026-08-31', 2, 36, 'u1')

  expect(calls.set).toEqual([
    ['periods/p3', { eind: '2026-08-31', eindAt: 'TS:2026-08-31', closedBy: 'u1', closedAt: 'TS' }],
    [
      'periods/p4',
      { nr: 4, start: '2026-09-01', startAt: 'TS:2026-09-01', eind: null, eindAt: null, perBak: 24, prijs: 2, bakPrijs: 36 },
    ],
  ])
  expect(Object.keys(calls.set[0][1])).not.toContain('totals')
  expect(Object.keys(calls.set[1][1])).not.toContain('totals')
})

test('TASK-9: useBetaling is open zonder doc, en volgt gemeld/betaald zoals ze binnenkomen', () => {
  const { result } = renderHook(() => useBetaling('p3', 'user:u1'))
  expect(result.current).toBe('open')

  act(() => emit!({ data: () => ({ status: 'gemeld' }) }))
  expect(result.current).toBe('gemeld')

  act(() => emit!({ data: () => ({ status: 'betaald' }) }))
  expect(result.current).toBe('betaald')
})

test('TASK-9: melden en herroepen schrijven/verwijderen periods/{pid}/betalingen/{personRef}', async () => {
  await meldBetaling('p3', 'user:u1')
  expect(calls.set).toEqual([['periods/p3/betalingen/user:u1', { status: 'gemeld', at: 'TS' }]])

  await herroepBetaling('p3', 'guest:g1')
  expect(calls.deleted).toEqual(['periods/p3/betalingen/guest:g1'])
})
