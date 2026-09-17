// Pure aggregation over the append-only entry ledger. No Firestore here on
// purpose, so this is the one file that gets a test (src/period.test.ts).

// at/by/byNick are optional: data.ts's writeEntry always sets them, but the
// existing totals()-only tests (period.test.ts, Afsluiten.test.tsx) build
// bare {personRef,kind,delta} literals that logboek() below never sees.
export type Entry = {
  personRef: string
  kind: 'streep' | 'bak'
  delta: number
  at?: Date
  by?: string
  byNick?: string
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

/** TASK-16: which "fuif day" a moment belongs to — the day boundary sits at
 *  06:00 local time, not midnight, so a party running from 23:50 to past
 *  midnight stays one entry under one day heading. Local time on purpose,
 *  like dagLabel above: this is a question about the clock in your hand, not
 *  a server's UTC clock. */
export const fuifDag = (at: Date): string => {
  const geschoven = new Date(at.getTime() - 6 * 60 * 60_000)
  const jaar = geschoven.getFullYear()
  const maand = String(geschoven.getMonth() + 1).padStart(2, '0')
  const dag = String(geschoven.getDate()).padStart(2, '0')
  return `${jaar}-${maand}-${dag}`
}

/** TASK-15: predictable notification doc id for "voor jou gestreept" — same
 *  fuif-day boundary as the Logboek (fuifDag above), plus the streper's own
 *  uid, so a second tap the same evening by the same person lands on the
 *  same doc id instead of a fresh one. data.ts's writeEntry setDoc()s this
 *  id; the second write hits an existing doc and firestore.rules' `allow
 *  update: if false` denies it — that denial IS the dedup (AC4/AC9), no
 *  aggregation code needed. */
export const meldingId = (byUid: string, at: Date): string => 'voor-jou-' + fuifDag(at) + '-' + byUid

export type LogboekRegel = {
  uur: number
  by: string
  byNick: string
  kind: 'streep' | 'bak'
  /** signed sum of the merged entries' deltas */
  n: number
  keer: number
}

export type LogboekDag = {
  dag: string
  netto: number
  bakken: number
  regels: LogboekRegel[]
}

/** TASK-16: one person's own entries, grouped per fuif-day (newest first) and
 *  merged per hour/streper/soort within a day (AC4). The sign of the delta is
 *  part of the merge key — otherwise a streep and a schrapping in the same
 *  hour would cancel into one meaningless row instead of staying two rows.
 *  No colours, no labels, no copy here: those live in Logboek.tsx, this
 *  function only hands back numbers and keys. */
export function logboek(entries: Entry[], personRef: string): LogboekDag[] {
  const eigen = entries.filter((e) => e.personRef === personRef)

  const perDag = new Map<string, Entry[]>()
  for (const e of eigen) {
    const dag = fuifDag(e.at ?? new Date())
    perDag.set(dag, [...(perDag.get(dag) ?? []), e])
  }

  return [...perDag.entries()]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([dag, es]) => {
      const perUur = new Map<string, LogboekRegel>()
      for (const e of es) {
        const uur = (e.at ?? new Date()).getHours()
        const teken = Math.sign(e.delta)
        const key = `${uur}|${e.by ?? ''}|${e.kind}|${teken}`
        const regel = perUur.get(key) ?? { uur, by: e.by ?? '', byNick: e.byNick ?? '?', kind: e.kind, n: 0, keer: 0 }
        regel.n += e.delta
        regel.keer += 1
        perUur.set(key, regel)
      }
      return {
        dag,
        netto: es.filter((e) => e.kind === 'streep').reduce((a, e) => a + e.delta, 0),
        bakken: es.filter((e) => e.kind === 'bak').reduce((a, e) => a + e.delta, 0),
        regels: [...perUur.values()].sort((a, b) => b.uur - a.uur),
      }
    })
}

/** The payment reference shown under the nick input, design's mededeling() (line 888-891). */
export const mededeling = (nick: string, period: { nr: number; start: string; eind: string | null }) =>
  'STREEPJES P' + period.nr + ' ' + kort(period.start) + '-' + (period.eind ? kort(period.eind) : '') + ' ' + nick.toUpperCase()
