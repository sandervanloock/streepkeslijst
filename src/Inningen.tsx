import { useState } from 'react'
import type { User } from 'firebase/auth'
import { herroepBetaling, periodId as pidOf, useBetalingen, useEntries, usePeople, vinkAfBetaling } from './data'
import type { Period } from './data'
import { bedrag, euro, totals } from './period'

// Ported from design/"Streepkeslijst App.dc.html", the inningenOpen block
// (markup lines 393-489, state/logic lines 1593-1665), Dutch copy verbatim.
// The heading and menu chip belong to the shared header row in Lijst.tsx, so
// this component starts at the subtitle, same as Betalen/Profiel/Beheer.
// Out of scope (own task): the innBericht* mail/group-message card and the
// per-row 'Por · delen' nudge — both are share/mail plumbing the design fakes
// with a toast and a share sheet.
const paper = '#F4F1E6'
const lime = '#D8F651'
const amber = '#F0A32B'
const red = '#E4483A'

type Filter = 'alles' | 'open' | 'gemeld' | 'betaald'

const filters: { k: Filter; label: string }[] = [
  { k: 'alles', label: 'Alles' },
  { k: 'open', label: 'Open' },
  { k: 'gemeld', label: 'Na te kijken' },
  { k: 'betaald', label: 'Betaald' },
]

