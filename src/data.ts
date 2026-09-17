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
import { dagNa, meldingId } from './period'
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
/** TASK-13: one "period-closed" notification per non-guest member, in the same
 *  batch as the close itself — no period without notifications, no notifications
 *  without a closed period. `at` is `dagNa(eind)`, not `serverTimestamp()`: the
 *  period isn't done being streeped on until that day (binnenPeriode() above),
 *  and Betalen doesn't show the bill until then either (Betalen.tsx:193), so a
 *  melding visible at the click would be lying about both. Everyone gets one,
 *  not just who is currently open — someone at €0 today can still streep before
 *  the last day. No amount in the text (AC8): the bill stays derived on Betalen.
 *  ponytail: one write per member in a single batch, capped at Firestore's 500 —
 *  no risk at this app's one-Chiro-group scale, revisit in chunks if that changes. */
export const sluitPeriode = (
  period: Period,
  eind: string,
  nieuwePrijs: number,
  nieuweBakPrijs: number,
  byUid: string,
  ontvangers: string[],
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
  for (const uid of ontvangers) {
    batch.set(doc(collection(db, 'users', uid, 'notifications')), {
      kind: 'period-closed',
      text: `Periode ${period.nr} is afgesloten. Je kan nu overschrijven.`,
      meta: 'Op de rekening van de groep · je bedrag staat klaar op Betalen',
      at: naarTimestamp(start),
      action: { label: 'Naar je betaling', screen: 'Betalen' },
    })
  }
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

// TASK-16: `at` is a serverTimestamp() (data.ts's writeEntry) — still `null`
// locally until the server confirms it, and then "now" is exactly right for
// a moment that's ordering a logboek row, not a stored historical instant.
const naarEntry = (d: { id: string; data: () => Record<string, unknown> }): Entry & { id: string } => {
  const data = d.data() as Entry & { at?: { toDate: () => Date } | null }
  return { id: d.id, ...data, at: data.at?.toDate() ?? new Date() }
}

export function useEntries(periodId: string | undefined) {
  const [entries, setEntries] = useState<(Entry & { id: string })[]>([])

  useEffect(() => {
    if (!periodId) return
    return onSnapshot(collection(db, 'periods', periodId, 'entries'), (snap) =>
      setEntries(snap.docs.map(naarEntry)),
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
      (snap) => setEntries(snap.docs.map(naarEntry)),
    )
  }, [periodId, personRef])

  return entries
}

// TASK-15: the fixed sentence firestore.rules checks byte-for-byte (a member
// may only ever create this one, unchangeable text for themselves — see the
// rules comment). No amount in either string on purpose: the melding is
// stored, not derived, so a count would freeze a number that a next tap or
// an undo can still change. The exact count and moment live in Mijn logboek,
// which is why the action button points there instead.
const VOOR_JOU_MELDING_META = 'Aantal en tijdstip staan in je logboek.'

// In-memory only (AC9): caps a chatty session at one attempted write per
// streper per ontvanger per avond instead of one per tap. A new tab/reload
// starts a fresh Set, so at most one more write is attempted then — still
// denied by the rules' dedup, never a second visible melding.
const gemeldeVoorJou = new Set<string>()

const writeEntry = (
  periodId: string,
  personRef: string,
  kind: 'streep' | 'bak',
  delta: number,
  byUid: string,
  byNick: string,
) => {
  const entry = addDoc(collection(db, 'periods', periodId, 'entries'), {
    personRef,
    kind,
    delta,
    by: byUid,
    byNick,
    at: serverTimestamp(),
  })

  // AC5: nooit een melding over je eigen naam. Alleen 'user:'-refs hebben een
  // feed — een gast heeft geen users/{uid} doc om er een in te schrijven.
  if (personRef !== 'user:' + byUid && personRef.startsWith('user:')) {
    const uid = personRef.slice('user:'.length)
    const id = meldingId(byUid, new Date())
    // Sleutel = ontvanger + id, niet id alleen: id bevat enkel de streper en de
    // dag, dus zonder de ontvanger erbij zou strepen voor Fien de melding voor
    // Wollie diezelfde avond blokkeren (twee verschillende ontvangers, AC1/AC4).
    const sleutel = uid + '-' + id
    if (!gemeldeVoorJou.has(sleutel)) {
      gemeldeVoorJou.add(sleutel)
      setDoc(doc(db, 'users', uid, 'notifications', id), {
        kind: 'voor-jou',
        text: `${byNick} zette streepjes op jouw naam`,
        meta: VOOR_JOU_MELDING_META,
        at: serverTimestamp(),
        action: { label: 'Naar mijn logboek', screen: 'Mijn logboek' },
      }).catch(() => {
        // De tweede tik van dezelfde persoon op dezelfde avond botst op
        // hetzelfde document-id; firestore.rules' `allow update: if false`
        // weigert die, en dat IS de dedup (AC4) — geen aggregatie-code.
      })
    }
  }

  return entry
}

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

/** users/{uid}, live: the extra fields (mail) that Person/usePeople doesn't carry (TASK-5),
 *  plus `rondje` (TASK-12): has this person had the Welkomstrondje, default false so every
 *  user document written before this task still gates the round on first read. `readAt`
 *  (TASK-13) is undefined for anyone who never opened Meldingen — undefined reads as
 *  "everything is unread", same convention as `rondje: false`. */
export function useProfile(uid: string) {
  const [profile, setProfile] = useState<{ nick: string; naam: string; mail: string; rondje: boolean; readAt: Date | undefined }>()

  useEffect(
    () =>
      onSnapshot(doc(db, 'users', uid), (snap) => {
        const data = snap.data()
        setProfile({
          nick: data?.nick ?? '',
          naam: data?.name ?? '',
          mail: data?.mail ?? '',
          rondje: data?.rondje ?? false,
          readAt: (data?.readAt as Timestamp | undefined)?.toDate(),
        })
      }),
    [uid],
  )

  return profile
}

/** Set both by finishing the Welkomstrondje and by skipping it — skipping is a
 *  decision, not a postponement, so it gates the round exactly like finishing does. */
export const markRondje = (uid: string) => setDoc(doc(db, 'users', uid), { rondje: true }, { merge: true })

/** The payout address is `mail`, deliberately not `email`: `email` is the Google account
 *  identity that userDoc() refreshes on every login, so storing a hand-picked address
 *  there would be undone at the next sign-in — the same trap the nick was in. Guests
 *  already use `mail` for their afrekening address (addGuest). */
export const saveProfile = (uid: string, nick: string, naam: string, mail: string) =>
  setDoc(doc(db, 'users', uid), { nick, name: naam, mail }, { merge: true })

/** TASK-13: a plain in-memory shape, read off a Firestore doc by useMeldingen
 *  below. TASK-15's "voor jou gestreept" meldingen are documents too (kind
 *  'voor-jou', written by writeEntry above) — not derived from the entry
 *  ledger — so they fall out of the same onSnapshot, no separate merge. */
export type Melding = {
  id: string
  kind: string
  text: string
  meta: string
  at: Date
  action?: { label: string; screen: string }
}

/** users/{uid}/notifications, live. `at` can be in the future (sluitPeriode's
 *  fanout plans a period-closed melding for dagNa(eind)), so filtering on
 *  `at <= nu` happens here, once, rather than trusting every future writer to
 *  add its own visibility field. ponytail: filtered/sorted in JS, not in the
 *  query — a few tens of docs at this app's scale, and it skips a composite index. */
export function useMeldingen(uid: string) {
  const [meldingen, setMeldingen] = useState<Melding[]>([])

  useEffect(
    () =>
      onSnapshot(collection(db, 'users', uid, 'notifications'), (snap) => {
        const nu = new Date()
        setMeldingen(
          snap.docs
            .map((d) => {
              const data = d.data()
              return {
                id: d.id,
                kind: data.kind as string,
                text: data.text as string,
                meta: data.meta as string,
                at: (data.at as Timestamp).toDate(),
                action: data.action as { label: string; screen: string } | undefined,
              }
            })
            .filter((m) => m.at <= nu)
            .sort((a, b) => b.at.getTime() - a.at.getTime()),
        )
      },
      // Een geweigerde listen gooit anders een onafgehandelde fout in de
      // console en niets meer — precies hoe een nog niet gedeployde
      // rules-wijziging eruitziet (zie useGroup's comment hierboven). Meldingen
      // zijn niet het soort data waar de app op mag blijven hangen: een lege
      // feed is de juiste terugval, de rest van de lijst hoort te blijven werken.
      () => setMeldingen([]),
    ),
    [uid],
  )

  return meldingen
}

/** Meldingen openen (of "alles gelezen" tikken) zet dit ene tijdstempel — geen
 *  gelezen-bit per document, zie firestore.rules: een melding is read-only
 *  voor de ontvanger, en een afgeleide melding (TASK-15) heeft toch geen doc
 *  om zo'n bit op te zetten. */
export const markGelezen = (uid: string) => setDoc(doc(db, 'users', uid), { readAt: serverTimestamp() }, { merge: true })

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
