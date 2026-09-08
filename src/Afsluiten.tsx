import { useState } from 'react'
import type { User } from 'firebase/auth'
import { sluitPeriode } from './data'
import type { Period, Person } from './data'
import { dagNa, euro, euroTotaal, totals } from './period'
import type { Entry } from './period'

// Ported from design/"Streepkeslijst App.dc.html", the betalingenOpen block
// (lines 145-172) plus the three-step wizard (620-710), Dutch copy verbatim.
// The heading ("Periode afsluiten") and the DRANKLEIDER badge belong to the
// shared header row in Lijst.tsx, so this component starts at the subtitle.
// Out of scope (design line 650): afsluiten sends nothing — Inningen, the
// screen the design lands on afterwards, is still a stub (TASK-3), so
// onKlaar sends the user back to the lijst instead, which by then already
// shows the freshly-opened next period.
const paper = '#F4F1E6'
const lime = '#D8F651'
const amber = '#F0A32B'
const red = '#E4483A'

const kopje = { font: '400 9.5px ui-monospace,monospace', letterSpacing: '.14em', color: 'rgba(244,241,230,.4)' } as const
const kaart = { borderRadius: 12, background: '#1B1D17', border: '1px solid rgba(244,241,230,.12)' } as const
const stepKnop = {
  width: 52,
  height: 52,
  borderRadius: 99,
  border: '1px solid rgba(244,241,230,.2)',
  display: 'grid',
  placeItems: 'center',
  font: '400 26px/1 Anton,sans-serif',
  color: paper,
  cursor: 'pointer',
  flex: 'none',
} as const

