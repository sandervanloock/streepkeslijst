import { expect, test } from 'vitest'
import { actievePeriode, bedrag, dagNa, euro, euroTotaal, geldigeMail, magRol, magRolWijzigen, mededeling, totals } from './period'
import type { Entry } from './period'

test('groups entries per person and per kind', () => {
  const entries: Entry[] = [
    { personRef: 'user:a', kind: 'streep', delta: 1 },
    { personRef: 'user:a', kind: 'streep', delta: 1 },
    { personRef: 'user:a', kind: 'bak', delta: 1 },
    { personRef: 'user:b', kind: 'streep', delta: 1 },
  ]
  expect(totals(entries)).toEqual(
    new Map([
      ['user:a', { streep: 2, bak: 1 }],
      ['user:b', { streep: 1, bak: 0 }],
    ]),
  )
})

test('a negative delta (gomstand undo/correction) reduces the total', () => {
  const entries: Entry[] = [
    { personRef: 'user:a', kind: 'streep', delta: 1 },
    { personRef: 'user:a', kind: 'streep', delta: 1 },
    { personRef: 'user:a', kind: 'streep', delta: -1 },
  ]
  expect(totals(entries).get('user:a')).toEqual({ streep: 1, bak: 0 })
})

test('an empty ledger yields no totals and zero euros', () => {
  const t = totals([])
  expect(t.size).toBe(0)
  expect(euroTotaal(t, 1.5, 30)).toBe(0)
})

test('euro totals sum streep and bak at their own price', () => {
  const t = totals([
    { personRef: 'user:a', kind: 'streep', delta: 4 },
    { personRef: 'user:a', kind: 'bak', delta: 1 },
  ])
  expect(euroTotaal(t, 1.5, 30)).toBe(4 * 1.5 + 30)
})

test('euro formatting uses a comma, not a dot', () => {
  expect(euro(1.5)).toBe('€1,50')
  expect(euro(31.5)).toBe('€31,50')
  expect(euro(0)).toBe('€0,00')
})

test('TASK-9 AC1: bedrag is the per-person twin of euroTotaal, at the given prices', () => {
  expect(bedrag({ streep: 4, bak: 1 }, 1.5, 30)).toBe(4 * 1.5 + 30)
  expect(bedrag({ streep: 0, bak: 0 }, 1.5, 30)).toBe(0)
})

test('TASK-9 AC1: bedrag uses whatever prices it is given — the frozen archive prices, never live ones', () => {
  // Same totals, old (frozen) vs new (live) prices — the caller decides which one, bedrag itself has no opinion.
  expect(bedrag({ streep: 10, bak: 0 }, 1.5, 30)).toBe(15)
  expect(bedrag({ streep: 10, bak: 0 }, 2, 36)).toBe(20)
})

test('AC6: mededeling matches the design format, dd/mm dates and an uppercased nick', () => {
  expect(mededeling('wollie', { nr: 3, start: '2026-09-01', eind: '2026-09-30' })).toBe('STREEPJES P3 01/09-30/09 WOLLIE')
  expect(mededeling('Sander', { nr: 1, start: '2026-01-05', eind: null })).toBe('STREEPJES P1 05/01- SANDER')
})

test('de laatste beheerder kan niet gedegradeerd worden, met twee wel', () => {
  const alleen = [{ id: 'u1', role: 'beheerder' }, { id: 'u2', role: 'lid' }]
  expect(magRolWijzigen(alleen, 'u1', 'lid')).toBe(false)
  expect(magRolWijzigen(alleen, 'u1', 'drankleider')).toBe(false)

  const twee = [{ id: 'u1', role: 'beheerder' }, { id: 'u2', role: 'beheerder' }]
  expect(magRolWijzigen(twee, 'u1', 'lid')).toBe(true)

  // iemand beheerder maken mag altijd, ook als er nog geen enkele is
  expect(magRolWijzigen([{ id: 'u1', role: 'lid' }], 'u1', 'beheerder')).toBe(true)
})

test('AC2: geldigeMail herkent het adresformaat, niet meer dan dat', () => {
  expect(geldigeMail('wollie@mail.be')).toBe(true)
  expect(geldigeMail('voornaam.achternaam@chiro.be')).toBe(true)
  expect(geldigeMail('geen-adres')).toBe(false)
  expect(geldigeMail('geen@adres')).toBe(false)
  expect(geldigeMail('@mail.be')).toBe(false)
  expect(geldigeMail('  ')).toBe(false)
})

test('TASK-8 AC1/AC8: magRol — een beheerder voldoet ook aan drankleider, een lid aan niets erboven', () => {
  expect(magRol('drankleider', 'drankleider')).toBe(true)
  expect(magRol('beheerder', 'drankleider')).toBe(true)
  expect(magRol('beheerder', 'beheerder')).toBe(true)
  expect(magRol('lid', 'drankleider')).toBe(false)
  expect(magRol('drankleider', 'beheerder')).toBe(false)
  expect(magRol('lid', 'beheerder')).toBe(false)
})

test('TASK-8: dagNa schuift een dag op, ook over een maand- en jaargrens', () => {
  expect(dagNa('2026-09-06')).toBe('2026-09-07')
  expect(dagNa('2026-09-30')).toBe('2026-10-01')
  expect(dagNa('2026-12-31')).toBe('2027-01-01')
})

// TASK-10: which period is active is derived from today's date rather than a
// stored flag. Tested at the three boundaries AC8 names — the start day, the
// end day, and the day after — plus the regression this task exists for: a
// closed-with-future-eind pair must not move "today" out of the current period.
test('TASK-10 AC2/AC8: actievePeriode kiest de periode wiens bereik vandaag bevat, op de grenzen', () => {
  const periodes = [
    { start: '2026-08-01', eind: '2026-08-31' },
    { start: '2026-09-01', eind: null },
  ]

  expect(actievePeriode(periodes, '2026-08-01')).toBe(periodes[0]) // de startdag
  expect(actievePeriode(periodes, '2026-08-31')).toBe(periodes[0]) // de einddag zelf, nog erbij
  expect(actievePeriode(periodes, '2026-09-01')).toBe(periodes[1]) // de dag erna: de nieuwe periode
})

test('TASK-10 AC1: een periode afgesloten met een einddatum in de toekomst blijft actief tot en met die dag', () => {
  const periodes = [
    { start: '2026-08-01', eind: '2026-09-30' }, // gesloten, maar het laatste dagje ligt nog voor de boeg
    { start: '2026-10-01', eind: null },
  ]

  // De bug die dit oplost: sluiten met een toekomstige einddatum mag "vandaag"
  // niet meteen naar de volgende periode duwen.
  expect(actievePeriode(periodes, '2026-09-09')).toBe(periodes[0])
  expect(actievePeriode(periodes, '2026-09-30')).toBe(periodes[0])
  expect(actievePeriode(periodes, '2026-10-01')).toBe(periodes[1])
})
