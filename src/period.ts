// Pure aggregation over the append-only entry ledger. No Firestore here on
// purpose, so this is the one file that gets a test (src/period.test.ts).

import type { Period } from './data'

export type Entry = {
  personRef: string
  kind: 'streep' | 'bak'
  delta: number
}

export type Totals = Map<string, { streep: number; bak: number }>

export function totals(entries: Entry[]): Totals {
  const t: Totals = new Map()
  for (const e of entries) {
    const cur = t.get(e.personRef) ?? { streep: 0, bak: 0 }
    if (e.kind === 'streep') cur.streep += e.delta
    else cur.bak += e.delta
    t.set(e.personRef, cur)
  }
  return t
}

export function euroTotaal(t: Totals, prijs: number, bakPrijs: number): number {
  let sum = 0
  for (const { streep, bak } of t.values()) sum += streep * prijs + bak * bakPrijs
  return sum
}

/** One person's amount — euroTotaal's per-person twin, for Betalen (TASK-9).
 *  Always called with the frozen archive's own prijs/bakPrijs, never the live period's. */
export const bedrag = (t: { streep: number; bak: number }, prijs: number, bakPrijs: number) =>
  t.streep * prijs + t.bak * bakPrijs

/** '€' + design's bedragRuw: toFixed(2) with a comma, design line 881-882. */
export const euro = (v: number) => '€' + v.toFixed(2).replace('.', ',')

/** The group must never be left without a beheerder, so the last one cannot be demoted.
 *  Pure on purpose: the Beheer screen calls it before writing, and it gets a unit test. */
export const magRolWijzigen = (
  rollen: { id: string; role: string }[],
  id: string,
  nieuweRol: string,
) =>
  nieuweRol === 'beheerder' ||
  rollen.some((r) => r.role === 'beheerder' && r.id !== id)

/** A simple email-shape check, good enough to catch typos — not full RFC 5322.
 *  Firestore doesn't validate document ids for us, so this is what gates an
 *  invite (TASK-7's VOLK ERBIJ HALEN, AC2). */
export const geldigeMail = (mail: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)

/** 'dd/mm' from an ISO date, design's kort() (line 883-886). */
export const kort = (iso: string) => iso.slice(8) + '/' + iso.slice(5, 7)

/** The design's role hierarchy (line 1705's enkelAdmin, this task's AC1/AC8): a
 *  beheerder satisfies a drankleider-only destination too, a lid satisfies
 *  nothing above 'lid'. Pure so both Lijst.tsx's route guard and the rules it
 *  mirrors stay testable from one place. */
export const magRol = (mijn: string, nodig: string) => nodig === mijn || (nodig === 'drankleider' && mijn === 'beheerder')

/** Design's dagNa (line 1064: "12 juli" → "13 juli") over our ISO dates instead
 *  of Dutch month names, so periods still close seamlessly onto each other.
 *  UTC on purpose — a local-midnight Date shifts the day in a negative-offset zone. */
export const dagNa = (iso: string) => {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

/** The two documents Afsluiten's confirm writes in one batch (data.ts's sluitPeriode):
 *  the closed period's totals frozen at the prices it *ran* at (never the new ones —
 *  prices are real money), and the next period that opens right behind it so there is
 *  always a live lijst to streep on. */
export function afrekening(
  period: Pick<Period, 'nr' | 'start' | 'prijs' | 'bakPrijs' | 'perBak'>,
  entries: Entry[],
  eind: string,
  nieuwePrijs: number,
  nieuweBakPrijs: number,
) {
  const totalen: Record<string, { streep: number; bak: number }> = {}
  for (const [personRef, t] of totals(entries)) totalen[personRef] = t
  return {
    archief: {
      nr: period.nr,
      start: period.start,
      eind,
      prijs: period.prijs,
      bakPrijs: period.bakPrijs,
      perBak: period.perBak,
      totals: totalen,
    },
    volgende: {
      nr: period.nr + 1,
      start: dagNa(eind),
      eind: null,
      open: true,
      perBak: period.perBak,
      prijs: nieuwePrijs,
      bakPrijs: nieuweBakPrijs,
    },
  }
}

/** The payment reference shown under the nick input, design's mededeling() (line 888-891). */
export const mededeling = (nick: string, period: { nr: number; start: string; eind: string | null }) =>
  'STREEPJES P' + period.nr + ' ' + kort(period.start) + '-' + (period.eind ? kort(period.eind) : '') + ' ' + nick.toUpperCase()
