import { useEffect, useState } from 'react'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
  writeBatch,
} from 'firebase/firestore'
import { db } from './firebase'
import { dagNa } from './period'
import type { Entry } from './period'

// TASK-10: a period doc carries its own range — start/eind next to startAt/
// eindAt (rules need a timestamp compare, see firestore.rules's binnenPeriode).
// meta/period is gone: which period is active is derived from today's date
// (period.ts's actievePeriode), never read off a stored flag or 'open' bit.
export type Period = {
  nr: number
  start: string
  eind: string | null
  startAt: Timestamp
  eindAt: Timestamp | null
  perBak: number
  prijs: number
  bakPrijs: number
}

export const periodId = (nr: number) => 'p' + nr

const naarTimestamp = (iso: string) => Timestamp.fromDate(new Date(iso + 'T00:00:00Z'))

/** periods/{pid}: one collection, one source of truth, the running period
 *  included — replaces both the old usePeriod (meta/period) and TASK-9's
 *  useArchief, one onSnapshot on the whole collection, the same single listen
 *  the app already paid for. First-load seed: an empty collection writes
 *  periods/p1, same seam usePeriod used to be. */
export function usePeriodes() {
  const [periodes, setPeriodes] = useState<(Period & { id: string })[]>([])

  useEffect(() => {
    const col = collection(db, 'periods')
    getDocs(col).then((snap) => {
      if (snap.empty) {
        const start = new Date().toISOString().slice(0, 10)
        setDoc(doc(db, 'periods', periodId(1)), {
          nr: 1,
          start,
          eind: null,
          startAt: naarTimestamp(start),
          eindAt: null,
          perBak: 24,
          prijs: 1.5,
          bakPrijs: 30,
        })
      }
    })
    return onSnapshot(col, (snap) =>
      setPeriodes(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Period) })).sort((a, b) => a.nr - b.nr)),
    )
  }, [])

  return periodes
}

/** Afsluiten's confirm (TASK-10): one writeBatch that sets eind/eindAt on the
 *  closing period and creates period nr+1 with start = dagNa(eind), so ranges
 *  stay contiguous and the app is never left with two open periods or with
 *  none (AC3/AC7). No totals get frozen here anymore — amounts are derived
 *  from that period's own entries at that period's own prices (src/Betalen.tsx's
 *  useOwnEntries), which is why this no longer takes the entries ledger. What
 *  the old freeze protected against — a member deleting an old entry to
 *  shrink a settled bill — is now firestore.rules's binnenPeriode() check:
 *  an entry may only be written or deleted while its period is the active one. */
export const sluitPeriode = (
  period: Period,
  eind: string,
  nieuwePrijs: number,
  nieuweBakPrijs: number,
  byUid: string,
) => {
  const start = dagNa(eind)
  const batch = writeBatch(db)
  batch.set(
    doc(db, 'periods', periodId(period.nr)),
    { eind, eindAt: naarTimestamp(eind), closedBy: byUid, closedAt: serverTimestamp() },
    { merge: true },
  )
  batch.set(doc(db, 'periods', periodId(period.nr + 1)), {
    nr: period.nr + 1,
    start,
    startAt: naarTimestamp(start),
    eind: null,
    eindAt: null,
    perBak: period.perBak,
    prijs: nieuwePrijs,
    bakPrijs: nieuweBakPrijs,
  })
  return batch.commit()
}

export type BetalingStatus = 'open' | 'gemeld' | 'betaald'

/** periods/{pid}/betalingen/{personRef} (TASK-9's amendment): keyed by personRef,
 *  not uid, so a guest's payment is recordable too (by the drankleider, in the
 *  out-of-scope Inningen) — a member can only ever claim their own. No doc = open. */
export function useBetaling(pid: string, personRef: string) {
  const [status, setStatus] = useState<BetalingStatus>('open')

  useEffect(
    () =>
      onSnapshot(doc(db, 'periods', pid, 'betalingen', personRef), (snap) =>
        setStatus((snap.data()?.status as BetalingStatus | undefined) ?? 'open'),
      ),
    [pid, personRef],
  )

  return status
}

