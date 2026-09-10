import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { User } from 'firebase/auth'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { Group, Person } from './data'
import { Betalen } from './Betalen'

// Same idiom as Lijst.test.tsx: a tiny in-memory store standing in for
// Firestore, so melden/herroepen through the real writer names re-renders the
// real hook, exactly what onSnapshot does in the app.
const store: Record<string, 'gemeld' | 'betaald'> = {}
const listeners = new Set<() => void>()
const calls = { meld: [] as [string, string][], herroep: [] as [string, string][] }

vi.mock('./data', async () => {
  const { useEffect, useState } = await import('react')
  return {
    useArchief: () => archieven,
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

let archieven: { id: string; nr: number; start: string; eind: string; prijs: number; bakPrijs: number; perBak: number; totals: Record<string, { streep: number; bak: number }> }[] = []

const toon = (onToast = vi.fn()) => {
  render(<Betalen user={ik} people={people} group={group} onToast={onToast} />)
  return onToast
}

beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k]
  calls.meld = []
  calls.herroep = []
  archieven = [
    { id: 'p3', nr: 3, start: '2026-08-01', eind: '2026-08-31', prijs: 1.5, bakPrijs: 30, perBak: 24, totals: { 'user:u1': { streep: 10, bak: 0 } } },
    { id: 'p2', nr: 2, start: '2026-07-01', eind: '2026-07-31', prijs: 1.4, bakPrijs: 28, perBak: 24, totals: { 'user:u1': { streep: 5, bak: 0 } } },
    { id: 'p1', nr: 1, start: '2026-06-01', eind: '2026-06-30', prijs: 1.3, bakPrijs: 26, perBak: 24, totals: { 'user:u1': { streep: 8, bak: 1 } } },
  ]
})

afterEach(cleanup)

test('AC1: toont het eigen bedrag, de periode en het streepjesaantal uit het meest recente archief, aan de bevroren prijs', () => {
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
  archieven = []
  toon()

  expect(screen.getByText('Niets openstaand')).toBeTruthy()
  expect(screen.getByText('Nog geen periode afgesloten.')).toBeTruthy()
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
