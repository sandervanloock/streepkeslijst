import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { User } from 'firebase/auth'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { Person } from './data'
import { Beheer } from './Beheer'

// Only the writers are mocked: the role list, the counter and the guard are the
// real component, driven by the `people` prop the way usePeople feeds it.
const calls = {
  roles: [] as [string, string][],
  names: [] as string[],
  created: [] as string[],
  bumped: [] as string[],
  revoked: [] as string[],
  shared: [] as string[],
}
let invitesLijst: { id: string; email: string; by: string; byNick: string; herinnerd: number }[] = []
let shareResultaat: 'gedeeld' | 'gekopieerd' = 'gedeeld'

vi.mock('./data', () => ({
  setRole: (uid: string, role: string) => {
    calls.roles.push([uid, role])
    return Promise.resolve()
  },
  saveGroupName: (naam: string) => {
    calls.names.push(naam)
    return Promise.resolve()
  },
  useInvites: () => invitesLijst,
  createInvite: (email: string) => {
    calls.created.push(email)
    return Promise.resolve()
  },
  bumpInvite: (email: string) => {
    calls.bumped.push(email)
    return Promise.resolve()
  },
  revokeInvite: (email: string) => {
    calls.revoked.push(email)
    return Promise.resolve()
  },
  shareInvite: (email: string) => {
    calls.shared.push(email)
    return Promise.resolve(shareResultaat)
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
  calls.created = []
  calls.bumped = []
  calls.revoked = []
  calls.shared = []
  invitesLijst = []
  shareResultaat = 'gedeeld'
})

afterEach(cleanup)

// The BEHEERDER badge and the heading live on the shared header row in Lijst.tsx,
// so they are asserted there, not here.
test('AC3: het scherm toont de groepsnaam en elk lid met de drieweg-keuze', () => {
  toon()

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

test('AC1 + AC4: een geldig adres maakt een uitnodiging en deelt ze via navigator.share', async () => {
  const onToast = toon()

  fireEvent.change(screen.getByPlaceholderText('voornaam@mail.be'), { target: { value: 'Wollie@Mail.be' } })
  await act(async () => void fireEvent.click(screen.getByText('Deel de uitnodiging')))

  expect(calls.created).toEqual(['wollie@mail.be']) // getrimd en lowercased
  expect(calls.shared).toEqual(['wollie@mail.be'])
  expect(onToast).toHaveBeenCalledWith('Uitnodiging voor wollie@mail.be klaar · deel ze met hem')
})

test('AC4: zonder navigator.share valt het terug op de klembord-toast', async () => {
  shareResultaat = 'gekopieerd'
  const onToast = toon()

  fireEvent.change(screen.getByPlaceholderText('voornaam@mail.be'), { target: { value: 'wollie@mail.be' } })
  await act(async () => void fireEvent.click(screen.getByText('Deel de uitnodiging')))

  expect(onToast).toHaveBeenCalledWith('Uitnodiging gekopieerd · plak ze in WhatsApp')
})

test('AC2: een ongeldig adres wordt inline geweigerd, er wordt niets aangemaakt', async () => {
  toon()

  fireEvent.change(screen.getByPlaceholderText('voornaam@mail.be'), { target: { value: 'niet-een-mailadres' } })
  await act(async () => void fireEvent.click(screen.getByText('Deel de uitnodiging')))

  expect(screen.getByText('Geef een geldig e-mailadres.')).toBeTruthy()
  expect(calls.created).toEqual([])
})

test('AC3: een al uitgenodigd adres wordt geweigerd en verwijst naar opnieuw delen', async () => {
  invitesLijst = [{ id: 'wollie@mail.be', email: 'wollie@mail.be', by: 'u1', byNick: 'Sander', herinnerd: 0 }]
  toon()

  fireEvent.change(screen.getByPlaceholderText('voornaam@mail.be'), { target: { value: 'wollie@mail.be' } })
  await act(async () => void fireEvent.click(screen.getByText('Deel de uitnodiging')))

  expect(screen.getByText('Die is al uitgenodigd — deel de uitnodiging opnieuw hieronder.')).toBeTruthy()
  expect(calls.created).toEqual([])
})

test('AC5: opnieuw delen verhoogt de herinnering en de badge staat op HERINNERD', () => {
  invitesLijst = [{ id: 'wollie@mail.be', email: 'wollie@mail.be', by: 'u1', byNick: 'Sander', herinnerd: 1 }]
  toon()

  expect(screen.getByText('HERINNERD')).toBeTruthy()
})

test('AC5: op de knop drukken deelt opnieuw en bumpt de teller', async () => {
  invitesLijst = [{ id: 'wollie@mail.be', email: 'wollie@mail.be', by: 'u1', byNick: 'Sander', herinnerd: 0 }]
  const onToast = toon()

  await act(async () => void fireEvent.click(screen.getByText('Opnieuw delen')))

  expect(calls.bumped).toEqual(['wollie@mail.be'])
  expect(calls.shared).toEqual(['wollie@mail.be'])
  expect(onToast).toHaveBeenCalledWith('Uitnodiging voor wollie@mail.be opnieuw gedeeld')
})

test('AC6: intrekken verwijdert de uitnodiging', async () => {
  invitesLijst = [{ id: 'wollie@mail.be', email: 'wollie@mail.be', by: 'u1', byNick: 'Sander', herinnerd: 0 }]
  const onToast = toon()

  await act(async () => void fireEvent.click(screen.getByText('Intrekken')))

  expect(calls.revoked).toEqual(['wollie@mail.be'])
  expect(onToast).toHaveBeenCalledWith('Uitnodiging voor wollie@mail.be ingetrokken · hij kan niet meer aansluiten')
})