export function Afsluiten({
  user,
  period,
  entries,
  people,
  myRole,
  onToast,
  onKlaar,
}: {
  user: User
  period: Period
  entries: Entry[]
  people: Person[]
  myRole: string
  onToast: (tekst: string) => void
  onKlaar: () => void
}) {
  // 0 = the overview; 1|2|3 = the wizard's three steps.
  const [stap, setStap] = useState<0 | 1 | 2 | 3>(0)
  const [eind, setEind] = useState(() => {
    const vandaag = new Date().toISOString().slice(0, 10)
    return vandaag > period.start ? vandaag : period.start
  })
  const [prijs, setPrijs] = useState(period.prijs)
  const [bakPrijs, setBakPrijs] = useState(period.bakPrijs)

  // A hand-typed route must not reach this screen either, not just the menu item.
  if (myRole !== 'drankleider' && myRole !== 'beheerder') return null

  const leiders = people.filter((p) => !p.isGuest).length
  const tot = totals(entries)
  const totStreep = [...tot.values()].reduce((a, v) => a + v.streep, 0)
  const totBak = [...tot.values()].reduce((a, v) => a + v.bak, 0)
  const totStreepjes = totStreep + totBak * period.perBak
  const totEuro = euroTotaal(tot, period.prijs, period.bakPrijs)

  const startWizard = () => {
    setEind((e) => (e < period.start ? period.start : e))
    setPrijs(period.prijs)
    setBakPrijs(period.bakPrijs)
    setStap(1)
  }

  const terug = () => setStap((s) => (s > 1 ? ((s - 1) as 1 | 2) : 0))
  const verder = async () => {
    if (stap < 3) {
      setStap((s) => (s + 1) as 2 | 3)
      return
    }
    await sluitPeriode(period, entries, eind, prijs, bakPrijs, user.uid)
    onToast(`Periode ${period.nr} afgesloten · iedereen ziet zijn bedrag onder Betalen`)
    onKlaar()
  }

  if (stap === 0) {
    return (
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        <div style={{ font: '400 11.5px/1.5 "Space Grotesk",sans-serif', color: 'rgba(244,241,230,.5)', marginTop: 7 }}>
          Kies de laatste dag van de lopende periode. Prijzen en bevestiging volgen in drie stappen; berichten stuur je nadien vanuit Inningen.
        </div>

        <div style={{ ...kopje, padding: '20px 0 6px' }}>DE LOPENDE PERIODE</div>
        <div style={{ ...kaart, padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <span style={{ background: lime, color: '#121310', font: '400 11px/1 Anton,sans-serif', letterSpacing: '.06em', padding: '5px 7px', borderRadius: 3 }}>LIVE</span>
            <span style={{ font: '400 16px/1 Anton,sans-serif', color: paper, textTransform: 'uppercase' }}>
              Periode {period.nr} · {period.start} → {period.eind || 'nog open'}
            </span>
          </div>

          <div style={{ display: 'flex', gap: 1, marginTop: 14, background: 'rgba(244,241,230,.1)', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ flex: 1, padding: '9px 10px', background: 'rgba(244,241,230,.04)' }}>
              <div data-stat="streepjes" style={{ font: '400 20px/1 Anton,sans-serif', color: paper }}>{totStreepjes}</div>
              <div style={{ font: '500 9px "Space Grotesk",sans-serif', letterSpacing: '.08em', color: 'rgba(244,241,230,.45)', marginTop: 4 }}>STREEPJES</div>
            </div>
            <div style={{ flex: 1, padding: '9px 10px', background: 'rgba(244,241,230,.04)' }}>
              <div data-stat="leiders" style={{ font: '400 20px/1 Anton,sans-serif', color: paper }}>{leiders}</div>
              <div style={{ font: '500 9px "Space Grotesk",sans-serif', letterSpacing: '.08em', color: 'rgba(244,241,230,.45)', marginTop: 4 }}>LEIDERS</div>
            </div>
            <div style={{ flex: 1, padding: '9px 10px', background: 'rgba(244,241,230,.04)' }}>
              <div data-stat="euro" style={{ font: '400 20px/1 Anton,sans-serif', color: lime }}>{euro(totEuro)}</div>
              <div style={{ font: '500 9px "Space Grotesk",sans-serif', letterSpacing: '.08em', color: 'rgba(244,241,230,.45)', marginTop: 4 }}>TE VERDELEN</div>
            </div>
          </div>

          <div
            onClick={startWizard}
            style={{ marginTop: 14, padding: 15, borderRadius: 9, background: 'rgba(228,72,58,.14)', border: `1px solid ${red}`, color: red, textAlign: 'center', font: '400 15px/1 Anton,sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer' }}
          >
            Afsluiten
          </div>
        </div>
      </div>
    )
  }

  const checklist = [
    {
      nr: '1',
      titel: `Periode ${period.nr} sluit`,
      tint: 'rgba(228,72,58,.18)',
      kleur: red,
      detail: `Laatste dag ${eind}. ${totStreepjes} streepjes over ${leiders} leiders worden vastgezet — niemand kan er nog strepen of schrappen.`,
    },
    {
      nr: '2',
      titel: 'Iedereen ziet zijn bedrag',
      tint: 'rgba(240,163,43,.18)',
      kleur: amber,
      detail: `Samen ${euro(totEuro)} aan ${euro(period.prijs)} per streepje en ${euro(period.bakPrijs)} per bak. Het bedrag komt bij ieder op "Betalen" te staan.`,
    },
    {
      nr: '3',
      titel: 'Nog geen berichten',
      tint: 'rgba(244,241,230,.1)',
      kleur: paper,
      detail: `Afsluiten stuurt niets. Vanaf ${dagNa(eind)} staat het bericht klaar bij periode ${period.nr} in Inningen — mailen of delen kies je daar.`,
    },
    {
      nr: '4',
      titel: `Periode ${period.nr + 1} start`,
      tint: 'rgba(216,246,81,.18)',
      kleur: lime,
      detail: `Op ${dagNa(eind)}, met ${euro(prijs)} per streepje en ${euro(bakPrijs)} per bak van ${period.perBak}. Nog geen einddatum.`,
    },
    {
      nr: '5',
      titel: 'Wie er op staat',
      tint: 'rgba(244,241,230,.1)',
      kleur: paper,
      detail: `${leiders} vaste leiders gaan mee naar periode ${period.nr + 1}`,
    },
  ]

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
      <div style={{ marginTop: 7 }}>
        <div style={kopje}>STAP {stap} VAN 3</div>
        <div style={{ font: '400 17px/1 Anton,sans-serif', color: paper, textTransform: 'uppercase', margin: '5px 0 12px' }}>
          {stap === 1 ? 'Einddatum' : stap === 2 ? 'Prijzen' : 'Bevestigen'}
        </div>
        <div style={{ display: 'flex', gap: 5 }}>
          {[1, 2, 3].map((n) => (
            <div key={n} style={{ flex: 1, height: 4, borderRadius: 99, background: n <= stap ? lime : 'rgba(244,241,230,.14)' }} />
          ))}
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 0' }}>
        {stap === 1 && (
          <>
            <div style={{ ...kaart, padding: 15, marginBottom: 14 }}>
              <div style={kopje}>LAATSTE DAG VAN PERIODE {period.nr}</div>
              <input
                type="date"
                value={eind}
                min={period.start}
                onChange={(e) => setEind(e.target.value < period.start ? period.start : e.target.value)}
                style={{ width: '100%', marginTop: 6, background: 'transparent', border: 'none', outline: 'none', color: paper, font: '400 26px/1.15 Anton,sans-serif', textTransform: 'uppercase', colorScheme: 'dark' }}
              />
            </div>
            <div style={{ ...kaart, padding: 15 }}>
              <div style={{ font: '400 14px/1 Anton,sans-serif', color: paper, textTransform: 'uppercase' }}>Berichten komen later</div>
              <div style={{ font: '400 10.5px/1.55 "Space Grotesk",sans-serif', color: 'rgba(244,241,230,.5)', marginTop: 7 }}>
                Afsluiten stuurt niets. Zodra de laatste dag voorbij is, staat het bericht klaar bij de periode in Inningen — mailen naar ieder apart of één bericht delen in de groep.
              </div>
            </div>
          </>
        )}

        {stap === 2 && (
          <div style={{ ...kaart, padding: 16 }}>
            <div style={kopje}>PRIJS VAN ÉÉN STREEPJE VANAF PERIODE {period.nr + 1}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 12 }}>
              <div onClick={() => setPrijs((p) => Math.max(0, Math.round((p - 0.05) * 100) / 100))} style={stepKnop}>–</div>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ font: '400 40px/1 Anton,sans-serif', color: lime }}>{euro(prijs)}</div>
                <div style={{ font: '500 10px "Space Grotesk",sans-serif', letterSpacing: '.1em', color: 'rgba(244,241,230,.45)', marginTop: 5 }}>PER STREEPJE</div>
              </div>
              <div onClick={() => setPrijs((p) => Math.round((p + 0.05) * 100) / 100)} style={stepKnop}>+</div>
            </div>
            <div style={{ height: 1, background: 'rgba(244,241,230,.12)', margin: '16px 0' }} />
            <div style={kopje}>PRIJS VAN ÉÉN BAK</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 12 }}>
              <div onClick={() => setBakPrijs((p) => Math.max(0, Math.round((p - 1) * 100) / 100))} style={stepKnop}>–</div>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ font: '400 40px/1 Anton,sans-serif', color: lime }}>{euro(bakPrijs)}</div>
                <div style={{ font: '500 10px "Space Grotesk",sans-serif', letterSpacing: '.1em', color: 'rgba(244,241,230,.45)', marginTop: 5 }}>PER BAK VAN {period.perBak} STREEPJES</div>
              </div>
              <div onClick={() => setBakPrijs((p) => Math.round((p + 1) * 100) / 100)} style={stepKnop}>+</div>
            </div>
            <div style={{ marginTop: 16, padding: '12px 13px', borderRadius: 10, background: 'rgba(216,246,81,.1)', border: '1px solid rgba(216,246,81,.35)' }}>
              <div style={{ font: '400 18px/1.2 Anton,sans-serif', color: lime }}>Een bak komt op {euro(period.perBak ? bakPrijs / period.perBak : 0)} per streepje</div>
              <div style={{ font: '400 10.5px/1.5 "Space Grotesk",sans-serif', color: 'rgba(244,241,230,.6)', marginTop: 6 }}>
                Een bak is altijd {period.perBak} streepjes — dat staat vast. Wie een hele bak neemt, betaalt de bakprijs; losse streepjes gaan per stuk.
              </div>
            </div>
            <div style={{ font: '400 10.5px/1.5 "Space Grotesk",sans-serif', color: 'rgba(244,241,230,.42)', marginTop: 12 }}>
              {prijs === period.prijs && bakPrijs === period.bakPrijs
                ? 'Zelfde prijzen als de lopende periode — niets verandert voor de leiders.'
                : `Nu: ${euro(period.prijs)} per streepje · ${euro(period.bakPrijs)} per bak. Vanaf periode ${period.nr + 1}: ${euro(prijs)} · ${euro(bakPrijs)}.`}
            </div>
          </div>
        )}

        {stap === 3 && (
          <div style={{ ...kaart, padding: '6px 16px 16px' }}>
            {checklist.map((c) => (
              <div key={c.nr} style={{ display: 'flex', gap: 12, padding: '13px 0', borderBottom: '1px solid rgba(244,241,230,.08)' }}>
                <div style={{ flex: 'none', width: 26, height: 26, borderRadius: 99, background: c.tint, color: c.kleur, font: '400 12px/26px Anton,sans-serif', textAlign: 'center', marginTop: 1 }}>{c.nr}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ font: '400 14px/1.1 Anton,sans-serif', color: paper, textTransform: 'uppercase' }}>{c.titel}</div>
                  <div style={{ font: '400 10.5px/1.5 "Space Grotesk",sans-serif', color: 'rgba(244,241,230,.55)', marginTop: 5 }}>{c.detail}</div>
                </div>
              </div>
            ))}
            <div style={{ font: '400 10.5px/1.5 "Space Grotesk",sans-serif', color: 'rgba(240,163,43,.9)', marginTop: 14 }}>Afsluiten kan niet ongedaan gemaakt worden.</div>
          </div>
        )}
      </div>

      <div style={{ flex: 'none', display: 'flex', gap: 8, padding: '12px 0 0', borderTop: '1px solid rgba(244,241,230,.1)' }}>
        <div
          onClick={terug}
          style={{ flex: 'none', padding: '15px 18px', borderRadius: 9, border: '1px solid rgba(244,241,230,.2)', font: '500 12px "Space Grotesk",sans-serif', color: 'rgba(244,241,230,.7)', cursor: 'pointer' }}
        >
          {stap === 1 ? 'Stoppen' : 'Terug'}
        </div>
        <div
          onClick={verder}
          style={{ flex: 1, padding: 15, borderRadius: 9, background: stap === 3 ? red : lime, color: stap === 3 ? '#fff' : '#121310', textAlign: 'center', font: '400 15px/1 Anton,sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer' }}
        >
          {stap === 3 ? 'Afsluiten en nieuwe starten' : 'Verder'}
        </div>
      </div>
    </div>
  )
}
