import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { Meldingen } from './Meldingen'
import type { Melding } from './data'

// Geen Firestore-mock hier: het scherm krijgt een plat Melding[] binnen (AC3),
// en dat is precies waarom TASK-15 er straks afgeleide meldingen bij kan gooien.
const nu = Date.now()
const geleden = (ms: number) => new Date(nu - ms)

const toon = (meldingen: Melding[], readAt?: Date) => {
  const onGa = vi.fn()
  const onAllesGelezen = vi.fn()
  render(<Meldingen nick="Sander" meldingen={meldingen} readAt={readAt} onGa={onGa} onAllesGelezen={onAllesGelezen} />)
  return { onGa, onAllesGelezen }
}

const afgesloten: Melding = {
  id: 'n1',
  kind: 'period-closed',
  text: 'Periode 3 is afgesloten. Je kan nu overschrijven.',
  meta: 'Op de rekening van de groep · je bedrag staat klaar op Betalen',
  at: geleden(60_000),
  action: { label: 'Naar je betaling', screen: 'Betalen' },
}

afterEach(cleanup)

test('AC2: een melding toont soort, tekst, meta en zijn actieknop', () => {
  toon([afgesloten])

  expect(screen.getByText('Periode afgesloten')).toBeTruthy()
  expect(screen.getByText(afgesloten.text)).toBeTruthy()
  expect(screen.getByText(afgesloten.meta)).toBeTruthy()
  expect(screen.getByText('Naar je betaling')).toBeTruthy()
})

test('AC4: de actieknop navigeert naar het scherm uit de melding', () => {
  const { onGa } = toon([afgesloten])

  fireEvent.click(screen.getByText('Naar je betaling'))

  expect(onGa).toHaveBeenCalledWith('Betalen')
})

// Dit is de kern van AC2/AC3/AC10: een kind die dit bestand nooit gezien heeft
// moet renderen én navigeren zonder dat er hier één regel bijkomt. Zakt deze
// test, dan is er ergens een if-else per kind ingeslopen.
test('AC10: een verzonnen kind met actie rendert en navigeert zonder codewijziging', () => {
  const { onGa } = toon([
    {
      id: 'n9',
      kind: 'something-new',
      text: 'Iets wat dit scherm nog nooit gezien heeft.',
      meta: 'en toch staat het er',
      at: geleden(30_000),
      action: { label: 'Bekijken', screen: 'Inningen' },
    },
  ])

  expect(screen.getByText('Something new')).toBeTruthy()
  expect(screen.getByText('Iets wat dit scherm nog nooit gezien heeft.')).toBeTruthy()

  fireEvent.click(screen.getByText('Bekijken'))
  expect(onGa).toHaveBeenCalledWith('Inningen')
})

// TASK-15 AC7: geen nieuw scherm, geen per-kind if-else — enkel twee
// lookup-regels voor kind 'voor-jou', dus dit hoeft alleen het label en de
// actieknop na te kijken, de rest bewijst AC10 hierboven al generiek.
test("TASK-15 AC7: kind 'voor-jou' rendert met zijn eigen label en de actieknop naar het logboek", () => {
  const { onGa } = toon([
    {
      id: 'n10',
      kind: 'voor-jou',
      text: 'Fien zette streepjes op jouw naam',
      meta: 'Aantal en tijdstip staan in je logboek.',
      at: geleden(5_000),
      action: { label: 'Naar mijn logboek', screen: 'Mijn logboek' },
    },
  ])

  expect(screen.getByText('Voor jou gestreept')).toBeTruthy()
  expect(screen.getByText('Fien zette streepjes op jouw naam')).toBeTruthy()

  fireEvent.click(screen.getByText('Naar mijn logboek'))
  expect(onGa).toHaveBeenCalledWith('Mijn logboek')
})

test('een melding zonder actie toont geen knop', () => {
  toon([{ id: 'n2', kind: 'period-closed', text: 'Enkel ter info.', meta: 'niets te doen', at: geleden(10_000) }])

  expect(screen.queryByText('Naar je betaling')).toBeNull()
  expect(screen.getByText('Enkel ter info.')).toBeTruthy()
})

test('AC5: de wacht-chip telt alleen ongelezen meldingen mét een actie', () => {
  // Alles ongelezen (readAt undefined): één melding met actie wacht op je.
  const { onAllesGelezen } = toon([afgesloten, { ...afgesloten, id: 'n2', action: undefined }])
  expect(screen.getByText('1 wachten op jou')).toBeTruthy()

  fireEvent.click(screen.getByText('alles gelezen'))
  expect(onAllesGelezen).toHaveBeenCalled()

  cleanup()
  // readAt na de melding: niets wacht nog.
  toon([afgesloten], new Date(nu))
  expect(screen.getByText('niets wacht op jou')).toBeTruthy()
})

test('meldingen staan onder de dagkop waar ze thuishoren', () => {
  toon([afgesloten, { ...afgesloten, id: 'n2', text: 'Van gisteren.', at: geleden(26 * 3_600_000) }])

  expect(screen.getByText('VANDAAG')).toBeTruthy()
  expect(screen.getByText('GISTEREN')).toBeTruthy()
})

test('een lege feed zegt dat er niets is, in plaats van een leeg scherm', () => {
  toon([])

  expect(screen.getByText('Nog geen meldingen.')).toBeTruthy()
  expect(screen.getByText('niets wacht op jou')).toBeTruthy()
})
