import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { User } from 'firebase/auth'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { Person } from './data'
import { Beheer } from './Beheer'

// Only the writers are mocked: the role list, the counter and the guard are the
// real component, driven by the `people` prop the way usePeople feeds it.
const calls = { roles: [] as [string, string][], names: [] as string[] }

vi.mock('./data', () => ({
  setRole: (uid: string, role: string) => {
    calls.roles.push([uid, role])
    return Promise.resolve()
  },
  saveGroupName: (naam: string) => {
    calls.names.push(naam)
    return Promise.resolve()
  },
}))

const ik = { uid: 'u1' } as User
const group = { naam: 'Chiro Elzestraat' }

const persoon = (id: string, nick: string, role: Person['role'], isGuest = false): Person => ({
  id,
  personRef: (isGuest ? 'guest:' : 'user:') + id,
  nick,
  naam: nick + ' V.',
  isGuest,
  role,
})

// Sander beheert, Anton is drankleider, Wollie is gewoon lid.
const ploeg = [
  persoon('u1', 'Sander', 'beheerder'),
  persoon('u2', 'Anton', 'drankleider'),
  persoon('u3', 'Wollie', 'lid'),
]

const toon = (people = ploeg, onToast = vi.fn()) => {
  render(<Beheer user={ik} people={people} group={group} onToast={onToast} />)
  return onToast
}

beforeEach(() => {
  calls.roles = []
  calls.names = []
})

afterEach(cleanup)

test('AC3: het scherm toont de badge, de groepsnaam en elk lid met de drieweg-keuze', () => {
  toon()

  expect(screen.getByText('BEHEERDER')).toBeTruthy()
  expect(screen.getByDisplayValue('Chiro Elzestraat')).toBeTruthy()
  expect(screen.getAllByText('Drankleider')).toHaveLength(3) // één keuze per lid
  expect(screen.getByText('Sander')).toBeTruthy()
  expect(screen.getByText('Wollie')).toBeTruthy()
})

test('AC3: een gast staat niet in de rollenlijst, die heeft geen account', () => {
  toon([...ploeg, persoon('g0', 'Fien', 'lid', true)])

  expect(screen.queryByText('Fien')).toBeNull()
})

test('AC2: een lid of drankleider komt niet op het scherm, ook niet rechtstreeks', () => {
  toon([persoon('u1', 'Sander', 'drankleider'), persoon('u2', 'Anton', 'beheerder')])

  expect(screen.queryByText('Beheer')).toBeNull()
})

test('AC4: een rol kiezen schrijft weg en zegt het met de toast uit het ontwerp', () => {
  const onToast = toon()

  // de derde rij is Wollie, de derde knop van die rij is Beheerder
  fireEvent.click(screen.getAllByText('Beheerder')[2])

  expect(calls.roles).toEqual([['u3', 'beheerder']])
  expect(onToast).toHaveBeenCalledWith('Wollie is nu beheerder')
})

test('AC4: de rol die al aanstaat opnieuw aantikken doet niets', () => {
  const onToast = toon()

  fireEvent.click(screen.getAllByText('Drankleider')[1]) // Anton is al drankleider

  expect(calls.roles).toEqual([])
  expect(onToast).not.toHaveBeenCalled()
})

test('AC4: de avatar krijgt de kleur van de rol', () => {
  toon()
  const avatars = document.querySelectorAll('[data-avatar]')

  expect((avatars[0] as HTMLElement).style.background).toBe('#7A4BD1') // beheerder, paars
  expect((avatars[1] as HTMLElement).style.background).toBe('#D8F651') // drankleider, lime
})

test('AC5: de teller boven de lijst telt de rollen', () => {
  toon()
  expect(screen.getByText('1 drankleiders · 1 beheerders')).toBeTruthy()
})

test('AC6: de groepsnaam wordt bewaard', () => {
  const onToast = toon()
  const veld = screen.getByDisplayValue('Chiro Elzestraat')

  fireEvent.change(veld, { target: { value: 'Chiro Elzestraat Zuid' } })
  fireEvent.blur(veld)

  expect(calls.names).toEqual(['Chiro Elzestraat Zuid'])
  expect(onToast).toHaveBeenCalledWith('Groep heet nu Chiro Elzestraat Zuid')
})

test('AC6: een lege groepsnaam wordt niet bewaard en krijgt de rode rand', () => {
  toon()
  const veld = screen.getByDisplayValue('Chiro Elzestraat')

  fireEvent.change(veld, { target: { value: '  ' } })
  fireEvent.blur(veld)

  expect(calls.names).toEqual([])
  expect((veld.parentElement as HTMLElement).style.border).toContain('#E4483A')
})

test('AC8: de laatste beheerder kan zichzelf niet degraderen', () => {
  const onToast = toon([persoon('u1', 'Sander', 'beheerder'), persoon('u2', 'Anton', 'lid')])

  fireEvent.click(screen.getAllByText('Lid')[0]) // Sander, de enige beheerder

  expect(calls.roles).toEqual([])
  expect(onToast).not.toHaveBeenCalled()
  expect(screen.getByText('Er moet altijd één beheerder overblijven.')).toBeTruthy()
})

test('AC8: met twee beheerders mag er wel één weg', () => {
  toon([persoon('u1', 'Sander', 'beheerder'), persoon('u2', 'Anton', 'beheerder')])

  fireEvent.click(screen.getAllByText('Lid')[0])

  expect(calls.roles).toEqual([['u1', 'lid']])
})
