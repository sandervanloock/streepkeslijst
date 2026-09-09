import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { User } from 'firebase/auth'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { Group, Period, Person } from './data'
import { Betalen } from './Betalen'

// Same idiom as Lijst.test.tsx: a tiny in-memory store standing in for
// Firestore, so melden/herroepen through the real writer names re-renders the
// real hook, exactly what onSnapshot does in the app. TASK-10: amounts come
// from useOwnEntries (a per-period, per-person entry ledger), not a frozen
// totals field, so the mock keeps a ledger per period id instead.
const store: Record<string, 'gemeld' | 'betaald'> = {}
const listeners = new Set<() => void>()
const calls = { meld: [] as [string, string][], herroep: [] as [string, string][] }
type Entry = { personRef: string; kind: 'streep' | 'bak'; delta: number }
let ledger: Record<string, Entry[]> = {}

vi.mock('./data', async () => {
  const { useEffect, useState } = await import('react')
  return {
    useOwnEntries: (pid: string, personRef: string) => (ledger[pid] ?? []).filter((e) => e.personRef === personRef),
    useBetaling: (pid: string, personRef: string) => {
      const [, set] = useState(0)
      useEffect(() => {
        const l = () => set((v) => v + 1)
        listeners.add(l)
        return () => void listeners.delete(l)
      }, [])
      return store[pid + '|' + personRef] ?? 'open'
    },
    meldBetaling: (pid: string, personRef: string) => {
      calls.meld.push([pid, personRef])
      store[pid + '|' + personRef] = 'gemeld'
      listeners.forEach((l) => l())
      return Promise.resolve()
    },
    herroepBetaling: (pid: string, personRef: string) => {
      calls.herroep.push([pid, personRef])
      delete store[pid + '|' + personRef]
      listeners.forEach((l) => l())
      return Promise.resolve()
    },
  }
})

const ik = { uid: 'u1' } as User
const group: Group = { naam: 'Chiro Elzestraat', iban: 'BE68 5390 0754 7034', begunstigde: 'Chiro Elzestraat vzw' }
const people: Person[] = [
  { id: 'u1', personRef: 'user:u1', nick: 'Sander', naam: 'Sander V.', isGuest: false, role: 'lid' },
  { id: 'u2', personRef: 'user:u2', nick: 'Anton', naam: 'Anton B.', isGuest: false, role: 'lid' },
]

let periodes: (Period & { id: string })[] = []

const toon = (onToast = vi.fn()) => {
  render(<Betalen user={ik} people={people} periodes={periodes} group={group} onToast={onToast} />)
  return onToast
}

beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k]
  calls.meld = []
  calls.herroep = []
  // "vandaag" in Betalen.tsx is the real clock, so every fixture below is
  // closed with an eind well in the past (AC6: a payable period's eind < today).
  periodes = [
    { id: 'p3', nr: 3, start: '2026-08-01', eind: '2026-08-31', startAt: null, eindAt: null, prijs: 1.5, bakPrijs: 30, perBak: 24 } as unknown as Period & { id: string },
    { id: 'p2', nr: 2, start: '2026-07-01', eind: '2026-07-31', startAt: null, eindAt: null, prijs: 1.4, bakPrijs: 28, perBak: 24 } as unknown as Period & { id: string },
    { id: 'p1', nr: 1, start: '2026-06-01', eind: '2026-06-30', startAt: null, eindAt: null, prijs: 1.3, bakPrijs: 26, perBak: 24 } as unknown as Period & { id: string },
  ]
  ledger = {
    p3: [{ personRef: 'user:u1', kind: 'streep', delta: 10 }],
    p2: [{ personRef: 'user:u1', kind: 'streep', delta: 5 }],
    p1: [
      { personRef: 'user:u1', kind: 'streep', delta: 8 },
      { personRef: 'user:u1', kind: 'bak', delta: 1 },
    ],
  }
})

afterEach(cleanup)

test('AC1: toont het eigen bedrag, de periode en het streepjesaantal uit de meest recente afgelopen periode', () => {
  toon()

  expect(screen.getByText('PERIODE 3 · 2026-08-01 → 2026-08-31')).toBeTruthy()
  expect(screen.getAllByText('€15,00').length).toBeGreaterThan(0) // 10 streepjes aan €1,50, de prijs die periode 3 liep, niet de latere
  expect(screen.getByText(/10 streepjes/)).toBeTruthy()
})

