import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import { Logboek } from './Logboek'
import type { Entry } from './period'

afterEach(cleanup)

const toon = (entries: Entry[]) => render(<Logboek entries={entries} myRef="user:a" />)

test("AC5: een boeking door iemand anders toont 'door X', niet 'zelf gezet'", () => {
  toon([
    { personRef: 'user:a', kind: 'streep', delta: 1, at: new Date(), by: 'u2', byNick: 'Anton' },
  ])

  expect(screen.getByText('door Anton')).toBeTruthy()
  expect(screen.queryByText('zelf gezet')).toBeNull()
})

test("AC5: een zelf gezette boeking toont 'zelf gezet'", () => {
  toon([
    { personRef: 'user:a', kind: 'streep', delta: 1, at: new Date(), by: 'a', byNick: 'Ik' },
  ])

  expect(screen.getByText('zelf gezet')).toBeTruthy()
})

test('AC5: een geschrapte BAK toont allebei de labels, niet enkel GESCHRAPT', () => {
  toon([{ personRef: 'user:a', kind: 'bak', delta: -1, at: new Date(), by: 'a', byNick: 'Ik' }])

  expect(screen.getByText('BAK')).toBeTruthy()
  expect(screen.getByText('GESCHRAPT')).toBeTruthy()
})

test('AC7: een periode zonder boekingen op jouw naam toont de lege staat', () => {
  toon([])

  expect(screen.getByText('Nog niets geboekt')).toBeTruthy()
})

test('AC2: andermans boekingen komen niet in jouw logboek terecht', () => {
  toon([{ personRef: 'user:b', kind: 'streep', delta: 1, at: new Date(), by: 'u2', byNick: 'Anton' }])

  expect(screen.getByText('Nog niets geboekt')).toBeTruthy()
})
