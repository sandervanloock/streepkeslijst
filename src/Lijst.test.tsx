import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { User } from 'firebase/auth'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { Entry } from './period'
import { Lijst } from './Lijst'

// Firestore stands in as an in-memory ledger: the writers append to `store`,
// the hooks read it back and re-render, which is exactly the loop the real
// onSnapshot listeners drive. Everything above the data layer is the real thing.
type Row = Entry & { id: string; by: string; byNick: string }
const store = { entries: [] as Row[], guests: [] as { nick: string; naam: string; pid: string }[], mijnRol: 'lid' }
const listeners = new Set<() => void>()
let n = 0

vi.mock('./auth', () => ({ signOut: vi.fn() }))

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
  const write = (personRef: string, kind: 'streep' | 'bak', delta: number, by: string, byNick: string) => {
    const id = 'e' + ++n
    store.entries.push({ id, personRef, kind, delta, by, byNick })
    listeners.forEach((l) => l())
    return Promise.resolve({ id })
  }
  return {
    periodId: (nr: number) => 'p' + nr,
    usePeriod: () => ({ nr: 1, start: '2026-09-01', eind: null, open: true, perBak: 24, prijs: 1.5, bakPrijs: 30 }),
    usePeople: () => {
      live()
      return [
        { id: 'u1', personRef: 'user:u1', nick: 'Sander', naam: 'Sander V.', isGuest: false, role: store.mijnRol },
        { id: 'u2', personRef: 'user:u2', nick: 'Anton', naam: 'Anton B.', isGuest: false, role: 'lid' },
        ...store.guests.map((g, i) => ({ id: 'g' + i, personRef: 'guest:g' + i, ...g, isGuest: true, role: 'lid' })),
      ]
    },
    useEntries: () => {
      live()
      return store.entries
    },
    addStreep: (_pid: string, ref: string, uid: string, nick: string, k = 1) => write(ref, 'streep', k, uid, nick),
    addBak: (_pid: string, ref: string, uid: string, nick: string, k: number) => write(ref, 'bak', k, uid, nick),
    removeOne: (_pid: string, ref: string, kind: 'streep' | 'bak', uid: string, nick: string) =>
      write(ref, kind, -1, uid, nick),
    undo: (_pid: string, id: string) => {
      store.entries = store.entries.filter((e) => e.id !== id)
      listeners.forEach((l) => l())
      return Promise.resolve()
    },
    addGuest: (pid: string, nick: string, naam: string) => {
      store.guests.push({ nick, naam, pid })
      listeners.forEach((l) => l())
      return Promise.resolve({ id: 'g' })
    },
    useProfile: () => ({ nick: 'Sander', naam: 'Sander V.', mail: 'sander@x.be' }),
    saveProfile: vi.fn(() => Promise.resolve()),
    useGroup: () => ({ naam: 'Chiro Elzestraat' }),
    saveGroupName: vi.fn(() => Promise.resolve()),
    setRole: vi.fn(() => Promise.resolve()),
  }
})

const me = { uid: 'u1', displayName: 'Sander Van Loock' } as User
const ANTON = 'user:u2'

const q = (sel: string) => document.querySelector(sel) as HTMLElement | null
const row = (ref: string) => q(`[data-row="${ref}"]`)!
const stat = (naam: string) => q(`[data-stat="${naam}"]`)!.textContent
const streepjes = (ref: string) => row(ref).querySelector('[data-streep]')!.textContent
const bakken = (ref: string) => row(ref).querySelector('[data-bak]')?.textContent

/** One tap: pointerdown + pointerup inside the 620ms hold window. */
const tik = async (ref: string) => {
  fireEvent.pointerDown(row(ref))
  await act(async () => void fireEvent.pointerUp(row(ref)))
}

/** A press held past HOLD_MS, which is what opens the BAK sheet. */
const houdVast = async (ref: string) => {
  fireEvent.pointerDown(row(ref))
  await act(async () => vi.advanceTimersByTime(700))
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  store.entries = []
  store.guests = []
  store.mijnRol = 'lid'
  n = 0
  localStorage.clear()
  location.hash = ''
})

afterEach(() => {
  cleanup() // vitest draait zonder globals, dus geen automatische cleanup
  vi.useRealTimers()
})

test('AC2: tikken zet een streep en werkt rij + kopstatistieken meteen bij', async () => {
  render(<Lijst user={me} />)
  expect(streepjes(ANTON)).toBe('0')

  await tik(ANTON)

  expect(streepjes(ANTON)).toBe('1')
  expect(stat('streepjes')).toBe('1')
  expect(stat('euro')).toBe('€1,50')
  // niet op de verkeerde naam
  expect(streepjes('user:u1')).toBe('0')
})

