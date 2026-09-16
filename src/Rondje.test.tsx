import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { User } from 'firebase/auth'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { Rondje } from './Rondje'

// Same trick as Lijst.test.tsx: data.ts is mocked down to an in-memory store,
// everything above it (the round itself) is the real thing.
vi.mock('./data', () => ({
  periodId: (nr: number) => 'p' + nr,
  usePeriodes: () => [{ id: 'p1', nr: 1, start: '2020-01-01', eind: null, perBak: 24, prijs: 0.7, bakPrijs: 16.8 }],
  usePeople: () => [
    { id: 'u1', personRef: 'user:u1', nick: 'Sander', naam: 'Sander V.', isGuest: false, role: 'lid' },
    { id: 'u2', personRef: 'user:u2', nick: 'Anton', naam: 'Anton B.', isGuest: false, role: 'lid' },
  ],
  useGroup: () => ({ naam: 'Chiro Elzestraat', iban: 'BE68 5390 0754 7034', begunstigde: 'Chiro Elzestraat vzw' }),
  saveProfile: vi.fn(() => Promise.resolve()),
  markRondje: vi.fn(() => Promise.resolve()),
}))

const data = await import('./data')
const saveProfile = vi.mocked(data.saveProfile)
const markRondje = vi.mocked(data.markRondje)

const me = { uid: 'u1' } as User

const rij = () => document.querySelector('[data-demo-row]') as HTMLElement

/** Loopt de eerste vier stappen af met een geldige Chironaam, tot en met stap 5. */
const naarStap5 = async () => {
  fireEvent.click(screen.getByText('Verder')) // stap 1 -> 2
  fireEvent.change(screen.getByPlaceholderText('bv. Wollie'), { target: { value: 'Wollie' } })
  await act(async () => void fireEvent.click(screen.getByText('Dit ben ik'))) // stap 2 -> 3
  await act(async () => void fireEvent.click(screen.getByText('Snap het'))) // stap 3 -> 4
  await act(async () => void fireEvent.click(screen.getByText('Verder'))) // stap 4 -> 5
}

/** One tap: pointerdown + pointerup inside the 620ms hold window. */
const tik = async () => {
  fireEvent.pointerDown(rij())
  await act(async () => void fireEvent.pointerUp(rij()))
}

