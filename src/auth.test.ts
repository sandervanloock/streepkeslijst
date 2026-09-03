import { expect, test } from 'vitest'
import { userDoc } from './auth'

test('the user record keeps the Google profile fields', () => {
  const { name, email, photoURL, lastLogin } = userDoc({
    displayName: 'Jan Peeters',
    email: 'jan@example.com',
    photoURL: 'https://example.com/jan.jpg',
  })
  expect({ name, email, photoURL }).toEqual({
    name: 'Jan Peeters',
    email: 'jan@example.com',
    photoURL: 'https://example.com/jan.jpg',
  })
  expect(lastLogin).toBeDefined()
})

test('a missing profile field stays null instead of undefined (Firestore rejects undefined)', () => {
  const d = userDoc({ displayName: null, email: null, photoURL: null })
  expect(d.name).toBeNull()
  expect(d.email).toBeNull()
  expect(d.photoURL).toBeNull()
})

test('AC7: userDoc no longer carries a nick, so it can never overwrite one the user set themselves', () => {
  const d = userDoc({ displayName: 'Jan Peeters', email: 'jan@example.com', photoURL: null })
  expect(d).not.toHaveProperty('nick')
})
