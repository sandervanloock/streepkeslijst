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

/** '€' + design's bedragRuw: toFixed(2) with a comma, design line 881-882. */
export const euro = (v: number) => '€' + v.toFixed(2).replace('.', ',')