/** A press held past HOLD_MS, which opens the BAK sheet. */
const houdVast = async () => {
  fireEvent.pointerDown(rij())
  await act(async () => vi.advanceTimersByTime(700))
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  saveProfile.mockClear()
  markRondje.mockClear()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

test('AC2: de vijf stappen staan in de ontwerpvolgorde, met stapteller en Terug vanaf stap 2', () => {
  const onKlaar = vi.fn()
  render(<Rondje user={me} onKlaar={onKlaar} />)

  expect(screen.getByText('STAP 1 VAN 5 · WELKOM')).toBeTruthy()
  expect(screen.queryByText('Terug')).toBeNull()

  fireEvent.click(screen.getByText('Verder'))
  expect(screen.getByText('STAP 2 VAN 5 · JOUW NAAM')).toBeTruthy()
  expect(screen.getByText('Terug')).toBeTruthy()

  fireEvent.click(screen.getByText('Terug'))
  expect(screen.getByText('STAP 1 VAN 5 · WELKOM')).toBeTruthy()
})

test('AC3: stap 2 weigert verder te gaan zonder Chironaam, en bewaart nick + naam zodra je er een kiest', async () => {
  render(<Rondje user={me} onKlaar={vi.fn()} />)
  fireEvent.click(screen.getByText('Verder')) // naar stap 2

  fireEvent.click(screen.getByText('Dit ben ik'))
  expect(screen.getByText('Kies een Chironaam — of tik een van de voorstellen aan.')).toBeTruthy()
  expect(screen.getByText('STAP 2 VAN 5 · JOUW NAAM')).toBeTruthy() // niet verder

  fireEvent.change(screen.getByPlaceholderText('bv. Wollie'), { target: { value: 'Wollie' } })
  fireEvent.change(screen.getByPlaceholderText('Voornaam Achternaam'), { target: { value: 'Wouter L.' } })
  // de tekst zelf blijft 'Wollie', groot geschreven staat er alleen via CSS
  expect(screen.getAllByText('Wollie').length).toBeGreaterThan(0) // live voorbeeldrij

  await act(async () => void fireEvent.click(screen.getByText('Dit ben ik')))
  expect(saveProfile).toHaveBeenCalledWith('u1', 'Wollie', 'Wouter L.', '')
  expect(screen.getByText('STAP 3 VAN 5 · STREEPJE ZETTEN')).toBeTruthy()
})

test('AC4: de demorij reageert op tik, vasthouden en de gomstand net als de echte rij, zonder iets weg te schrijven', async () => {
  render(<Rondje user={me} onKlaar={vi.fn()} />)
  fireEvent.click(screen.getByText('Verder')) // stap 2
  fireEvent.click(screen.getByText('Dit ben ik')) // blijft op 2, geen naam
  fireEvent.change(screen.getByPlaceholderText('bv. Wollie'), { target: { value: 'Wollie' } })
  await act(async () => void fireEvent.click(screen.getByText('Dit ben ik'))) // naar stap 3

  expect(rij()).toBeTruthy()
  await tik()
  expect(document.querySelector('[data-demo-aantal]')!.textContent).toBe('1')

  await houdVast()
  expect(screen.getByText('EEN HELE BAK')).toBeTruthy()
  fireEvent.click(screen.getByText('+'))
  await act(async () => void fireEvent.click(screen.getByText('Zet erbij')))
  expect(document.querySelector('[data-demo-bak]')!.textContent).toBe('+ 2 BAKKEN')

  fireEvent.click(screen.getByText('corrigeren'))
  await tik() // gomstand: tik = -1
  expect(document.querySelector('[data-demo-aantal]')!.textContent).toBe('0')

  expect(saveProfile).toHaveBeenCalledTimes(1) // enkel de stap-2-save, de demo schrijft niets
})

test('AC5: stap 4 toont de drie uitlegkaarten en een voorbeeldbedrag dat volgt uit stap 3', async () => {
  render(<Rondje user={me} onKlaar={vi.fn()} />)
  fireEvent.click(screen.getByText('Verder')) // stap 2
  fireEvent.change(screen.getByPlaceholderText('bv. Wollie'), { target: { value: 'Wollie' } })
  await act(async () => void fireEvent.click(screen.getByText('Dit ben ik'))) // stap 3
  await tik()
  await tik()
  fireEvent.click(screen.getByText('Snap het')) // stap 4

  expect(screen.getByText('De periode loopt')).toBeTruthy()
  expect(screen.getByText('Beheerder sluit af')).toBeTruthy()
  expect(screen.getByText('Eén bericht in de groep')).toBeTruthy()
  expect(screen.getByText('€1,40')).toBeTruthy() // 2 streepjes × €0,70
  expect(screen.getByText(/voor 2 streepjes/)).toBeTruthy()
})

test("AC6: Overslaan opent de bevestiging, 'Toch verder kijken' blijft op de stap, 'Naar de lijst' verlaat het rondje", async () => {
  const onKlaar = vi.fn()
  render(<Rondje user={me} onKlaar={onKlaar} />)

  fireEvent.click(screen.getByText('Overslaan'))
  expect(screen.getByText('Rondje overslaan?')).toBeTruthy()

  fireEvent.click(screen.getByText('Toch verder kijken'))
  expect(screen.queryByText('Rondje overslaan?')).toBeNull()
  expect(onKlaar).not.toHaveBeenCalled()

  fireEvent.click(screen.getByText('Overslaan'))
  await act(async () => void fireEvent.click(screen.getByText('Naar de lijst')))

  expect(onKlaar).toHaveBeenCalledWith('Rondje overgeslagen · terug te vinden bij Mijn profiel')
})

test('AC7: zowel afronden als overslaan zetten rondje op de eigen users/{uid}', async () => {
  const onKlaar = vi.fn()
  render(<Rondje user={me} onKlaar={onKlaar} />)

  fireEvent.click(screen.getByText('Overslaan'))
  await act(async () => void fireEvent.click(screen.getByText('Naar de lijst')))
  expect(markRondje).toHaveBeenCalledWith('u1')

  markRondje.mockClear()
  cleanup()
  render(<Rondje user={me} onKlaar={onKlaar} />)
  await naarStap5()
  expect(screen.getByText('STAP 5 VAN 5 · KLAAR')).toBeTruthy()
  await act(async () => void fireEvent.click(screen.getByText('Naar de lijst')))
  expect(markRondje).toHaveBeenCalledWith('u1')
})

test('AC9: stap 5 en de skip-toast verwijzen naar Mijn profiel, niet naar een menu-item', async () => {
  render(<Rondje user={me} onKlaar={vi.fn()} />)
  await naarStap5()
  expect(screen.getByText('Mijn profiel')).toBeTruthy()
  expect(screen.queryByText(/Menu/)).toBeNull()
})
