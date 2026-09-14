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
  Timestamp,
  updateDoc,
} from 'firebase/firestore'
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest'

let env: RulesTestEnvironment
// Twee leiders, elk met hun eigen client, zoals twee telefoons op de fuif.
const sander = () => env.authenticatedContext('u1').firestore()
const wollie = () => env.authenticatedContext('u2').firestore()
const entry = (by: string, personRef = 'user:u2', kind = 'streep', delta = 1) => ({ personRef, kind, delta, by, byNick: by })

// TASK-10: binnenPeriode() compares against the real clock (request.time), so
// these fixtures are anchored well in the past/well-open, not to the app's
// own fictional "today" — START predates any test run, EIND is a period that
// really has closed by the time these tests execute.
const START = Timestamp.fromDate(new Date('2020-01-01T00:00:00Z'))
const EIND = Timestamp.fromDate(new Date('2026-05-31T00:00:00Z'))

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'streepkeslijst-rules-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  })
})

// TASK-7 gates every ledger collection on the reader/writer already having a
// users/{uid} doc (see firestore.rules), so the two regulars in these tests
// need one seeded before each test — same as any real member, whose doc was
// created by claimInvite (auth.ts) the first time they signed in. Tests about
// the claim itself (a doc that does NOT exist yet) use a third, unseeded uid.
beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'users', 'u1'), { nick: 'Sander', role: 'lid' })
    await setDoc(doc(db, 'users', 'u2'), { nick: 'Wollie', role: 'lid' })
    // TASK-10: periods/p1/entries' rules now do a get() on periods/p1 for
    // binnenPeriode(), so any test that books an entry there needs an active
    // period doc to exist — an open period, started well in the past.
    await setDoc(doc(db, 'periods', 'p1'), { nr: 1, start: '2020-01-01', eind: null, startAt: START, eindAt: null, perBak: 24, prijs: 1.5, bakPrijs: 30 })
  })
})
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

test('een periode kan alleen door een drankleider/beheerder aangepast worden, nooit verwijderd', async () => {
  await env.withSecurityRulesDisabled(async (ctx) =>
    setDoc(doc(ctx.firestore(), 'periods', 'p1'), {
      nr: 1, start: '2026-09-01', eind: null, startAt: START, eindAt: null, perBak: 24, prijs: 1.5, bakPrijs: 30,
    }),
  )

  // Sander en Wollie zijn allebei nog maar een lid (globale beforeEach).
  await assertFails(updateDoc(doc(sander(), 'periods', 'p1'), { prijs: 0.1 }))
  await assertFails(deleteDoc(doc(sander(), 'periods', 'p1')))
})

/** TASK-10 (was TASK-8 AC8): Periode afsluiten — alleen een drankleider (of
 *  beheerder) sluit de lopende periode af en opent de volgende, een lid mag
 *  geen van beide. periods/{pid} vervangt meta/period volledig (TASK-10). */
test('TASK-10: een drankleider sluit een periode af en opent de volgende, een lid niet', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users', 'u1'), { nick: 'Sander', role: 'drankleider' })
    await setDoc(doc(ctx.firestore(), 'periods', 'p1'), {
      nr: 1, start: '2026-09-01', eind: null, startAt: START, eindAt: null, perBak: 24, prijs: 1.5, bakPrijs: 30,
    })
  })

  await assertSucceeds(
    updateDoc(doc(sander(), 'periods', 'p1'), { eind: '2026-09-30', eindAt: EIND, closedBy: 'u1' }),
  )
  await assertSucceeds(
    setDoc(doc(sander(), 'periods', 'p2'), {
      nr: 2, start: '2026-10-01', eind: null, startAt: EIND, eindAt: null, perBak: 24, prijs: 1.5, bakPrijs: 30,
    }),
  )

  // Wollie is maar een lid: geen van beide.
  await assertFails(updateDoc(doc(wollie(), 'periods', 'p1'), { eind: '2026-09-30' }))
  await assertFails(
    setDoc(doc(wollie(), 'periods', 'p3'), {
      nr: 3, start: '2026-11-01', eind: null, startAt: EIND, eindAt: null, perBak: 24, prijs: 1.5, bakPrijs: 30,
    }),
  )
})

