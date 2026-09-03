import { useEffect, useState } from 'react'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  increment,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore'
import { db } from './firebase'
import type { Entry } from './period'

export type Period = {
  nr: number
  start: string
  eind: string | null
  open: boolean
  perBak: number
  prijs: number
  bakPrijs: number
}

const defaultPeriod: Period = {
  nr: 1,
  start: new Date().toISOString().slice(0, 10),
  eind: null,
  open: true,
  perBak: 24,
  prijs: 1.5,
  bakPrijs: 30,
}

export const periodId = (nr: number) => 'p' + nr

/** meta/period is the seam for the not-yet-built afsluiten/beheer screens: seed it once, then just read it. */
export function usePeriod() {
  const [period, setPeriod] = useState<Period>()

  useEffect(() => {
    const ref = doc(db, 'meta', 'period')
    getDoc(ref).then((snap) => {
      if (!snap.exists()) setDoc(ref, defaultPeriod)
    })
    return onSnapshot(ref, (snap) => {
      const data = snap.data()
      if (data) setPeriod(data as Period)
    })
  }, [])

  return period
}

export type Rol = 'lid' | 'drankleider' | 'beheerder'

export type Group = { naam: string }

const defaultGroup: Group = { naam: 'Chiro Elzestraat' }

/** meta/group, seeded once and then just read, like usePeriod above — except this
 *  one never returns undefined. A period must be loaded before anything renders
 *  (its prices are real money), but a group name is cosmetic: falling back to the
 *  default beats hiding the whole Beheer screen when the doc is missing or the
 *  read is denied, which is exactly what a not-yet-deployed rules change looks like. */
export function useGroup() {
  const [group, setGroup] = useState<Group>(defaultGroup)

  useEffect(() => {
    const ref = doc(db, 'meta', 'group')
    getDoc(ref).then((snap) => {
      if (!snap.exists()) setDoc(ref, defaultGroup)
    })
    return onSnapshot(ref, (snap) => {
      const data = snap.data()
      if (data) setGroup(data as Group)
    })
  }, [])

  return group
}

export const saveGroupName = (naam: string) =>
  setDoc(doc(db, 'meta', 'group'), { naam }, { merge: true })

export const setRole = (uid: string, role: Rol) =>
  setDoc(doc(db, 'users', uid), { role }, { merge: true })

export type Person = { id: string; personRef: string; nick: string; naam: string; isGuest: boolean; role: Rol }

/** users + this period's guests, merged into one list (AC7: guests are current-period-only). */
export function usePeople(periodId: string | undefined) {
  const [users, setUsers] = useState<Person[]>([])
  const [guests, setGuests] = useState<Person[]>([])

  useEffect(
    () =>
      onSnapshot(collection(db, 'users'), (snap) =>
        setUsers(
          snap.docs.map((d) => ({
            id: d.id,
            personRef: 'user:' + d.id,
            nick: d.data().nick ?? d.data().name ?? '?',
            naam: d.data().name ?? '',
            isGuest: false,
            // Missing role = lid, so the users already in develop/prod need no migration.
            role: (d.data().role ?? 'lid') as Rol,
          })),
        ),
      ),
    [],
  )

  useEffect(() => {
    if (!periodId) return
    return onSnapshot(collection(db, 'periods', periodId, 'guests'), (snap) =>
      setGuests(
        snap.docs.map((d) => ({
          id: d.id,
          personRef: 'guest:' + d.id,
          nick: d.data().nick,
          naam: d.data().naam ?? '',
          isGuest: true,
          role: 'lid',
        })),
      ),
    )
  }, [periodId])

  return [...users, ...guests]
}

export function useEntries(periodId: string | undefined) {
  const [entries, setEntries] = useState<(Entry & { id: string })[]>([])

  useEffect(() => {
    if (!periodId) return
    return onSnapshot(collection(db, 'periods', periodId, 'entries'), (snap) =>
      setEntries(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Entry) }))),
    )
  }, [periodId])

  return entries
}

const writeEntry = (
  periodId: string,
  personRef: string,
  kind: 'streep' | 'bak',
  delta: number,
  byUid: string,
  byNick: string,
) =>
  addDoc(collection(db, 'periods', periodId, 'entries'), {
    personRef,
    kind,
    delta,
    by: byUid,
    byNick,
    at: serverTimestamp(),
  })

