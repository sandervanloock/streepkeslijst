import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { User } from 'firebase/auth'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { Profiel } from './Profiel'
import type { Person, Period } from './data'

// Firestore stands in as an in-memory profile doc, same trick as Lijst.test.tsx:
// saveProfile writes to `store`, useProfile reads it back through the live
// listener that onSnapshot drives.
const store = { profile: { nick: 'Sander', naam: 'Sander V.', mail: 'sander@x.be' } }
const listeners = new Set<() => void>()

vi.mock('./data', async () => {
  const { useEffect, useState } = await import('react')
  return {
    useProfile: () => {
      const [, set] = useState(0)
      useEffect(() => {
        const l = () => set((v) => v + 1)
        listeners.add(l)
        return () => void listeners.delete(l)
      }, [])
      return store.profile
    },
    saveProfile: (_uid: string, nick: string, naam: string, mail: string) => {
      store.profile = { nick, naam, mail }
      listeners.forEach((l) => l())
      return Promise.resolve()
    },
  }
})

const me = { uid: 'u1', email: 'sander@x.be' } as User
const period: Period = { nr: 3, start: '2026-09-01', eind: '2026-09-30', open: true, perBak: 24, prijs: 1.5, bakPrijs: 30 }
const people: Person[] = [
  { id: 'u1', personRef: 'user:u1', nick: 'Sander', naam: 'Sander V.', isGuest: false, role: 'lid' },
  { id: 'u2', personRef: 'user:u2', nick: 'Anton', naam: 'Anton B.', isGuest: false, role: 'lid' },
]

beforeEach(() => {
  store.profile = { nick: 'Sander', naam: 'Sander V.', mail: 'sander@x.be' }
})

afterEach(cleanup)

test('AC2: het scherm toont de huidige bijnaam, naam en mail, vooraf ingevuld', () => {
  render(<Profiel user={me} people={people} period={period} onToast={vi.fn()} />)
  expect(screen.getByDisplayValue('Sander')).toBeTruthy()
  expect(screen.getByDisplayValue('Sander V.')).toBeTruthy()
  expect(screen.getByDisplayValue('sander@x.be')).toBeTruthy()
})

test('AC3 + AC9: bewaren schrijft de nieuwe waarden weg en zegt dat het gelukt is', async () => {
  const onToast = vi.fn()
  render(<Profiel user={me} people={people} period={period} onToast={onToast} />)

  fireEvent.change(screen.getByDisplayValue('Sander'), { target: { value: 'Wollie' } })
  fireEvent.change(screen.getByDisplayValue('Sander V.'), { target: { value: 'Wouter L.' } })
  await act(async () => void fireEvent.click(screen.getByText('Bewaren')))

  expect(store.profile).toEqual({ nick: 'Wollie', naam: 'Wouter L.', mail: 'sander@x.be' })
  expect(onToast).toHaveBeenCalledWith('Profiel bewaard · je staat nu als Wollie op de lijst')
})

test('AC4 + AC9: een lege bijnaam wordt geweigerd en er wordt niets bewaard', async () => {
  const onToast = vi.fn()
  render(<Profiel user={me} people={people} period={period} onToast={onToast} />)

  fireEvent.change(screen.getByDisplayValue('Sander'), { target: { value: '  ' } })
  await act(async () => void fireEvent.click(screen.getByText('Bewaren')))

  expect(screen.getByText('Geef een bijnaam.')).toBeTruthy()
  expect(store.profile.nick).toBe('Sander')
  expect(onToast).not.toHaveBeenCalled()
})

test('AC5 + AC9: een bijnaam die al bezet is door iemand anders wordt geweigerd, met naam erbij', async () => {
  const onToast = vi.fn()
  render(<Profiel user={me} people={people} period={period} onToast={onToast} />)

  fireEvent.change(screen.getByDisplayValue('Sander'), { target: { value: 'Anton' } })
  await act(async () => void fireEvent.click(screen.getByText('Bewaren')))

  expect(screen.getByText('Anton is al bezet.')).toBeTruthy()
  expect(store.profile.nick).toBe('Sander')
  expect(onToast).not.toHaveBeenCalled()
})

test('AC6: de mededeling-preview volgt wat je typt', () => {
  render(<Profiel user={me} people={people} period={period} onToast={vi.fn()} />)
  expect(screen.getByText('Mededeling: STREEPJES P3 01/09-30/09 SANDER')).toBeTruthy()

  fireEvent.change(screen.getByDisplayValue('Sander'), { target: { value: 'Wollie' } })
  expect(screen.getByText('Mededeling: STREEPJES P3 01/09-30/09 WOLLIE')).toBeTruthy()
})