/** TASK-10 AC4: strepen en schrappen werken alleen binnen de actieve periode —
 *  wat de bevroren totals vroeger beschermde (een oude boeking wissen om een
 *  afgerekende rekening te verkleinen) zit nu hier. */
test('TASK-10 AC4: een lid mag strepen binnen de actieve periode, niet in een periode wiens eindAt al voorbij is', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'periods', 'actief'), { nr: 2, start: '2026-06-01', eind: null, startAt: START, eindAt: null, perBak: 24, prijs: 1.5, bakPrijs: 30 })
    await setDoc(doc(db, 'periods', 'gesloten'), {
      nr: 1, start: '2026-05-01', eind: '2026-05-31', startAt: START, eindAt: EIND, perBak: 24, prijs: 1.5, bakPrijs: 30,
    })
  })

  await assertSucceeds(addDoc(collection(sander(), 'periods/actief/entries'), entry('u1')))
  await assertFails(addDoc(collection(sander(), 'periods/gesloten/entries'), entry('u1')))
})

test('TASK-10 AC4: schrappen (verwijderen van je eigen boeking) kan ook niet meer nadat de periode voorbij is', async () => {
  let ref: { id: string }
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'periods', 'nu-nog-actief'), { nr: 1, start: '2026-06-01', eind: null, startAt: START, eindAt: null, perBak: 24, prijs: 1.5, bakPrijs: 30 })
    ref = await addDoc(collection(db, 'periods/nu-nog-actief/entries'), entry('u1'))
    // De periode sluit ná de boeking, met een einddatum die al voorbij is.
    await setDoc(doc(db, 'periods', 'nu-nog-actief'), { eind: '2026-06-30', eindAt: EIND }, { merge: true })
  })

  await assertFails(deleteDoc(doc(sander(), 'periods/nu-nog-actief/entries', ref!.id)))
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

/** TASK-7: the real security change. u1/u2 are seeded as plain leden by the
 *  global beforeEach; u3 stays unseeded on purpose, so its own users/{uid}
 *  create is still up for grabs (the atomic claim, tested below). */
/** TASK-9 AC6/AC7: periods/{pid}/betalingen/{personRef} is keyed by personRef, not
 *  uid — a lid may claim and retract their own "gemeld", never write "betaald" or
 *  someone else's doc, a drankleider may do all of it including a guest's doc. */
test('TASK-9 AC6: een lid meldt en herroept alleen de eigen betaling, nooit betaald of andermans doc', async () => {
  await env.withSecurityRulesDisabled(async (ctx) =>
    setDoc(doc(ctx.firestore(), 'periods', 'p1'), { nr: 1, start: '2026-06-01', eind: '2026-06-30', prijs: 1.5, bakPrijs: 30, perBak: 24, totals: {} }),
  )

  await assertSucceeds(setDoc(doc(sander(), 'periods/p1/betalingen/user:u1'), { status: 'gemeld' }))
  await assertSucceeds(deleteDoc(doc(sander(), 'periods/p1/betalingen/user:u1')))

  // Zelf 'betaald' zetten mag niet — dat is de drankleider in Inningen.
  await assertFails(setDoc(doc(sander(), 'periods/p1/betalingen/user:u1'), { status: 'betaald' }))
  // Andermans doc, ook niet.
  await assertFails(setDoc(doc(sander(), 'periods/p1/betalingen/user:u2'), { status: 'gemeld' }))
  // Een gast claimt niets zelf — dat doc bestaat alleen voor de drankleider.
  await assertFails(setDoc(doc(sander(), 'periods/p1/betalingen/guest:g1'), { status: 'gemeld' }))

  // Een reeds 'betaald' gezet doc kan een lid niet meer terugzetten.
  await env.withSecurityRulesDisabled(async (ctx) =>
    setDoc(doc(ctx.firestore(), 'periods/p1/betalingen/user:u1'), { status: 'betaald' }),
  )
  await assertFails(deleteDoc(doc(sander(), 'periods/p1/betalingen/user:u1')))
})

