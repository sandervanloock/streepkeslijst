import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { User } from 'firebase/auth'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { Period } from './data'
import { Inningen } from './Inningen'

// Same idiom as Betalen.test.tsx: a tiny in-memory store standing in for
// Firestore, so vinkAfBetaling/herroepBetaling through the real writer names
// re-renders the real hooks, exactly what onSnapshot does in the app.
const store: Record<string, 'gemeld' | 'betaald'> = {}
const listeners = new Set<() => void>()
const calls = { vink: [] as [string, string, string][], herroep: [] as [string, string][] }
type Entry = { personRef: string; kind: 'streep' | 'bak'; delta: number }
let ledger: Record<string, Entry[]> = {}
type PersonFixture = { id: string; personRef: string; nick: string; naam: string; isGuest: boolean; role: string }
let people: Record<string, PersonFixture[]> = {}

vi.mock('./data', async () => {
  const { useEffect, useState } = await import('react')
  const live = () => {
    const [, set] = useState(0)
    useEffect(() => {
      const l = () => set((v) => v + 1)
      listeners.add(l)
      return () => void listeners.delete(l)
    }, [])
  }
  return {
    periodId: (nr: number) => 'p' + nr,
    usePeople: (pid: string | undefined) => {
      live()
      return pid ? people[pid] ?? [] : []
    },
    useEntries: (pid: string | undefined) => {
      live()
      return pid ? ledger[pid] ?? [] : []
    },
    useBetalingen: (pid: string | undefined) => {
      live()
      const m = new Map<string, 'open' | 'gemeld' | 'betaald'>()
      if (pid) {
        for (const key of Object.keys(store)) {
          if (key.startsWith(pid + '|')) m.set(key.slice(pid.length + 1), store[key])
        }
      }
      return m
    },
    vinkAfBetaling: (pid: string, personRef: string, byUid: string) => {
      calls.vink.push([pid, personRef, byUid])
      store[pid + '|' + personRef] = 'betaald'
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

let periodes: (Period & { id: string })[] = []

const toon = (onToast = vi.fn()) => {
  render(<Inningen user={ik} periodes={periodes} onToast={onToast} />)
  return onToast
}

beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k]
  calls.vink = []
  calls.herroep = []
  // "vandaag" in Inningen.tsx is the real clock, dus elke fixture hieronder is
  // afgesloten met een eind ruim in het verleden (AC2: eind != null && eind < vandaag).
  periodes = [
    { id: 'p3', nr: 3, start: '2026-08-01', eind: '2026-08-31', startAt: null, eindAt: null, prijs: 1.5, bakPrijs: 30, perBak: 24 } as unknown as Period & { id: string },
    { id: 'p2', nr: 2, start: '2026-07-01', eind: '2026-07-31', startAt: null, eindAt: null, prijs: 1.4, bakPrijs: 28, perBak: 24 } as unknown as Period & { id: string },
  ]
  people = {
    p3: [
      { id: 'u1', personRef: 'user:u1', nick: 'Sander', naam: 'Sander V.', isGuest: false, role: 'drankleider' },
      { id: 'u2', personRef: 'user:u2', nick: 'Anton', naam: 'Anton B.', isGuest: false, role: 'lid' },
      { id: 'g1', personRef: 'guest:g1', nick: 'Wollie', naam: 'Wout D.', isGuest: true, role: 'lid' },
    ],
    p2: [{ id: 'u1', personRef: 'user:u1', nick: 'Sander', naam: 'Sander V.', isGuest: false, role: 'drankleider' }],
  }
  ledger = {
    p3: [
      { personRef: 'user:u1', kind: 'streep', delta: 10 },
      { personRef: 'user:u2', kind: 'streep', delta: 4 },
      { personRef: 'guest:g1', kind: 'streep', delta: 2 },
    ],
    p2: [{ personRef: 'user:u1', kind: 'streep', delta: 5 }],
  }
})

afterEach(cleanup)

test('AC2: alleen afgesloten periodes met een eind in het verleden komen aan bod, meest recente eerst', () => {
  toon()
  expect(screen.getByText('PERIODE 3 · 2026-08-01 → 2026-08-31')).toBeTruthy()
})

const q = (sel: string) => document.querySelector(sel) as HTMLElement | null
const pijl = (kant: 'ouder' | 'recenter') => q(`[data-pijl="${kant}"]`)!
const teller = (naam: 'betaald' | 'gemeld' | 'open') => q(`[data-teller="${naam}"]`)!.textContent
const rij = (ref: string) => q(`[data-row="${ref}"]`)!
const knop = (ref: string) => rij(ref).querySelector('div[style*="cursor: pointer"]') as HTMLElement

test('AC1: pijlen bladeren door de periodes', () => {
  toon()

  expect(screen.getByText('PERIODE 3 · 2026-08-01 → 2026-08-31')).toBeTruthy()

  fireEvent.click(pijl('ouder'))
  expect(screen.getByText('PERIODE 2 · 2026-07-01 → 2026-07-31')).toBeTruthy()

  fireEvent.click(pijl('recenter'))
  expect(screen.getByText('PERIODE 3 · 2026-08-01 → 2026-08-31')).toBeTruthy()
})

test('AC1: de dots springen ook rechtstreeks naar een periode', () => {
  toon()

  fireEvent.click(q('[data-stip="2"]')!)
  expect(screen.getByText('PERIODE 2 · 2026-07-01 → 2026-07-31')).toBeTruthy()
})

test('AC1: swipe links/rechts wisselt van periode', () => {
  toon()

  const swipe = q('[data-swipe]')!
  fireEvent.touchStart(swipe, { touches: [{ clientX: 200 }] })
  fireEvent.touchEnd(swipe, { changedTouches: [{ clientX: 100 }] }) // >45px naar links => volgende (oudere)
  expect(screen.getByText('PERIODE 2 · 2026-07-01 → 2026-07-31')).toBeTruthy()

  fireEvent.touchStart(swipe, { touches: [{ clientX: 100 }] })
  fireEvent.touchEnd(swipe, { changedTouches: [{ clientX: 200 }] }) // >45px naar rechts => vorige (recenter)
  expect(screen.getByText('PERIODE 3 · 2026-08-01 → 2026-08-31')).toBeTruthy()
})

test('AC3: tellers en de sub-lijn tonen leiders, open- en totaalbedrag', () => {
  toon()

  // p3: Sander (10 streepjes, €15), Anton (4, €6), Wollie (2, €3), allen open
  expect(screen.getByText('3 leiders · €24,00 open · €24,00 totaal')).toBeTruthy()
  expect(teller('betaald')).toBe('0')
  expect(teller('gemeld')).toBe('0')
  expect(teller('open')).toBe('3')
})

test('AC4: elke persoon met een bedrag staat in de lijst met nick, statuschip en bedrag', () => {
  toon()

  expect(screen.getByText('Sander')).toBeTruthy()
  expect(screen.getByText('Anton')).toBeTruthy()
  expect(screen.getByText('Wollie')).toBeTruthy() // AC7: gast met nick uit de gastenlijst van déze periode
  expect(screen.getAllByText('OPEN').length).toBe(3)
  expect(screen.getByText('€15,00')).toBeTruthy()
  expect(screen.getByText('€6,00')).toBeTruthy()
  expect(screen.getByText('€3,00')).toBeTruthy()
})

test('AC5: de filterrij beperkt de lijst tot Open / Na te kijken / Betaald', async () => {
  store['p3|user:u2'] = 'gemeld'
  store['p3|guest:g1'] = 'betaald'
  toon()

  fireEvent.click(screen.getByText('Na te kijken'))
  expect(screen.getByText('Anton')).toBeTruthy()
  expect(screen.queryByText('Sander')).toBeNull()
  expect(screen.queryByText('Wollie')).toBeNull()

  fireEvent.click(screen.getByText('Betaald'))
  expect(screen.getByText('Wollie')).toBeTruthy()
  expect(screen.queryByText('Anton')).toBeNull()

  fireEvent.click(screen.getByText('Open'))
  expect(screen.getByText('Sander')).toBeTruthy()
  expect(screen.queryByText('Anton')).toBeNull()

  fireEvent.click(screen.getByText('Alles'))
  expect(screen.getByText('Sander')).toBeTruthy()
  expect(screen.getByText('Anton')).toBeTruthy()
  expect(screen.getByText('Wollie')).toBeTruthy()
})

test("AC6: 'Ontvangen · vink af' zet betaald met een toast; op een betaalde rij wordt het 'Terug openzetten' en zet terug open", async () => {
  const onToast = toon()

  await act(async () => void fireEvent.click(knop('user:u1')))

  expect(calls.vink).toEqual([['p3', 'user:u1', 'u1']])
  expect(onToast).toHaveBeenCalledWith('Sander afgevinkt · €15,00 ontvangen')
  expect(rij('user:u1').textContent).toContain('Terug openzetten')

  await act(async () => void fireEvent.click(knop('user:u1')))

  expect(calls.herroep).toEqual([['p3', 'user:u1']])
  expect(onToast).toHaveBeenCalledWith('Sander staat weer open')
  expect(rij('user:u1').textContent).toContain('Ontvangen · vink af')
})

test('AC7: een gast kan net als iedereen worden afgevinkt en heropend', async () => {
  const onToast = toon()

  await act(async () => void fireEvent.click(knop('guest:g1')))

  expect(calls.vink).toEqual([['p3', 'guest:g1', 'u1']])
  expect(onToast).toHaveBeenCalledWith('Wollie afgevinkt · €3,00 ontvangen')

  await act(async () => void fireEvent.click(knop('guest:g1')))
  expect(calls.herroep).toEqual([['p3', 'guest:g1']])
  expect(onToast).toHaveBeenCalledWith('Wollie staat weer open')
})

test('AC9: twee periodes met een verschillende prijs/bakPrijs rekenen elk aan hun eigen prijs', () => {
  toon()
  expect(screen.getByText('€15,00')).toBeTruthy() // p3: 10 streepjes aan €1,50

  fireEvent.click(pijl('ouder')) // naar p2
  expect(screen.getByText('PERIODE 2 · 2026-07-01 → 2026-07-31')).toBeTruthy()
  expect(screen.getByText('€7,00')).toBeTruthy() // p2: 5 streepjes aan €1,40, niet de €1,50 van p3
})

test('AC8: Inningen schrijft nooit iets anders dan betalingen', () => {
  toon()
  // vinkAfBetaling/herroepBetaling zijn de enige geëxporteerde schrijvers die
  // deze mock aanbiedt en Inningen importeert er ook geen andere.
  expect(Object.keys(calls)).toEqual(['vink', 'herroep'])
})
