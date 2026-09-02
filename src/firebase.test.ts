import { expect, test } from 'vitest'
import { databaseId } from './firebase'

test('the build mode picks the database', () => {
  expect(databaseId(undefined, true)).toBe('prod')
  expect(databaseId(undefined, false)).toBe('develop')
})

test('a blank override never leaks a dev build into prod', () => {
  expect(databaseId('', false)).toBe('develop')
  expect(databaseId('   ', false)).toBe('develop')
})

test('an explicit override wins over the build mode', () => {
  expect(databaseId('develop', true)).toBe('develop')
  expect(databaseId('prod', false)).toBe('prod')
})