test('TASK-9 AC6: een drankleider mag elke betaling zetten, ook betaald en die van een gast', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users', 'u1'), { nick: 'Sander', role: 'drankleider' })
    await setDoc(doc(ctx.firestore(), 'periods', 'p1'), { nr: 1, start: '2026-06-01', eind: '2026-06-30', prijs: 1.5, bakPrijs: 30, perBak: 24, totals: {} })
  })

  await assertSucceeds(setDoc(doc(sander(), 'periods/p1/betalingen/guest:g1'), { status: 'betaald' }))
  await assertSucceeds(setDoc(doc(sander(), 'periods/p1/betalingen/user:u2'), { status: 'betaald' }))
  await assertSucceeds(deleteDoc(doc(sander(), 'periods/p1/betalingen/guest:g1')))
  await assertSucceeds(getDocs(collection(sander(), 'periods/p1/betalingen')))
})

test('AC9: alleen een beheerder maakt, herinnert of trekt een uitnodiging in', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users', 'u1'), { nick: 'Sander', role: 'beheerder' })
  })

  await assertSucceeds(setDoc(doc(sander(), 'invites', 'nieuw@mail.be'), { email: 'nieuw@mail.be', by: 'u1', byNick: 'Sander', herinnerd: 0 }))
  await assertSucceeds(getDocs(collection(sander(), 'invites')))
  await assertSucceeds(updateDoc(doc(sander(), 'invites', 'nieuw@mail.be'), { herinnerd: 1 }))
  await assertSucceeds(deleteDoc(doc(sander(), 'invites', 'nieuw@mail.be')))

  // Wollie is maar een lid: geen van de drie.
  await assertFails(setDoc(doc(wollie(), 'invites', 'ander@mail.be'), { email: 'ander@mail.be', by: 'u2', byNick: 'Wollie', herinnerd: 0 }))
  await env.withSecurityRulesDisabled(async (ctx) =>
    setDoc(doc(ctx.firestore(), 'invites', 'ander@mail.be'), { email: 'ander@mail.be', by: 'u1', byNick: 'Sander', herinnerd: 0 }),
  )
  await assertFails(updateDoc(doc(wollie(), 'invites', 'ander@mail.be'), { herinnerd: 1 }))
  await assertFails(deleteDoc(doc(wollie(), 'invites', 'ander@mail.be')))
})

test('AC7: een uitgenodigd adres kan het eigen users/{uid} aanmaken en de eigen uitnodiging opruimen', async () => {
  const nieuweling = env.authenticatedContext('u3', { email: 'Nieuw@Mail.be' }).firestore()
  await env.withSecurityRulesDisabled(async (ctx) =>
    setDoc(doc(ctx.firestore(), 'invites', 'nieuw@mail.be'), { email: 'nieuw@mail.be', by: 'u1', byNick: 'Sander', herinnerd: 0 }),
  )

  // De rule leest het adres uit het token, lowercased — precies wat claimInvite (auth.ts) doet.
  await assertSucceeds(setDoc(doc(nieuweling, 'users', 'u3'), { nick: 'Nieuw', role: 'lid' }))
  await assertSucceeds(deleteDoc(doc(nieuweling, 'invites', 'nieuw@mail.be')))
})

test('AC8: een niet-uitgenodigd adres krijgt geen users/{uid} en komt nergens binnen', async () => {
  const vreemde = env.authenticatedContext('u4', { email: 'vreemde@mail.be' }).firestore()

  await assertFails(setDoc(doc(vreemde, 'users', 'u4'), { nick: 'Vreemde', role: 'lid' }))
  await assertFails(getDocs(collection(vreemde, 'invites')))
  await assertFails(getDocs(collection(vreemde, 'periods/p1/entries')))
  await assertFails(getDoc(doc(vreemde, 'meta', 'group')))
})
