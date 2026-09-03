import { expect, test } from 'vitest'
import { hashVanScherm, schermVanHash } from './route'

test('elk scherm heeft een slug en komt er ook weer uit', () => {
  for (const scherm of ['Periode afsluiten', 'Beheer', 'Mijn profiel', 'Betalen', 'Inningen', 'Meldingen'])
    expect(schermVanHash(hashVanScherm(scherm))).toBe(scherm)
})

test('de lijst is de app zonder hash', () => {
  expect(schermVanHash('')).toBeUndefined()
  expect(schermVanHash('#/')).toBeUndefined()
  expect(hashVanScherm(undefined)).toBe('#/')
})

test('een slug die niet bestaat valt terug op de lijst, geen leeg scherm', () => {
  expect(schermVanHash('#/zever')).toBeUndefined()
})

test('de slug uit het ontwerp, met of zonder schuine streep', () => {
  expect(hashVanScherm('Mijn profiel')).toBe('#/profiel')
  expect(schermVanHash('#beheer')).toBe('Beheer')
  expect(schermVanHash('#/beheer')).toBe('Beheer')
})