export const addStreep = (periodId: string, personRef: string, byUid: string, byNick: string, n = 1) =>
  writeEntry(periodId, personRef, 'streep', n, byUid, byNick)

export const addBak = (periodId: string, personRef: string, byUid: string, byNick: string, n: number) =>
  writeEntry(periodId, personRef, 'bak', n, byUid, byNick)

export const removeOne = (
  periodId: string,
  personRef: string,
  kind: 'streep' | 'bak',
  byUid: string,
  byNick: string,
) => writeEntry(periodId, personRef, kind, -1, byUid, byNick)

export const undo = (periodId: string, entryId: string) =>
  deleteDoc(doc(db, 'periods', periodId, 'entries', entryId))

export const addGuest = (periodId: string, nick: string, naam: string, mail: string | null, byUid: string) =>
  addDoc(collection(db, 'periods', periodId, 'guests'), {
    nick,
    naam,
    mail,
    by: byUid,
    at: serverTimestamp(),
  })

/** users/{uid}, live: the extra fields (mail) that Person/usePeople doesn't carry (TASK-5). */
export function useProfile(uid: string) {
  const [profile, setProfile] = useState<{ nick: string; naam: string; mail: string }>()

  useEffect(
    () =>
      onSnapshot(doc(db, 'users', uid), (snap) => {
        const data = snap.data()
        setProfile({ nick: data?.nick ?? '', naam: data?.name ?? '', mail: data?.mail ?? '' })
      }),
    [uid],
  )

  return profile
}

/** The payout address is `mail`, deliberately not `email`: `email` is the Google account
 *  identity that userDoc() refreshes on every login, so storing a hand-picked address
 *  there would be undone at the next sign-in — the same trap the nick was in. Guests
 *  already use `mail` for their afrekening address (addGuest). */
export const saveProfile = (uid: string, nick: string, naam: string, mail: string) =>
  setDoc(doc(db, 'users', uid), { nick, name: naam, mail }, { merge: true })

export type Invite = { email: string; by: string; byNick: string; herinnerd: number; at?: { toDate: () => Date } }

/** invites/{email}, doc id the lowercased address — the invite doc IS the access
 *  grant (TASK-7's delivery decision: the app doesn't send mail, see auth.ts and
 *  firestore.rules). "Already invited" is therefore an exists check, never a
 *  query, same reasoning as periodId elsewhere in this file. */
export function useInvites() {
  const [invites, setInvites] = useState<(Invite & { id: string })[]>([])

  useEffect(
    () =>
      onSnapshot(collection(db, 'invites'), (snap) =>
        setInvites(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Invite) }))),
      ),
    [],
  )

  return invites
}

export const createInvite = (email: string, byUid: string, byNick: string) =>
  setDoc(doc(db, 'invites', email), { email, by: byUid, byNick, at: serverTimestamp(), herinnerd: 0, lastShared: serverTimestamp() })

export const bumpInvite = (email: string) =>
  setDoc(doc(db, 'invites', email), { herinnerd: increment(1), lastShared: serverTimestamp() }, { merge: true })

export const revokeInvite = (email: string) => deleteDoc(doc(db, 'invites', email))

/** Builds the Dutch invitation text and hands it to the Web Share API (one tap
 *  into WhatsApp on mobile), falling back to a clipboard copy on a browser
 *  without navigator.share (desktop Firefox). The invite doc already exists
 *  either way — this is only the beheerder's own reminder text, never a claim
 *  that the invitee was notified (TASK-7 AC4). */
export async function shareInvite(email: string, groupNaam: string): Promise<'gedeeld' | 'gekopieerd'> {
  const tekst = `Je bent uitgenodigd voor de streepjeslijst van ${groupNaam}. Meld je aan met Google op ${email} — ${location.origin}`
  if (navigator.share) {
    try {
      await navigator.share({ text: tekst })
    } catch (e) {
      // De gebruiker sloot het deelvenster — het uitnodigingsdoc blijft gewoon staan.
      if (!(e instanceof Error && e.name === 'AbortError')) throw e
    }
    return 'gedeeld'
  }
  await navigator.clipboard.writeText(tekst)
  return 'gekopieerd'
}
