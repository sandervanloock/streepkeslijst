import { expect, test } from 'vitest'
import { euro, euroTotaal, totals } from './period'
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
