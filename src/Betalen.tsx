import { useState } from 'react'
import type { User } from 'firebase/auth'
import { herroepBetaling, meldBetaling, useBetaling, useOwnEntries } from './data'
import type { Group, Period, Person } from './data'
import { bedrag, euro, mededeling, totals } from './period'

// Ported from design/"Streepkeslijst App.dc.html", the betalenOpen block
// (markup lines 309-392, state/logic lines 1546-1592), Dutch copy verbatim.
// The heading and menu chip belong to the shared header row in Lijst.tsx, so
// this component starts at the subtitle, same as Profiel/Beheer.
// TASK-9's amendment: the design keeps payment status in one flat s.p6[id]
// map keyed by uid; ours is keyed by personRef (periods/{pid}/betalingen/{personRef})
// so a guest's payment is recordable too (by the drankleider, in Inningen) — see
// data.ts's useBetaling/meldBetaling/herroepBetaling and firestore.rules.
// TASK-10's amendment: there is no frozen archive anymore. A period is only
// offered for payment once its eind has passed (AC6), and its amount is
// derived from that period's own entries at that period's own prijs/bakPrijs
// (data.ts's useOwnEntries), never from a totals field.
const paper = '#F4F1E6'
const lime = '#D8F651'
const amber = '#F0A32B'
const red = '#E4483A'

const kopje = { font: '400 9.5px ui-monospace,monospace', letterSpacing: '.16em', color: 'rgba(244,241,230,.38)' } as const

type Veld = { key: 'bedrag' | 'iban' | 'ref'; label: string; waarde: string; kopie: string }