test('AC2: elk veld kopieert de eigen ruwe waarde en toont "gekopieerd" alleen op dat veld', async () => {
  const schrijf = vi.fn(() => Promise.resolve())
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: schrijf }, configurable: true })
  toon()

  await act(async () => void fireEvent.click(screen.getByText('BEDRAG')))
  expect(schrijf).toHaveBeenCalledWith('15.00') // ruw, met punt, niet €15,00
  expect(screen.getAllByText('gekopieerd')).toHaveLength(1)

  await act(async () => void fireEvent.click(screen.getByText(/REKENINGNUMMER/)))
  expect(schrijf).toHaveBeenCalledWith('BE68539007547034') // spaties eruit
  expect(screen.getAllByText('gekopieerd')).toHaveLength(1) // nog steeds maar één veld tegelijk
})

test('AC2: de mededeling wordt gekopieerd in het formaat uit period.ts', async () => {
  const schrijf = vi.fn(() => Promise.resolve())
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: schrijf }, configurable: true })
  toon()

  await act(async () => void fireEvent.click(screen.getByText('MEDEDELING')))
  expect(schrijf).toHaveBeenCalledWith('STREEPJES P3 01/08-31/08 SANDER')
})

test('AC3: "Ik heb overgeschreven" meldt de betaling en toont het Doorgegeven-paneel; "toch nog niet betaald" herroept', async () => {
  const onToast = toon()

  await act(async () => void fireEvent.click(screen.getByText('Ik heb overgeschreven')))

  expect(calls.meld).toEqual([['p3', 'user:u1']])
  expect(onToast).toHaveBeenCalledWith('Doorgegeven aan de drankleider')
  expect(screen.getByText('Doorgegeven')).toBeTruthy()
  expect(screen.getByText('DOORGEGEVEN')).toBeTruthy() // de chip
  expect(screen.queryByText('Ik heb overgeschreven')).toBeNull()

  await act(async () => void fireEvent.click(screen.getByText('toch nog niet betaald')))

  expect(calls.herroep).toEqual([['p3', 'user:u1']])
  expect(onToast).toHaveBeenCalledWith('Terug op openstaand gezet')
  expect(screen.getByText('Ik heb overgeschreven')).toBeTruthy()
})

test('AC4: een leider zonder openstaande betaling ziet de Niets openstaand-kaart in plaats van de betaalkaart', () => {
  store['p3|user:u1'] = 'betaald'
  toon()

  expect(screen.getByText('Niets openstaand')).toBeTruthy()
  expect(screen.getByText('Periode 3 staat afgevinkt.')).toBeTruthy()
  expect(screen.queryByText('Ik heb overgeschreven')).toBeNull()
  expect(screen.queryByText('BEDRAG')).toBeNull()
})

test('zonder ooit een afgesloten periode toont het scherm ook Niets openstaand, geen leeg scherm', () => {
  periodes = []
  toon()

  expect(screen.getByText('Niets openstaand')).toBeTruthy()
  expect(screen.getByText('Nog geen periode afgesloten.')).toBeTruthy()
})

test('TASK-10 AC6: een periode afgesloten met een einddatum in de toekomst biedt nog niets aan om te betalen', () => {
  periodes = periodes.map((p) => (p.id === 'p3' ? { ...p, eind: '2099-01-01' } : p))
  toon()

  // p3 valt weg (nog niet voorbij), p2 wordt de nieuwste betaalbare periode.
  expect(screen.queryByText(/PERIODE 3/)).toBeNull()
  expect(screen.getByText('PERIODE 2 · 2026-07-01 → 2026-07-31')).toBeTruthy()
})

test('AC5: eerdere periodes staan in de lijst met reikwijdte, streepjes, bedrag en status', () => {
  store['p1|user:u1'] = 'betaald'
  toon()

  expect(screen.getByText('2 periodes')).toBeTruthy()
  expect(screen.getByText('Periode 2')).toBeTruthy()
  expect(screen.getByText(/2026-07-01 → 2026-07-31 · 5 streepjes/)).toBeTruthy()
  expect(screen.getByText('€7,00')).toBeTruthy() // 5 * 1,40, de prijs van periode 2

  expect(screen.getByText('Periode 1')).toBeTruthy()
  expect(screen.getByText(/2026-06-01 → 2026-06-30 · 8 streepjes/)).toBeTruthy()
  expect(screen.getByText('€36,40')).toBeTruthy() // 8*1,30 + 1*26, de bevroren prijzen van periode 1

  const statussen = screen.getAllByText(/^(BETAALD|OPEN)$/)
  expect(statussen.map((s) => s.textContent)).toEqual(['OPEN', 'BETAALD']) // periode 2 open, periode 1 betaald
})
