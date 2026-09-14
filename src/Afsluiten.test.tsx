import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { User } from 'firebase/auth'
import { Timestamp } from 'firebase/firestore'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { Entry } from './period'
import type { Person } from './data'
import { Afsluiten } from './Afsluiten'

const calls = { sluit: [] as unknown[] }

vi.mock('./data', () => ({
  sluitPeriode: (...args: unknown[]) => {
    calls.sluit.push(args)
    return Promise.resolve()
  },
}))

const ik = { uid: 'u1' } as User
const period = {
  nr: 3,
  start: '2026-09-01',
  eind: null,
  startAt: Timestamp.fromDate(new Date('2026-09-01T00:00:00Z')),
  eindAt: null,
  perBak: 24,
  prijs: 1.5,
  bakPrijs: 30,
}
const entries: Entry[] = [
  { personRef: 'user:a', kind: 'streep', delta: 4 },
  { personRef: 'user:a', kind: 'bak', delta: 1 },
]
const people: Person[] = [
  { id: 'u1', personRef: 'user:u1', nick: 'Sander', naam: 'Sander V.', isGuest: false, role: 'drankleider' },
  { id: 'u2', personRef: 'user:u2', nick: 'Anton', naam: 'Anton B.', isGuest: false, role: 'lid' },
  { id: 'g1', personRef: 'guest:g1', nick: 'Fien', naam: 'Fien D.', isGuest: true, role: 'lid' },
]

const toon = (rol = 'drankleider', onKlaar = vi.fn(), onToast = vi.fn()) => {
  render(<Afsluiten user={ik} period={period} entries={entries} people={people} myRole={rol} onToast={onToast} onKlaar={onKlaar} />)
  return { onKlaar, onToast }
}

beforeEach(() => {
  calls.sluit = []
})

afterEach(cleanup)

test('AC1: een lid komt niet op het scherm, ook niet rechtstreeks', () => {
  toon('lid')
  expect(screen.queryByText('Afsluiten')).toBeNull()
})

test('AC1: de drankleider ziet de LIVE badge, de reikwijdte en de drie statistieken', () => {
  toon()

  expect(screen.getByText(/Periode 3/)).toBeTruthy()
  expect(screen.getByText('LIVE')).toBeTruthy()
  expect(document.querySelector('[data-stat="streepjes"]')!.textContent).toBe('28') // 4 + 1*24
  expect(document.querySelector('[data-stat="leiders"]')!.textContent).toBe('2') // gasten tellen niet mee
  expect(document.querySelector('[data-stat="euro"]')!.textContent).toBe('€36,00') // 4*1,5 + 30
})

test('AC2: stap 1 wijst een datum voor de periodestart af', () => {
  toon()
  fireEvent.click(screen.getByText('Afsluiten'))

  const veld = document.querySelector('input[type="date"]') as HTMLInputElement
  fireEvent.change(veld, { target: { value: '2026-08-15' } }) // vóór period.start

  expect(veld.value).toBe('2026-09-01') // geklemd op de periodestart
})

test('AC3: stap 2 laat de prijs per streepje en per bak niet onder nul zakken', () => {
  toon()
  fireEvent.click(screen.getByText('Afsluiten'))
  fireEvent.click(screen.getByText('Verder')) // naar stap 2

  const minKnoppen = screen.getAllByText('–')
  for (let i = 0; i < 40; i++) fireEvent.click(minKnoppen[0]) // streepprijs
  for (let i = 0; i < 40; i++) fireEvent.click(minKnoppen[1]) // bakprijs

  expect(screen.getAllByText('€0,00')).toHaveLength(2) // streepprijs en bakprijs allebei geklemd op nul
})

test('AC4: stap 3 toont de checklist en de onomkeerbaarheid vóór het bevestigen iets schrijft', () => {
  toon()
  fireEvent.click(screen.getByText('Afsluiten'))
  fireEvent.click(screen.getByText('Verder')) // stap 2
  fireEvent.click(screen.getByText('Verder')) // stap 3

  expect(screen.getByText('Afsluiten kan niet ongedaan gemaakt worden.')).toBeTruthy()
  expect(screen.getByText('Periode 3 sluit')).toBeTruthy()
  expect(calls.sluit).toEqual([])
})

test('AC5/AC6: bevestigen sluit de periode af met de gekozen einddatum en prijzen, en toast', async () => {
  const { onKlaar, onToast } = toon()
  fireEvent.click(screen.getByText('Afsluiten'))
  fireEvent.change(document.querySelector('input[type="date"]') as HTMLInputElement, { target: { value: '2026-09-30' } })
  fireEvent.click(screen.getByText('Verder')) // stap 2
  fireEvent.click(screen.getByText('Verder')) // stap 3

  await act(async () => void fireEvent.click(screen.getByText('Afsluiten en nieuwe starten')))

  expect(calls.sluit).toEqual([[period, '2026-09-30', 1.5, 30, 'u1']])
  expect(onToast).toHaveBeenCalledWith('Periode 3 afgesloten · iedereen ziet zijn bedrag onder Betalen')
  expect(onKlaar).toHaveBeenCalled()
})

test('Terug/Stoppen gaat een stap terug of sluit de wizard zonder iets te bevestigen', () => {
  toon()
  fireEvent.click(screen.getByText('Afsluiten'))
  fireEvent.click(screen.getByText('Verder')) // stap 2

  fireEvent.click(screen.getByText('Terug')) // terug naar stap 1
  expect(screen.getByText('STAP 1 VAN 3')).toBeTruthy()

  fireEvent.click(screen.getByText('Stoppen')) // sluit de wizard helemaal
  expect(screen.getByText('DE LOPENDE PERIODE')).toBeTruthy()
})