export const meldBetaling = (pid: string, personRef: string) =>
  setDoc(doc(db, 'periods', pid, 'betalingen', personRef), { status: 'gemeld', at: serverTimestamp() })

export const herroepBetaling = (pid: string, personRef: string) =>
  deleteDoc(doc(db, 'periods', pid, 'betalingen', personRef))

/** All of one period's betalingen at once (TASK-11's Inningen, the drankleider's
 *  reconcile screen) — one onSnapshot on the subcollection instead of one
 *  useBetaling per row. No doc = open, same convention as useBetaling above. */
export function useBetalingen(pid: string | undefined) {
  const [statussen, setStatussen] = useState<Map<string, BetalingStatus>>(new Map())

  useEffect(() => {
    if (!pid) return
    return onSnapshot(collection(db, 'periods', pid, 'betalingen'), (snap) =>
      setStatussen(new Map(snap.docs.map((d) => [d.id, (d.data().status as BetalingStatus) ?? 'open']))),
    )
  }, [pid])

  return statussen
}

/** The drankleider ticking someone off in Inningen — the only path that ever
 *  writes 'betaald' (firestore.rules:104-110). Reopening reuses herroepBetaling
 *  above (delete = open) for both a self-herroep and the drankleider's own. */
export const vinkAfBetaling = (pid: string, personRef: string, byUid: string) =>
  setDoc(doc(db, 'periods', pid, 'betalingen', personRef), { status: 'betaald', at: serverTimestamp(), by: byUid })

export type Rol = 'lid' | 'drankleider' | 'beheerder'

export type Group = { naam: string; iban: string; begunstigde: string }

const defaultGroup: Group = { naam: 'Chiro Elzestraat', iban: '', begunstigde: '' }

/** meta/group, seeded once and then just read, like usePeriodes above — except this
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
      // Spread over the default so an iban/begunstigde-less doc (every group
      // before TASK-9) still comes out with the empty strings Beheer/Betalen expect.
      if (data) setGroup({ ...defaultGroup, ...(data as Partial<Group>) })
    })
  }, [])

  return group
}

export const saveGroup = (patch: Partial<Group>) =>
  setDoc(doc(db, 'meta', 'group'), patch, { merge: true })

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

/** One person's own entries within one period — Betalen's derived amounts
 *  (TASK-10 AC5), read through `where`, which Firestore covers with the
 *  automatic single-field index (no composite index, no rules change), and a
 *  smaller read than the whole period's ledger. */
export function useOwnEntries(periodId: string | undefined, personRef: string) {
  const [entries, setEntries] = useState<(Entry & { id: string })[]>([])

  useEffect(() => {
    if (!periodId) return
    return onSnapshot(
      query(collection(db, 'periods', periodId, 'entries'), where('personRef', '==', personRef)),
      (snap) => setEntries(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Entry) }))),
    )
  }, [periodId, personRef])

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

/** Opens a prefilled mail draft addressed to the invitees: mailto: is the only
 *  channel that carries both a recipient and a subject (navigator.share drops
 *  both, TASK-7's share sheet pasted the title into the body). The invite doc
 *  already exists — sending stays the beheerder's own act, never a claim that
 *  the invitee was notified (TASK-7 AC4). */
export function shareInvite(emails: string[], groupNaam: string): void {
  const onderwerp = `Uitnodiging voor de streepjeslijst van ${groupNaam}`
  const aanmelden = emails.length === 1 ? `Google op ${emails[0]}` : 'Google op het adres waarop je deze mail kreeg'
  // Een mailto-body is altijd platte tekst — een echte <a> kan niet. De link
  // staat daarom alleen op zijn lijn, dan maakt elke mailclient er zelf een
  // klikbare link van.
  const tekst = `Dag!

Je bent uitgenodigd voor de streepjeslijst van ${groupNaam}.

${location.origin}

Meld je daar aan met ${aanmelden} — dan sta je meteen op de lijst.

Tot de volgende!`
  location.href = `mailto:${emails.map(encodeURIComponent).join(',')}?subject=${encodeURIComponent(onderwerp)}&body=${encodeURIComponent(tekst)}`
}