test('AC3: vasthouden toont de voortgangsbalk, opent de BAK-lade en zet het gekozen aantal bakken', async () => {
  render(<Lijst user={me} />)

  fireEvent.pointerDown(row(ANTON))
  expect(q('[data-hold]')).not.toBeNull() // balk loopt tijdens het vasthouden
  await act(async () => vi.advanceTimersByTime(700))

  const lade = screen.getByText('EEN HELE BAK').parentElement!
  expect(lade.textContent).toContain('Anton') // lade staat op Antons naam
  fireEvent.click(screen.getByText('+'))
  expect(screen.getByText('24 streepjes per bak · 48 streepjes voor 2 bakken')).toBeTruthy()

  await act(async () => void fireEvent.click(screen.getByText('Zet op zijn naam')))

  expect(stat('bakken')).toBe('2')
  expect(bakken(ANTON)).toBe('+ 2 BAKKEN')
  expect(screen.queryByText('EEN HELE BAK')).toBeNull() // lade dicht
})

test('AC4: gomstand keert beide gebaren om, en schrapt niet onder nul', async () => {
  render(<Lijst user={me} />)
  await tik(ANTON)
  await houdVast(ANTON)
  await act(async () => void fireEvent.click(screen.getByText('Zet op zijn naam')))
  expect(streepjes(ANTON)).toBe('1')
  expect(stat('bakken')).toBe('1')

  fireEvent.click(screen.getByText('corrigeren'))
  expect(screen.getByText('TIK = –1 · VASTHOUDEN = – BAK')).toBeTruthy()

  await tik(ANTON) // tik = streep weg
  expect(streepjes(ANTON)).toBe('0')

  await houdVast(ANTON) // vasthouden = BAK weg, geen lade
  expect(screen.queryByText('EEN HELE BAK')).toBeNull()
  expect(stat('bakken')).toBe('0')

  // alles op nul: verder schrappen mag niets meer wegschrijven
  const voor = store.entries.length
  await tik(ANTON)
  await houdVast(ANTON)
  expect(store.entries.length).toBe(voor)
  expect(stat('streepjes')).toBe('0')
  expect(stat('euro')).toBe('€0,00')
})

test('AC5: elke actie krijgt een ongedaan-snackbar die de actie terugdraait', async () => {
  render(<Lijst user={me} />)

  await tik(ANTON)
  expect(screen.getByText('+1 voor Anton · Anton krijgt een melding')).toBeTruthy()
  await act(async () => void fireEvent.click(screen.getByText('ONGEDAAN')))
  expect(streepjes(ANTON)).toBe('0')
  expect(store.entries).toEqual([])
  expect(screen.queryByText('ONGEDAAN')).toBeNull()

  // ook bij schrappen
  await tik(ANTON)
  fireEvent.click(screen.getByText('corrigeren'))
  await tik(ANTON)
  expect(screen.getByText('1 streep geschrapt bij Anton · blijft doorstreept in het logboek')).toBeTruthy()
  await act(async () => void fireEvent.click(screen.getByText('ONGEDAAN')))
  expect(streepjes(ANTON)).toBe('1')
})

test('AC6: elke boeking legt vast wie, voor wie en wat, en is terug te lezen', async () => {
  render(<Lijst user={me} />)

  await tik(ANTON)
  await houdVast(ANTON)
  await act(async () => void fireEvent.click(screen.getByText('Zet op zijn naam')))
  fireEvent.click(screen.getByText('corrigeren'))
  await tik(ANTON)

  expect(store.entries).toEqual([
    { id: 'e1', personRef: ANTON, kind: 'streep', delta: 1, by: 'u1', byNick: 'Sander' },
    { id: 'e2', personRef: ANTON, kind: 'bak', delta: 1, by: 'u1', byNick: 'Sander' },
    { id: 'e3', personRef: ANTON, kind: 'streep', delta: -1, by: 'u1', byNick: 'Sander' },
  ])
  // het schrappen blijft in het logboek staan (append-only), niet verwijderd
  expect(store.entries.length).toBe(3)
})

test('AC7: een gast komt via + gast toevoegen op de lijst van deze periode', async () => {
  render(<Lijst user={me} />)

  fireEvent.click(screen.getByText('+ gast toevoegen'))
  fireEvent.click(screen.getByText('Gast op de lijst'))
  expect(screen.getByText('Bijnaam is verplicht')).toBeTruthy() // bijnaam is verplicht

  fireEvent.change(screen.getByPlaceholderText('bv. Wollie'), { target: { value: 'Wollie' } })
  fireEvent.change(screen.getByPlaceholderText('bv. Wout D.'), { target: { value: 'Wout D.' } })
  await act(async () => void fireEvent.click(screen.getByText('Gast op de lijst')))

  expect(store.guests).toEqual([{ nick: 'Wollie', naam: 'Wout D.', pid: 'p1' }]) // alleen periode p1
  expect(screen.getByText('Wollie')).toBeTruthy()

  await tik('guest:g0') // en je kan er meteen op strepen
  expect(streepjes('guest:g0')).toBe('1')
})

