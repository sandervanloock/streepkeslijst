// Pure aggregation over the append-only entry ledger. No Firestore here on
// purpose, so this is the one file that gets a test (src/period.test.ts).

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

/** TASK-10: which period is active is derived from today's date, never read
 *  off a stored flag — the bug this fixes is closing a period with an end
 *  date in the future flipping the whole app to the next period immediately.
 *  data.ts's sluitPeriode always writes start(n+1) = dagNa(eind(n)) in the
 *  same batch as setting eind(n), so ranges are contiguous and non-overlapping
 *  by construction: exactly one period matches on any date (AC2) falls out of
 *  the data rather than needing a separate check. Tested at the three
 *  boundaries that matter (AC8): the start day, the end day, the day after. */
export function actievePeriode<T extends { start: string; eind: string | null }>(
  periodes: T[],
  vandaag: string,
): T | undefined {
  return periodes.find((p) => p.start <= vandaag && (p.eind == null || vandaag <= p.eind))
}

/** TASK-13: which day-bucket a moment falls in relative to "now" — pure so the
 *  Meldingen screen's group headers (VANDAAG/GISTEREN/EERDER) and its per-item
 *  relative time run off the same three states, testable without rendering
 *  anything. Lokale tijd, niet UTC zoals dagNa hierboven: dagNa rekent met
 *  kale datums die overal dezelfde dag moeten opleveren, maar "is dit vandaag"
 *  is een vraag over de klok van de telefoon in je hand — in de zomer zit
 *  België twee uur voor op UTC, en dan zou alles na 22:00 als "gisteren" lezen. */
export function dagLabel(at: Date, nu: Date): 'vandaag' | 'gisteren' | 'eerder' {
  if (at.toDateString() === nu.toDateString()) return 'vandaag'
  const gisteren = new Date(nu)
  gisteren.setDate(gisteren.getDate() - 1)
  return at.toDateString() === gisteren.toDateString() ? 'gisteren' : 'eerder'
}

/** The payment reference shown under the nick input, design's mededeling() (line 888-891). */
export const mededeling = (nick: string, period: { nr: number; start: string; eind: string | null }) =>
  'STREEPJES P' + period.nr + ' ' + kort(period.start) + '-' + (period.eind ? kort(period.eind) : '') + ' ' + nick.toUpperCase()