export function Inningen({
  user,
  periodes,
  onToast,
}: {
  user: User
  periodes: (Period & { id: string })[]
  onToast: (tekst: string) => void
}) {
  const vandaag = new Date().toISOString().slice(0, 10)
  // AC2: dezelfde periodes als Betalen, dezelfde uitdrukking, zodat beide
  // schermen het over dezelfde afgesloten periodes eens zijn.
  const afgesloten = periodes.filter((p) => p.eind != null && p.eind < vandaag).sort((a, b) => b.nr - a.nr)

  const [idx, setIdx] = useState(0)
  const [filter, setFilter] = useState<Filter>('alles')
  const period = afgesloten[idx]

  const people = usePeople(period ? pidOf(period.nr) : undefined)
  const entries = useEntries(period ? pidOf(period.nr) : undefined)
  const statussen = useBetalingen(period ? pidOf(period.nr) : undefined)

  const ga = (delta: number) => {
    setIdx((i) => Math.min(afgesloten.length - 1, Math.max(0, i + delta)))
    setFilter('alles')
  }

  const [swipeX, setSwipeX] = useState<number>()

  if (!period) {
    return (
      <div style={{ font: '400 11.5px/1.5 "Space Grotesk",sans-serif', color: 'rgba(244,241,230,.5)', marginTop: 7 }}>
        Nog geen periode afgesloten.
      </div>
    )
  }

  const t = totals(entries)
  const status = (personRef: string): 'open' | 'gemeld' | 'betaald' => statussen.get(personRef) ?? 'open'

  // AC4: iedereen met een bedrag in deze periode, dus alleen wie ook echt streepjes had.
  const mensen = people
    .map((p) => ({ ...p, t: t.get(p.personRef) ?? { streep: 0, bak: 0 } }))
    .filter((p) => p.t.streep > 0 || p.t.bak > 0)
    .map((p) => ({ ...p, euro: bedrag(p.t, period.prijs, period.bakPrijs), st: status(p.personRef) }))

  const betaaldAantal = mensen.filter((m) => m.st === 'betaald').length
  const gemeldAantal = mensen.filter((m) => m.st === 'gemeld').length
  const openAantal = mensen.filter((m) => m.st === 'open').length
  const openEuro = mensen.filter((m) => m.st !== 'betaald').reduce((a, m) => a + m.euro, 0)
  const totaalEuro = mensen.reduce((a, m) => a + m.euro, 0)

  const gefilterd = mensen.filter((m) => filter === 'alles' || m.st === filter)

  const doe = async (personRef: string, nick: string, st: 'open' | 'gemeld' | 'betaald', bedragVoorHem: number) => {
    if (st === 'betaald') {
      await herroepBetaling(pidOf(period.nr), personRef)
      onToast(`${nick} staat weer open`)
    } else {
      await vinkAfBetaling(pidOf(period.nr), personRef, user.uid)
      onToast(`${nick} afgevinkt · ${euro(bedragVoorHem)} ontvangen`)
    }
  }

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
      <div style={{ font: '400 11.5px/1.5 "Space Grotesk",sans-serif', color: 'rgba(244,241,230,.5)', marginTop: 7 }}>
        Vergelijk met het rekeninguittreksel en vink af. Blader met de pijlen of veeg links en rechts door de afgesloten periodes.
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 0 0' }}>
        <div
          data-pijl="ouder"
          onClick={() => idx < afgesloten.length - 1 && ga(1)}
          style={{
            flex: 'none',
            width: 44,
            height: 44,
            borderRadius: 99,
            border: `1px solid ${idx < afgesloten.length - 1 ? 'rgba(244,241,230,.28)' : 'rgba(244,241,230,.1)'}`,
            display: 'grid',
            placeItems: 'center',
            cursor: idx < afgesloten.length - 1 ? 'pointer' : 'default',
            opacity: idx < afgesloten.length - 1 ? 1 : 0.3,
          }}
        >
          <span style={{ display: 'block', width: 9, height: 9, borderLeft: '2px solid #F4F1E6', borderBottom: '2px solid #F4F1E6', transform: 'rotate(45deg) translate(1px,-1px)' }} />
        </div>
        <div style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
          <div style={{ font: '400 15px/1 Anton,sans-serif', letterSpacing: '.05em', color: paper }}>
            {`PERIODE ${period.nr} · ${period.start} → ${period.eind}`.toUpperCase()}
          </div>
          <div style={{ font: '400 9.5px "Space Grotesk",sans-serif', color: openAantal + gemeldAantal > 0 ? red : 'rgba(216,246,81,.75)', marginTop: 5 }}>
            {mensen.length} leiders · {euro(openEuro)} open · {euro(totaalEuro)} totaal
          </div>
        </div>
        <div
          data-pijl="recenter"
          onClick={() => idx > 0 && ga(-1)}
          style={{
            flex: 'none',
            width: 44,
            height: 44,
            borderRadius: 99,
            border: `1px solid ${idx > 0 ? 'rgba(244,241,230,.28)' : 'rgba(244,241,230,.1)'}`,
            display: 'grid',
            placeItems: 'center',
            cursor: idx > 0 ? 'pointer' : 'default',
            opacity: idx > 0 ? 1 : 0.3,
          }}
        >
          <span style={{ display: 'block', width: 9, height: 9, borderRight: '2px solid #F4F1E6', borderTop: '2px solid #F4F1E6', transform: 'rotate(45deg) translate(-1px,1px)' }} />
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 5, padding: '9px 0 0' }}>
        {afgesloten.map((p, i) => (
          <div
            key={p.id}
            data-stip={p.nr}
            onClick={() => {
              setIdx(i)
              setFilter('alles')
            }}
            style={{ width: i === idx ? 18 : 5, height: 5, borderRadius: 99, background: i === idx ? lime : 'rgba(244,241,230,.22)', cursor: 'pointer' }}
          />
        ))}
      </div>

      <div style={{ display: 'flex', gap: 1, margin: '12px 0 0', background: 'rgba(244,241,230,.1)', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ flex: 1, padding: '9px 10px', background: '#1B1D17' }}>
          <div data-teller="betaald" style={{ font: '400 22px/1 Anton,sans-serif', color: lime }}>{betaaldAantal}</div>
          <div style={{ font: '500 9.5px "Space Grotesk",sans-serif', letterSpacing: '.08em', color: 'rgba(244,241,230,.45)', marginTop: 3 }}>BETAALD</div>
        </div>
        <div style={{ flex: 1, padding: '9px 10px', background: '#1B1D17' }}>
          <div data-teller="gemeld" style={{ font: '400 22px/1 Anton,sans-serif', color: amber }}>{gemeldAantal}</div>
          <div style={{ font: '500 9.5px "Space Grotesk",sans-serif', letterSpacing: '.08em', color: 'rgba(244,241,230,.45)', marginTop: 3 }}>NA TE KIJKEN</div>
        </div>
        <div style={{ flex: 1, padding: '9px 10px', background: '#1B1D17' }}>
          <div data-teller="open" style={{ font: '400 22px/1 Anton,sans-serif', color: red }}>{openAantal}</div>
          <div style={{ font: '500 9.5px "Space Grotesk",sans-serif', letterSpacing: '.08em', color: 'rgba(244,241,230,.45)', marginTop: 3 }}>NOG OPEN</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, padding: '14px 0 4px' }}>
        {filters.map((f) => (
          <div
            key={f.k}
            onClick={() => setFilter(f.k)}
            style={{
              flex: 1,
              textAlign: 'center',
              padding: '9px 4px',
              borderRadius: 99,
              cursor: 'pointer',
              background: filter === f.k ? paper : 'transparent',
              color: filter === f.k ? '#121310' : 'rgba(244,241,230,.6)',
              border: `1px solid ${filter === f.k ? paper : 'rgba(244,241,230,.16)'}`,
              font: '500 11px "Space Grotesk",sans-serif',
            }}
          >
            {f.label}
          </div>
        ))}
      </div>

      <div
        data-swipe
        onTouchStart={(e) => setSwipeX(e.touches[0]?.clientX)}
        onTouchEnd={(e) => {
          if (swipeX == null) return
          const dx = e.changedTouches[0].clientX - swipeX
          setSwipeX(undefined)
          if (Math.abs(dx) > 45) {
            if (dx > 0 && idx > 0) ga(-1)
            else if (dx < 0 && idx < afgesloten.length - 1) ga(1)
          }
        }}
        style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'rgba(244,241,230,.08)', marginTop: 8 }}
      >
        {gefilterd.map((m) => {
          const statusChip = m.st === 'betaald' ? 'BETAALD' : m.st === 'gemeld' ? 'NA TE KIJKEN' : 'OPEN'
          const statusBg = m.st === 'betaald' ? 'rgba(216,246,81,.16)' : m.st === 'gemeld' ? 'rgba(240,163,43,.18)' : 'rgba(228,72,58,.18)'
          const statusFg = m.st === 'betaald' ? lime : m.st === 'gemeld' ? amber : red
          return (
            <div key={m.id} data-row={m.personRef} style={{ background: '#161811', padding: '12px 16px 13px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'baseline', gap: 7 }}>
                  <span style={{ font: '400 17px/1 Anton,sans-serif', color: paper, textTransform: 'uppercase' }}>{m.nick}</span>
                  <span style={{ font: '400 9px/1 Anton,sans-serif', letterSpacing: '.09em', padding: '4px 5px', borderRadius: 3, background: statusBg, color: statusFg }}>
                    {statusChip}
                  </span>
                </div>
                <div style={{ font: '400 20px/1 Anton,sans-serif', color: paper, flex: 'none' }}>{euro(m.euro)}</div>
              </div>
              <div style={{ display: 'flex', gap: 7, marginTop: 10 }}>
                <div
                  onClick={() => doe(m.personRef, m.nick, m.st, m.euro)}
                  style={{
                    flex: 1,
                    padding: '11px 6px',
                    borderRadius: 8,
                    textAlign: 'center',
                    cursor: 'pointer',
                    background: m.st === 'betaald' ? 'transparent' : lime,
                    color: m.st === 'betaald' ? 'rgba(244,241,230,.7)' : '#121310',
                    border: `1px solid ${m.st === 'betaald' ? 'rgba(244,241,230,.2)' : lime}`,
                    font: '500 11.5px "Space Grotesk",sans-serif',
                  }}
                >
                  {m.st === 'betaald' ? 'Terug openzetten' : 'Ontvangen · vink af'}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