test('AC1: Mijn profiel in het menu opent het echte scherm, geen stub', async () => {
  render(<Lijst user={me} />)

  fireEvent.click(screen.getAllByText('Sander')[0]) // het menu-chipje bovenaan
  fireEvent.click(screen.getByText('Mijn profiel'))

  expect(screen.queryByText('Komt nog.')).toBeNull()
  expect(screen.getByText('Zo staat je naam op de lijst en in de mededeling van je betaling.')).toBeTruthy()
})

test('AC2: Beheer staat alleen in het menu voor een beheerder', () => {
  render(<Lijst user={me} />)
  fireEvent.click(screen.getAllByText('Sander')[0]) // het menu-chipje bovenaan

  expect(screen.queryByText('Beheer')).toBeNull() // Sander is nog maar een lid
})

test('AC2 + AC3: een beheerder ziet Beheer en opent het echte scherm', () => {
  store.mijnRol = 'beheerder'
  render(<Lijst user={me} />)

  fireEvent.click(screen.getAllByText('Sander')[0])
  fireEvent.click(screen.getByText('Beheer'))

  expect(screen.queryByText('Komt nog.')).toBeNull()
  expect(screen.getByText('Wie zit in de groep, wie mag wat. Alleen beheerders zien deze pagina.')).toBeTruthy()
})

test('het menu badget elke bestemming met de rol die ze vraagt', () => {
  store.mijnRol = 'beheerder'
  render(<Lijst user={me} />)
  fireEvent.click(screen.getAllByText('Sander')[0])

  expect(screen.getAllByText('DRANKLEIDER')).toHaveLength(2) // Afsluiten en Inningen
  expect(screen.getByText('BEHEERDER')).toBeTruthy() // Beheer
  expect(screen.queryByText('LID')).toBeNull() // wat iedereen mag krijgt geen badge
})

test('de openstaande pagina staat in de url, dus een refresh blijft staan', () => {
  store.mijnRol = 'beheerder'
  render(<Lijst user={me} />)

  fireEvent.click(screen.getAllByText('Sander')[0])
  fireEvent.click(screen.getByText('Beheer'))
  expect(location.hash).toBe('#/beheer')

  // een refresh is een nieuwe render met dezelfde hash
  cleanup()
  render(<Lijst user={me} />)
  expect(screen.getByText('Wie zit in de groep, wie mag wat. Alleen beheerders zien deze pagina.')).toBeTruthy()
})

test('het menu blijft op elk scherm bereikbaar, er is geen terugpijl', () => {
  render(<Lijst user={me} />)

  fireEvent.click(screen.getAllByText('Sander')[0])
  fireEvent.click(screen.getByText('Mijn profiel'))

  expect(screen.queryByText('← Terug')).toBeNull()
  // het chipje staat er nog, dus je kan van hier naar elk ander scherm
  fireEvent.click(screen.getAllByText('Sander')[0])
  fireEvent.click(screen.getByText('Betalen'))
  expect(screen.getByText('Komt nog.')).toBeTruthy()
})

test('een lid dat #/beheer intikt komt op de lijst, niet op een leeg scherm', () => {
  location.hash = '#/beheer'
  render(<Lijst user={me} />) // Sander is een lid

  expect(screen.getByText('PERIODE 1 · LIVE')).toBeTruthy()
})

test('via De lijst in het menu kom je terug op de lijst', () => {
  render(<Lijst user={me} />)

  fireEvent.click(screen.getAllByText('Sander')[0])
  fireEvent.click(screen.getByText('Mijn profiel'))
  expect(location.hash).toBe('#/profiel')

  fireEvent.click(screen.getAllByText('Sander')[0])
  fireEvent.click(screen.getByText('De lijst'))

  expect(location.hash).toBe('#/')
  expect(screen.getByText('PERIODE 1 · LIVE')).toBeTruthy()
})

test('de titel staat op de regel van het menuknopje, met de rolbadge erbij', () => {
  store.mijnRol = 'beheerder'
  location.hash = '#/beheer'
  render(<Lijst user={me} />)

  // titel, badge en chipje staan samen in één kop, niet gestapeld
  const kop = screen.getByText('Beheer').parentElement!.parentElement!
  expect(kop.textContent).toContain('BEHEERDER')
  expect(kop.textContent).toContain('Beheer')
  expect(kop.textContent).toContain('Sander') // het menuchipje
})

test('een scherm zonder rol krijgt gewoon de titel, geen badge', () => {
  location.hash = '#/betalen'
  render(<Lijst user={me} />)

  expect(screen.getByText('Betalen')).toBeTruthy()
  expect(screen.queryByText('DRANKLEIDER')).toBeNull()
})
