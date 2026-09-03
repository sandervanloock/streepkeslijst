/**
 * Runs against a real Firestore (the emulator), not a mock: `npm run test:rules`.
 * Two separate authenticated clients, so this is where the cross-client
 * behaviour of the lijst (AC8) and the append-only audit trail get proven.
 */
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest'

let env: RulesTestEnvironment
// Twee leiders, elk met hun eigen client, zoals twee telefoons op de fuif.
const sander = () => env.authenticatedContext('u1').firestore()
const wollie = () => env.authenticatedContext('u2').firestore()
const entry = (by: string, personRef = 'user:u2', kind = 'streep', delta = 1) => ({ personRef, kind, delta, by, byNick: by })

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'streepkeslijst-rules-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  })
})

beforeEach(() => env.clearFirestore())
afterAll(() => env.cleanup())

test('AC8: wat de ene leider schrijft komt bij de andere binnen zonder refresh', async () => {
  const mijn = collection(sander(), 'periods/p1/entries')

  // Sander kijkt naar de lijst; Wollie streept op zijn telefoon.
  const gezien: number[] = []
  const stop = onSnapshot(mijn, (snap) => gezien.push(snap.size))
  await new Promise((r) => setTimeout(r, 200))
  expect(gezien).toEqual([0])

  await addDoc(collection(wollie(), 'periods/p1/entries'), entry('u2'))
  await new Promise((r) => setTimeout(r, 400))
  stop()

  expect(gezien.at(-1)).toBe(1) // binnengekomen zonder dat Sander iets deed
})

test('boekingen blijven bewaard en zijn terug te lezen door de andere leider', async () => {
  const ref = await addDoc(collection(sander(), 'periods/p1/entries'), entry('u1'))
  const { docs } = await getDocs(collection(wollie(), 'periods/p1/entries'))

  expect(docs.map((d) => d.data())).toEqual([entry('u1')])
  expect(docs[0].id).toBe(ref.id)
})

test('een boeking staat altijd op jouw naam en kan nooit herschreven worden', async () => {
  await assertFails(addDoc(collection(sander(), 'periods/p1/entries'), entry('u2'))) // niet op andermans naam
  await assertSucceeds(addDoc(collection(sander(), 'periods/p1/entries'), entry('u1')))

  const ref = await addDoc(collection(sander(), 'periods/p1/entries'), entry('u1'))
  await assertFails(updateDoc(doc(sander(), 'periods/p1/entries', ref.id), { delta: 99 }))
})

test('ongedaan maken kan alleen bij je eigen boeking', async () => {
  const ref = await addDoc(collection(sander(), 'periods/p1/entries'), entry('u1'))

  await assertFails(deleteDoc(doc(wollie(), 'periods/p1/entries', ref.id)))
  await assertSucceeds(deleteDoc(doc(sander(), 'periods/p1/entries', ref.id)))
})

test('een gast staat vast: aanmaken en lezen mag, wijzigen en wissen niet', async () => {
  const ref = await addDoc(collection(sander(), 'periods/p1/guests'), { nick: 'Wollie', naam: 'Wout D.', by: 'u1' })

  await assertSucceeds(getDoc(doc(wollie(), 'periods/p1/guests', ref.id)))
  await assertFails(updateDoc(doc(sander(), 'periods/p1/guests', ref.id), { nick: 'Anders' }))
  await assertFails(deleteDoc(doc(sander(), 'periods/p1/guests', ref.id)))
})

test('de periode wordt eenmalig gezaaid en daarna niet meer aangepast', async () => {
  await assertSucceeds(setDoc(doc(sander(), 'meta', 'period'), { nr: 1, open: true, prijs: 1.5, bakPrijs: 30 }))

  await assertFails(updateDoc(doc(sander(), 'meta', 'period'), { prijs: 0.1 }))
  await assertFails(deleteDoc(doc(sander(), 'meta', 'period')))
})

test('AC8: je kan je eigen profiel schrijven, niet dat van iemand anders', async () => {
  await assertSucceeds(setDoc(doc(sander(), 'users', 'u1'), { nick: 'Wollie' }, { merge: true }))
  await assertFails(setDoc(doc(sander(), 'users', 'u2'), { nick: 'Anders' }, { merge: true }))
  await assertSucceeds(getDoc(doc(wollie(), 'users', 'u1'))) // iedereen mag de rest wel lezen
})

/** TASK-6: a beheerder hands out roles and renames the group; a lid does neither.
 *  The role is read out of the writer's own users doc, so it has to be seeded
 *  with the admin context that bypasses the rules. */
test('alleen een beheerder zet rollen en de groepsnaam', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'users', 'u1'), { nick: 'Sander', role: 'beheerder' })
    await setDoc(doc(db, 'users', 'u2'), { nick: 'Wollie', role: 'lid' })
    await setDoc(doc(db, 'meta', 'group'), { naam: 'Chiro Elzestraat' })
  })

  // Sander beheert: hij mag Wollie drankleider maken en de groep herdopen.
  await assertSucceeds(updateDoc(doc(sander(), 'users', 'u2'), { role: 'drankleider' }))
  await assertSucceeds(updateDoc(doc(sander(), 'meta', 'group'), { naam: 'Chiro Elzestraat Zuid' }))

  // Wollie is maar een lid: geen rollen, geen groepsnaam, ook niet voor zichzelf.
  await assertFails(updateDoc(doc(wollie(), 'users', 'u1'), { role: 'lid' }))
  await assertFails(updateDoc(doc(wollie(), 'meta', 'group'), { naam: 'Chiro Wollie' }))
})

test('je eigen profiel blijft van jou, ook als je geen beheerder bent', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users', 'u2'), { nick: 'Wollie', role: 'lid' })
  })

  await assertSucceeds(updateDoc(doc(wollie(), 'users', 'u2'), { nick: 'Wout' }))
})

test('zonder login kom je er niet in', async () => {
  const gast = env.unauthenticatedContext().firestore()

  await assertFails(getDocs(collection(gast, 'periods/p1/entries')))
  await assertFails(addDoc(collection(gast, 'periods/p1/entries'), entry('u1')))
})