/** The open card + its three copy fields + meld/herroep, for the most recent payable period. */
function HuidigeBetaling({
  period,
  personRef,
  nick,
  group,
  onToast,
}: {
  period: Period & { id: string }
  personRef: string
  nick: string
  group: Group
  onToast: (tekst: string) => void
}) {
  const status = useBetaling(period.id, personRef)
  const entries = useOwnEntries(period.id, personRef)
  const [gekopieerd, setGekopieerd] = useState<Veld['key']>()

  if (status === 'betaald') {
    return (
      <div style={{ margin: '20px 14px 0', borderRadius: 12, background: 'rgba(216,246,81,.1)', border: '1px solid rgba(216,246,81,.35)', padding: 16 }}>
        <div style={{ font: '400 22px/1 Anton,sans-serif', color: lime, textTransform: 'uppercase' }}>Niets openstaand</div>
        <div style={{ font: '400 11px/1.5 "Space Grotesk",sans-serif', color: 'rgba(244,241,230,.6)', marginTop: 6 }}>
          Periode {period.nr} staat afgevinkt.
        </div>
      </div>
    )
  }

  const t = totals(entries).get(personRef) ?? { streep: 0, bak: 0 }
  const bedragVoorMij = bedrag(t, period.prijs, period.bakPrijs)
  const gemeld = status === 'gemeld'

  const velden: Veld[] = [
    { key: 'bedrag', label: 'BEDRAG', waarde: euro(bedragVoorMij), kopie: bedragVoorMij.toFixed(2) },
    { key: 'iban', label: 'REKENINGNUMMER · ' + group.begunstigde.toUpperCase(), waarde: group.iban, kopie: group.iban.replace(/\s/g, '') },
    { key: 'ref', label: 'MEDEDELING', waarde: mededeling(nick, period), kopie: mededeling(nick, period) },
  ]

  const kopieer = async (v: Veld) => {
    await navigator.clipboard.writeText(v.kopie)
    setGekopieerd(v.key)
  }

  const meldBetaald = async () => {
    await meldBetaling(period.id, personRef)
    onToast('Doorgegeven aan de drankleider')
  }

  const herroep = async () => {
    await herroepBetaling(period.id, personRef)
    onToast('Terug op openstaand gezet')
  }

  return (
    <>
      <div style={{ padding: '20px 18px 6px', ...kopje }}>NOG OVER TE SCHRIJVEN</div>
      <div style={{ margin: '0 14px', borderRadius: 12, background: '#1B1D17', border: `1px solid ${gemeld ? 'rgba(240,163,43,.5)' : 'rgba(228,72,58,.45)'}`, padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <span
            style={{
              background: gemeld ? amber : red,
              color: gemeld ? '#121310' : '#fff',
              font: '400 11px/1 Anton,sans-serif',
              letterSpacing: '.06em',
              padding: '5px 7px',
              borderRadius: 3,
            }}
          >
            {gemeld ? 'DOORGEGEVEN' : 'TE BETALEN'}
          </span>
          <span style={{ font: '400 10px ui-monospace,monospace', color: 'rgba(244,241,230,.45)', marginLeft: 'auto' }}>
            {`PERIODE ${period.nr} · ${period.start} → ${period.eind}`.toUpperCase()}
          </span>
        </div>
        <div style={{ font: '400 46px/1 Anton,sans-serif', color: paper, marginTop: 13 }}>{euro(bedragVoorMij)}</div>
        <div style={{ font: '400 11px/1.5 "Space Grotesk",sans-serif', color: 'rgba(244,241,230,.5)', marginTop: 6 }}>
          {t.streep} streepjes · {euro(period.prijs)} per streepje
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 15 }}>
          {velden.map((v) => {
            const aan = gekopieerd === v.key
            return (
              <div
                key={v.key}
                onClick={() => kopieer(v)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 12px', borderRadius: 10, background: 'rgba(244,241,230,.06)', border: `1px solid ${aan ? lime : 'rgba(244,241,230,.12)'}`, cursor: 'pointer' }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ font: '400 9.5px ui-monospace,monospace', letterSpacing: '.14em', color: 'rgba(244,241,230,.4)' }}>{v.label}</div>
                  <div style={{ font: '500 15.5px/1.3 "Space Grotesk",sans-serif', color: paper, marginTop: 5, overflowWrap: 'anywhere' }}>{v.waarde}</div>
                </div>
                <div style={{ flex: 'none', padding: '9px 11px', borderRadius: 8, background: aan ? lime : 'transparent', color: aan ? '#121310' : 'rgba(244,241,230,.7)', border: `1px solid ${aan ? lime : 'rgba(244,241,230,.22)'}`, font: '500 10.5px "Space Grotesk",sans-serif' }}>
                  {aan ? 'gekopieerd' : 'kopieer'}
                </div>
              </div>
            )
          })}
        </div>

        {!gemeld && (
          <div
            onClick={meldBetaald}
            style={{ marginTop: 15, padding: 15, borderRadius: 10, background: lime, color: '#121310', textAlign: 'center', font: '400 17px/1 Anton,sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer' }}
          >
            Ik heb overgeschreven
          </div>
        )}

        {gemeld && (
          <div style={{ marginTop: 15, padding: '12px 13px', borderRadius: 10, background: 'rgba(240,163,43,.14)', border: '1px solid rgba(240,163,43,.5)' }}>
            <div style={{ font: '400 13px/1 Anton,sans-serif', letterSpacing: '.04em', color: amber, textTransform: 'uppercase' }}>Doorgegeven</div>
            <div style={{ font: '400 10.5px/1.5 "Space Grotesk",sans-serif', color: 'rgba(244,241,230,.6)', marginTop: 5 }}>Wacht op de controle van de drankleider.</div>
            <div onClick={herroep} style={{ marginTop: 9, font: '500 10.5px "Space Grotesk",sans-serif', color: amber, cursor: 'pointer', textDecoration: 'underline' }}>
              toch nog niet betaald
            </div>
          </div>
        )}
      </div>
    </>
  )
}

/** One row of EERDERE PERIODES: same status doc, read-only here (Inningen ticks it off). */
function HistoriekRij({ period, personRef }: { period: Period & { id: string }; personRef: string }) {
  const status = useBetaling(period.id, personRef)
  const entries = useOwnEntries(period.id, personRef)
  const t = totals(entries).get(personRef) ?? { streep: 0, bak: 0 }
  const betaald = status === 'betaald'

  return (
    <div style={{ background: '#161811', padding: '13px 18px', display: 'flex', alignItems: 'center', gap: 11 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ font: '400 16px/1 Anton,sans-serif', color: paper, textTransform: 'uppercase' }}>Periode {period.nr}</div>
        <div style={{ font: '400 10.5px/1.45 "Space Grotesk",sans-serif', color: 'rgba(244,241,230,.42)', marginTop: 4 }}>
          {period.start} → {period.eind} · {t.streep} streepjes
        </div>
      </div>
      <div style={{ textAlign: 'right', flex: 'none' }}>
        <div style={{ font: '500 14px "Space Grotesk",sans-serif', color: paper }}>{euro(bedrag(t, period.prijs, period.bakPrijs))}</div>
        <div style={{ font: '400 9px/1 Anton,sans-serif', letterSpacing: '.09em', color: betaald ? lime : red, marginTop: 6 }}>{betaald ? 'BETAALD' : 'OPEN'}</div>
      </div>
    </div>
  )
}

export function Betalen({
  user,
  people,
  periodes,
  group,
  onToast,
}: {
  user: User
  people: Person[]
  periodes: (Period & { id: string })[]
  group: Group
  onToast: (tekst: string) => void
}) {
  const myRef = 'user:' + user.uid
  const nick = people.find((p) => p.personRef === myRef)?.nick ?? '?'
  const vandaag = new Date().toISOString().slice(0, 10)
  // AC6: a period closed with a future eind is still being streeped on, so it
  // has no bill yet — it only shows up here once that last day has passed.
  const betaalbaar = periodes.filter((p) => p.eind != null && p.eind < vandaag).sort((a, b) => b.nr - a.nr)
  const [nieuwste, ...eerdere] = betaalbaar

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
      <div style={{ font: '400 11.5px/1.5 "Space Grotesk",sans-serif', color: 'rgba(244,241,230,.5)', marginTop: 7 }}>
        Overschrijven doe je in je eigen bankapp. De drie velden staan hier klaar om te plakken.
      </div>

      {nieuwste ? (
        <HuidigeBetaling period={nieuwste} personRef={myRef} nick={nick} group={group} onToast={onToast} />
      ) : (
        <div style={{ margin: '20px 0 0', borderRadius: 12, background: 'rgba(216,246,81,.1)', border: '1px solid rgba(216,246,81,.35)', padding: 16 }}>
          <div style={{ font: '400 22px/1 Anton,sans-serif', color: lime, textTransform: 'uppercase' }}>Niets openstaand</div>
          <div style={{ font: '400 11px/1.5 "Space Grotesk",sans-serif', color: 'rgba(244,241,230,.6)', marginTop: 6 }}>Nog geen periode afgesloten.</div>
        </div>
      )}

      <div style={{ padding: '22px 0 6px', display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={kopje}>EERDERE PERIODES</span>
        <span style={{ font: '400 9.5px ui-monospace,monospace', color: 'rgba(244,241,230,.28)', marginLeft: 'auto' }}>{eerdere.length} periodes</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'rgba(244,241,230,.08)' }}>
        {eerdere.map((p) => (
          <HistoriekRij key={p.id} period={p} personRef={myRef} />
        ))}
      </div>
    </div>
  )
}
