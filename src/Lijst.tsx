import { useEffect, useRef, useState } from 'react'
import type { User } from 'firebase/auth'
import {
  addBak,
  addGuest,
  addStreep,
  periodId as pidOf,
  removeOne,
  undo,
  useEntries,
  useGroup,
  usePeople,
  usePeriod,
} from './data'
import { euro, totals } from './period'
import { tally } from './tally'
import { signOut } from './auth'
import { Profiel } from './Profiel'
import { Beheer } from './Beheer'

// Small building blocks shared by the two bottom sheets and the side panel
// (design lines 533-735). Ported section by section, Dutch copy verbatim.

const paper = '#F4F1E6'
const lime = '#D8F651'
const amber = '#F0A32B'
const red = '#E4483A'

const HOLD_MS = 620

/** Design lines 958-974: a WebAudio noise burst + a vibrate, gated by the sound toggle. */
function useKlik(geluid: boolean) {
  const acRef = useRef<AudioContext | undefined>(undefined)
  return (soort: 'streep' | 'bak') => {
    if (!geluid) return
    try {
      if (!acRef.current) acRef.current = new AudioContext()
      const ac = acRef.current
      const t = ac.currentTime
      const dur = soort === 'bak' ? 0.26 : 0.07
      const buf = ac.createBuffer(1, Math.ceil(ac.sampleRate * dur), ac.sampleRate)
      const d = buf.getChannelData(0)
      for (let i = 0; i < d.length; i++)
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, soort === 'bak' ? 1.4 : 2.6)
      const src = ac.createBufferSource()
      src.buffer = buf
      const bp = ac.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.value = soort === 'bak' ? 900 : 2400
      bp.Q.value = soort === 'bak' ? 1.1 : 2.4
      const g = ac.createGain()
      g.gain.value = soort === 'bak' ? 0.4 : 0.22
      src.connect(bp)
      bp.connect(g)
      g.connect(ac.destination)
      src.start(t)
    } catch {
      // ponytail: best-effort sound, a blocked/missing AudioContext just stays silent
    }
    if (navigator.vibrate) navigator.vibrate(soort === 'bak' ? [14, 40, 22] : 11)
  }
}

type Snack = { id?: string; tekst: string; kleur: string }

export function Lijst({ user }: { user: User }) {
  const period = usePeriod()
  const group = useGroup()
  const pid = period ? pidOf(period.nr) : undefined
  const people = usePeople(pid)
  const entries = useEntries(pid)
  const tot = totals(entries)

  const [correctie, setCorrectie] = useState(false)
  const [geluid, setGeluid] = useState(() => localStorage.getItem('geluid') !== 'uit')
  const klik = useKlik(geluid)

  const [holdingId, setHoldingId] = useState<string>()
  const holdRef = useRef<string | undefined>(undefined)
  const holdTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const [bakVoor, setBakVoor] = useState<string>()
  const [bakAantal, setBakAantal] = useState(1)

  const [nieuwOpen, setNieuwOpen] = useState(false)
  const [nieuwNick, setNieuwNick] = useState('')
  const [nieuwNaam, setNieuwNaam] = useState('')
  const [nieuwMail, setNieuwMail] = useState('')
  const [nieuwFout, setNieuwFout] = useState<string>()

  const [menuOpen, setMenuOpen] = useState(false)
  const [scherm, setScherm] = useState<string>()

  const [snack, setSnack] = useState<Snack>()
  const [snackFade, setSnackFade] = useState(false)
  const snackTimers = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(
    () => () => {
      clearTimeout(holdTimer.current)
      snackTimers.current.forEach(clearTimeout)
    },
    [],
  )

  const myRef = 'user:' + user.uid
  const myNick = people.find((p) => p.personRef === myRef)?.nick ?? user.displayName?.split(' ')[0] ?? '?'

  const zegSnack = (id: string | undefined, tekst: string, kleur: string) => {
    snackTimers.current.forEach(clearTimeout)
    setSnack({ id, tekst, kleur })
    setSnackFade(false)
    snackTimers.current = [
      setTimeout(() => setSnackFade(true), 4200),
      setTimeout(() => setSnack(undefined), 4500),
    ]
  }

  if (!period || !pid) return null

  const nick = (personRef: string) => people.find((p) => p.personRef === personRef)?.nick ?? '?'

  const onStreep = async (personRef: string) => {
    if (!period.open) return
    klik('streep')
    const ref = await addStreep(pid, personRef, user.uid, myNick)
    zegSnack(ref.id, `+1 voor ${nick(personRef)} · ${personRef === myRef ? 'op je eigen naam' : nick(personRef) + ' krijgt een melding'}`, lime)
  }

  const onSchrap = async (personRef: string, kind: 'streep' | 'bak') => {
    const staat = tot.get(personRef) ?? { streep: 0, bak: 0 }
    if (kind === 'bak' ? staat.bak < 1 : staat.streep < 1) return
    klik(kind)
    const ref = await removeOne(pid, personRef, kind, user.uid, myNick)
    zegSnack(
      ref.id,
      kind === 'streep'
        ? `1 streep geschrapt bij ${nick(personRef)} · blijft doorstreept in het logboek`
        : `BAK geschrapt bij ${nick(personRef)} · blijft doorstreept in het logboek`,
      amber,
    )
  }

  const onHoldDown = (personRef: string) => {
    if (!period.open) return
    holdRef.current = personRef
    setHoldingId(personRef)
    clearTimeout(holdTimer.current)
    holdTimer.current = setTimeout(() => {
      holdRef.current = undefined
      setHoldingId(undefined)
      if (correctie) onSchrap(personRef, 'bak')
      else {
        setBakVoor(personRef)
        setBakAantal(1)
      }
    }, HOLD_MS)
  }

  const onHoldUp = (personRef: string) => {
    if (holdRef.current !== personRef) return
    clearTimeout(holdTimer.current)
    holdRef.current = undefined
    setHoldingId(undefined)
    if (correctie) onSchrap(personRef, 'streep')
    else onStreep(personRef)
  }

  const onHoldCancel = (personRef: string) => {
    clearTimeout(holdTimer.current)
    if (holdRef.current === personRef) {
      holdRef.current = undefined
      setHoldingId(undefined)
    }
  }

  const bevestigBak = async () => {
    if (!bakVoor) return
    klik('bak')
    const ref = await addBak(pid, bakVoor, user.uid, myNick, bakAantal)
    zegSnack(
      ref.id,
      `+${bakAantal} BAK voor ${nick(bakVoor)} · ${bakVoor === myRef ? 'op je eigen naam' : nick(bakVoor) + ' krijgt een melding'}`,
      lime,
    )
    setBakVoor(undefined)
  }

  const bewaarNieuw = async () => {
    if (!nieuwNick.trim()) {
      setNieuwFout('Bijnaam is verplicht')
      return
    }
    await addGuest(pid, nieuwNick.trim(), nieuwNaam.trim(), nieuwMail.trim() || null, user.uid)
    setNieuwOpen(false)
    setNieuwNick('')
    setNieuwNaam('')
    setNieuwMail('')
    setNieuwFout(undefined)
  }

  const totStreep = [...tot.values()].reduce((a, v) => a + v.streep, 0)
  const totBak = [...tot.values()].reduce((a, v) => a + v.bak, 0)
  const totEuro = [...tot.values()].reduce((a, v) => a + v.streep * period.prijs + v.bak * period.bakPrijs, 0)

  const hintTekst = !period.open
    ? 'AFGESLOTEN · STREPEN KAN NIET MEER'
    : correctie
      ? 'TIK = –1 · VASTHOUDEN = – BAK'
      : 'TIK = +1 · VASTHOUDEN = BAK'
  const chipOpacity = period.open ? 1 : 0.4

  const myRole = people.find((p) => p.personRef === myRef)?.role ?? 'lid'
  // design line 1705: Beheer is enkelAdmin, everyone else never sees it.
  const nav = ['Lijst', 'Afsluiten', 'Beheer', 'Mijn profiel', 'Betalen', 'Inningen', 'Meldingen'].filter(
    (label) => label !== 'Beheer' || myRole === 'beheerder',
  )

  if (scherm) {
    // ponytail: every destination except lijst, Mijn profiel and Beheer is a
    // stub, per TASK-3 scope. Real screens land in their own tasks.
    return (
      <main style={{ minHeight: '100vh', background: '#121310', color: paper, padding: '58px 18px 0', display: 'flex', flexDirection: 'column' }}>
        <div
          onClick={() => setScherm(undefined)}
          style={{ display: 'inline-block', cursor: 'pointer', font: '500 12px "Space Grotesk",sans-serif', color: 'rgba(244,241,230,.7)' }}
        >
          ← Terug
        </div>
        {scherm === 'Mijn profiel' ? (
          <Profiel user={user} people={people} period={period} onTerug={() => setScherm(undefined)} />
        ) : scherm === 'Beheer' ? (
          <Beheer user={user} people={people} group={group} onToast={(tekst) => zegSnack(undefined, tekst, lime)} />
        ) : (
          <>
            <h1 style={{ font: '400 30px/1 Anton,sans-serif', textTransform: 'uppercase', marginTop: 16 }}>{scherm}</h1>
            <p style={{ font: '500 12px "Space Grotesk",sans-serif', color: 'rgba(244,241,230,.5)' }}>Komt nog.</p>
          </>
        )}
      </main>
    )
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '58px 0 34px' }}>
        <div style={{ padding: '0 18px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <h1
              style={{
                flex: 1,
                minWidth: 0,
                margin: 0,
                font: "400 26px/1 Anton,sans-serif",
                letterSpacing: '-.01em',
                color: paper,
                textTransform: 'uppercase',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              Streepkeslijst
            </h1>
            <div
              onClick={() => setMenuOpen(true)}
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                height: 44,
                padding: '0 12px 0 5px',
                borderRadius: 99,
                background: 'rgba(244,241,230,.07)',
                border: '1px solid rgba(244,241,230,.12)',
                cursor: 'pointer',
                flex: 'none',
              }}
            >
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 99,
                  background: lime,
                  color: '#121310',
                  font: '700 13px/34px "Space Grotesk",sans-serif',
                  textAlign: 'center',
                  flex: 'none',
                }}
              >
                {myNick[0]?.toUpperCase()}
              </div>
              <span style={{ font: '500 12px "Space Grotesk",sans-serif', color: 'rgba(244,241,230,.85)' }}>{myNick}</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 'none', marginLeft: 2 }}>
                <div style={{ width: 15, height: 2, borderRadius: 1, background: 'rgba(244,241,230,.7)' }} />
                <div style={{ width: 15, height: 2, borderRadius: 1, background: 'rgba(244,241,230,.7)' }} />
                <div style={{ width: 15, height: 2, borderRadius: 1, background: 'rgba(244,241,230,.7)' }} />
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
            <span style={{ background: lime, color: '#121310', font: '400 11px/1 Anton,sans-serif', letterSpacing: '.06em', padding: '5px 7px', borderRadius: 3 }}>
              PERIODE {period.nr} · LIVE
            </span>
            <span style={{ font: '500 12px "Space Grotesk",sans-serif', color: 'rgba(244,241,230,.72)' }}>
              {period.start} → {period.eind || 'nog open'}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 1, margin: '6px 12px 14px', background: 'rgba(244,241,230,.1)', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ flex: 1, padding: '9px 10px', background: '#1B1D17' }}>
            <div data-stat="streepjes" style={{ font: '400 24px/1 Anton,sans-serif', color: paper }}>{totStreep}</div>
            <div style={{ font: '500 9.5px "Space Grotesk",sans-serif', letterSpacing: '.08em', color: 'rgba(244,241,230,.45)', marginTop: 3 }}>STREEPJES</div>
          </div>
          <div style={{ flex: 1, padding: '9px 10px', background: '#1B1D17' }}>
            <div data-stat="bakken" style={{ font: '400 24px/1 Anton,sans-serif', color: amber }}>{totBak}</div>
            <div style={{ font: '500 9.5px "Space Grotesk",sans-serif', letterSpacing: '.08em', color: 'rgba(244,241,230,.45)', marginTop: 3 }}>BAKKEN</div>
          </div>
          <div style={{ flex: 1, padding: '9px 10px', background: '#1B1D17' }}>
            <div data-stat="euro" style={{ font: '400 24px/1 Anton,sans-serif', color: lime }}>{euro(totEuro)}</div>
            <div style={{ font: '500 9.5px "Space Grotesk",sans-serif', letterSpacing: '.08em', color: 'rgba(244,241,230,.45)', marginTop: 3 }}>TE INNEN</div>
          </div>
        </div>

        <div style={{ padding: '0 12px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ font: '400 9.5px ui-monospace,monospace', letterSpacing: '.16em', color: 'rgba(244,241,230,.38)', flex: 1, minWidth: 0 }}>{hintTekst}</div>
          <div
            onClick={() => {
              const next = !geluid
              setGeluid(next)
              localStorage.setItem('geluid', next ? 'aan' : 'uit')
            }}
            style={{
              font: '500 10px "Space Grotesk",sans-serif',
              color: 'rgba(244,241,230,.55)',
              padding: '3px 7px',
              border: '1px solid rgba(244,241,230,.16)',
              borderRadius: 99,
              cursor: 'pointer',
              flex: 'none',
              opacity: chipOpacity,
            }}
          >
            {geluid ? 'geluid aan' : 'geluid uit'}
          </div>
          <div
            onClick={() => setCorrectie((c) => !c)}
            style={{
              font: '500 10px "Space Grotesk",sans-serif',
              padding: '3px 7px',
              borderRadius: 99,
              cursor: 'pointer',
              flex: 'none',
              border: `1px solid ${correctie ? red : 'rgba(244,241,230,.16)'}`,
              background: correctie ? red : 'transparent',
              color: correctie ? '#fff' : 'rgba(244,241,230,.55)',
              opacity: chipOpacity,
            }}
          >
            {correctie ? 'klaar' : 'corrigeren'}
          </div>
        </div>

        {correctie && (
          <div style={{ margin: '8px 12px 0', border: `1px solid ${red}`, borderRadius: 8, background: 'rgba(228,72,58,.12)', padding: '9px 11px' }}>
            <div style={{ font: '400 13px/1 Anton,sans-serif', letterSpacing: '.04em', color: red, textTransform: 'uppercase' }}>Gomstand</div>
            <div style={{ font: '400 10.5px/1.45 "Space Grotesk",sans-serif', color: 'rgba(244,241,230,.6)', marginTop: 4 }}>
              Zelfde gebaren, omgekeerd: <strong style={{ color: paper }}>tik = 1 streep weg</strong>, <strong style={{ color: paper }}>vasthouden = 1 BAK weg</strong>. Wat je
              schrapt blijft doorstreept in het logboek staan, met jouw naam erbij.
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'rgba(244,241,230,.08)', margin: '8px 0 0' }}>
          {people.map((p) => {
            const t = tot.get(p.personRef) ?? { streep: 0, bak: 0 }
            const isMij = p.personRef === myRef
            return (
              <div
                key={p.id}
                data-row={p.personRef}
                onPointerDown={() => onHoldDown(p.personRef)}
                onPointerUp={() => onHoldUp(p.personRef)}
                onPointerLeave={() => onHoldCancel(p.personRef)}
                onPointerCancel={() => onHoldCancel(p.personRef)}
                style={{
                  position: 'relative',
                  background: '#161811',
                  padding: '11px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  cursor: 'pointer',
                  userSelect: 'none',
                  touchAction: 'none',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
                    <span style={{ font: '400 17px/1 Anton,sans-serif', color: paper, textTransform: 'uppercase', letterSpacing: '.005em' }}>{p.nick}</span>
                    {isMij && (
                      <span style={{ font: '400 8.5px/1 Anton,sans-serif', letterSpacing: '.1em', color: '#121310', background: lime, padding: '3px 4px', borderRadius: 2 }}>
                        IK
                      </span>
                    )}
                    <span style={{ font: '400 11px "Space Grotesk",sans-serif', color: 'rgba(244,241,230,.38)' }}>{p.naam}</span>
                  </div>
                  <div style={{ marginTop: 7, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ display: 'block' }}>{tally(t.streep, paper)}</span>
                  </div>
                </div>
                <div style={{ textAlign: 'right', flex: 'none' }}>
                  <div data-streep style={{ font: '400 27px/0.9 Anton,sans-serif', color: paper }}>{t.streep}</div>
                  <div style={{ font: '500 9px "Space Grotesk",sans-serif', color: 'rgba(244,241,230,.4)' }}>STREEPJES</div>
                  {t.bak > 0 && (
                    <div data-bak style={{ marginTop: 6, font: '400 12px/1 Anton,sans-serif', letterSpacing: '.05em', color: amber }}>
                      {t.bak > 1 ? `+ ${t.bak} BAKKEN` : '+ 1 BAK'}
                    </div>
                  )}
                </div>
                {correctie && (
                  <div
                    style={{
                      flex: 'none',
                      width: 26,
                      height: 26,
                      borderRadius: 99,
                      border: `1px solid ${red}`,
                      color: red,
                      display: 'grid',
                      placeItems: 'center',
                      font: '400 15px/1 Anton,sans-serif',
                      opacity: t.streep > 0 ? 1 : 0.35,
                    }}
                  >
                    –
                  </div>
                )}
                {holdingId === p.personRef && (
                  <div
                    data-hold
                    style={{
                      position: 'absolute',
                      left: 0,
                      bottom: 0,
                      height: 3,
                      background: correctie ? red : amber,
                      animation: 'holdfill .62s linear forwards',
                    }}
                  />
                )}
              </div>
            )
          })}
        </div>

        <div style={{ padding: '16px 14px 0', display: 'flex', gap: 8 }}>
          <div
            onClick={() => setNieuwOpen(true)}
            style={{ flex: 1, textAlign: 'center', padding: '13px 14px', border: '1px dashed rgba(244,241,230,.28)', borderRadius: 8, cursor: 'pointer' }}
          >
            <div style={{ font: '500 11.5px "Space Grotesk",sans-serif', color: 'rgba(244,241,230,.7)' }}>+ gast toevoegen</div>
            <div style={{ marginTop: 4, font: '400 9.5px ui-monospace,monospace', letterSpacing: '.1em', color: 'rgba(240,163,43,.85)' }}>EENMALIG · ALLEEN DEZE PERIODE</div>
          </div>
        </div>
      </div>

      {menuOpen && (
        <>
          <div onClick={() => setMenuOpen(false)} style={{ position: 'absolute', inset: 0, zIndex: 96, background: 'rgba(6,7,5,.62)' }} />
          <div
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              right: 0,
              width: '82%',
              zIndex: 97,
              background: '#1B1D17',
              borderLeft: '1px solid rgba(244,241,230,.12)',
              boxShadow: '-18px 0 44px rgba(0,0,0,.5)',
              display: 'flex',
              flexDirection: 'column',
              animation: 'panelIn .24s cubic-bezier(.2,.9,.3,1)',
            }}
          >
            <div style={{ padding: '58px 18px 0', flex: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                <div>
                  <div style={{ font: '400 10px ui-monospace,monospace', letterSpacing: '.16em', color: 'rgba(244,241,230,.45)' }}>CHIRO ELZESTRAAT</div>
                  <div style={{ font: '400 30px/0.95 Anton,sans-serif', color: paper, textTransform: 'uppercase', marginTop: 7 }}>Menu</div>
                </div>
                <div
                  onClick={() => setMenuOpen(false)}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 99,
                    background: 'rgba(244,241,230,.08)',
                    display: 'grid',
                    placeItems: 'center',
                    font: '400 17px/1 Anton,sans-serif',
                    color: paper,
                    cursor: 'pointer',
                    flex: 'none',
                  }}
                >
                  ✕
                </div>
              </div>
            </div>

            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '18px 0 34px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'rgba(244,241,230,.08)' }}>
                {nav.map((label) => (
                  <div
                    key={label}
                    onClick={() => {
                      setMenuOpen(false)
                      if (label !== 'Lijst') setScherm(label)
                    }}
                    style={{ background: label === 'Lijst' && !scherm ? '#1B1D17' : 'transparent', padding: '15px 18px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', position: 'relative' }}
                  >
                    {label === 'Lijst' && <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: lime }} />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ font: '400 19px/1 Anton,sans-serif', letterSpacing: '.02em', textTransform: 'uppercase', color: paper }}>{label}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ padding: '20px 18px 0' }}>
                <div style={{ font: '400 9.5px ui-monospace,monospace', letterSpacing: '.16em', color: 'rgba(244,241,230,.38)' }}>INGELOGD ALS</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 99,
                      background: lime,
                      color: '#121310',
                      font: '700 14px/34px "Space Grotesk",sans-serif',
                      textAlign: 'center',
                      flex: 'none',
                    }}
                  >
                    {myNick[0]?.toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ font: '400 17px/1 Anton,sans-serif', color: paper, textTransform: 'uppercase' }}>{myNick}</div>
                    <div onClick={signOut} style={{ font: '400 10.5px "Space Grotesk",sans-serif', color: 'rgba(244,241,230,.45)', marginTop: 4, cursor: 'pointer' }}>
                      afmelden
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {nieuwOpen && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 95,
            background: '#1B1D17',
            borderTop: `2px solid ${lime}`,
            borderRadius: '18px 18px 0 0',
            padding: '18px 18px 34px',
            animation: 'sheetUp .24s cubic-bezier(.2,.9,.3,1)',
          }}
        >
          <div style={{ font: '400 10px ui-monospace,monospace', letterSpacing: '.16em', color: amber }}>GAST · PERIODE {period.nr}</div>
          <div style={{ font: '400 30px/1 Anton,sans-serif', color: paper, textTransform: 'uppercase', margin: '7px 0 6px' }}>Wie drinkt er mee?</div>
          <div style={{ font: '400 11px/1.5 "Space Grotesk",sans-serif', color: 'rgba(244,241,230,.5)', marginBottom: 12 }}>
            Voor iemand die er deze keer bij is en niet in de leidersploeg zit — een stagiair, een oud-leider, iemand van de fanfare.
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            <div style={{ background: 'rgba(244,241,230,.06)', border: `1px solid ${nieuwFout ? red : 'rgba(244,241,230,.12)'}`, borderRadius: 10, padding: '11px 13px' }}>
              <div style={{ font: '400 9.5px ui-monospace,monospace', letterSpacing: '.14em', color: 'rgba(244,241,230,.4)' }}>BIJNAAM</div>
              <input
                value={nieuwNick}
                onChange={(e) => setNieuwNick(e.target.value)}
                placeholder="bv. Wollie"
                style={{ width: '100%', marginTop: 5, background: 'transparent', border: 'none', outline: 'none', color: paper, font: '400 22px/1.1 Anton,sans-serif', textTransform: 'uppercase' }}
              />
            </div>
            <div style={{ background: 'rgba(244,241,230,.06)', border: '1px solid rgba(244,241,230,.12)', borderRadius: 10, padding: '11px 13px' }}>
              <div style={{ font: '400 9.5px ui-monospace,monospace', letterSpacing: '.14em', color: 'rgba(244,241,230,.4)' }}>ECHTE NAAM</div>
              <input
                value={nieuwNaam}
                onChange={(e) => setNieuwNaam(e.target.value)}
                placeholder="bv. Wout D."
                style={{ width: '100%', marginTop: 5, background: 'transparent', border: 'none', outline: 'none', color: paper, font: '500 15px "Space Grotesk",sans-serif' }}
              />
            </div>
            <div style={{ background: 'rgba(244,241,230,.06)', border: '1px solid rgba(244,241,230,.12)', borderRadius: 10, padding: '11px 13px' }}>
              <div style={{ font: '400 9.5px ui-monospace,monospace', letterSpacing: '.14em', color: 'rgba(244,241,230,.4)' }}>E-MAIL · OPTIONEEL</div>
              <input
                value={nieuwMail}
                onChange={(e) => setNieuwMail(e.target.value)}
                type="email"
                inputMode="email"
                autoCapitalize="none"
                placeholder="alleen voor berichten over de afrekening"
                style={{ width: '100%', marginTop: 5, background: 'transparent', border: 'none', outline: 'none', color: paper, font: '500 15px "Space Grotesk",sans-serif' }}
              />
            </div>
          </div>

          {nieuwFout && (
            <div style={{ marginTop: 10, padding: '10px 11px', borderRadius: 8, background: 'rgba(228,72,58,.16)', border: `1px solid ${red}`, font: '500 11.5px "Space Grotesk",sans-serif', color: paper }}>
              {nieuwFout}
            </div>
          )}

          <div style={{ marginTop: 12, padding: '11px 12px', borderRadius: 9, background: 'rgba(240,163,43,.1)', border: '1px solid rgba(240,163,43,.4)' }}>
            <div style={{ font: '400 12px/1 Anton,sans-serif', letterSpacing: '.04em', color: amber, textTransform: 'uppercase' }}>Eenmalig, geen account</div>
            <div style={{ font: '400 10.5px/1.5 "Space Grotesk",sans-serif', color: 'rgba(244,241,230,.6)', marginTop: 5 }}>
              Een gast krijgt geen login en staat alleen op deze lijst. Met een e-mailadres krijgt hij bericht over zijn afrekening. Bij het afsluiten rekent hij af als iedereen,
              daarna verdwijnt hij. Vaste leiders zet je in de adminzone — die staan automatisch op elke nieuwe periode.
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <div
              onClick={() => setNieuwOpen(false)}
              style={{ flex: 'none', padding: '14px 18px', borderRadius: 8, border: '1px solid rgba(244,241,230,.2)', font: '500 12px "Space Grotesk",sans-serif', color: 'rgba(244,241,230,.7)', cursor: 'pointer' }}
            >
              Laat maar
            </div>
            <div
              onClick={bewaarNieuw}
              style={{ flex: 1, padding: 14, borderRadius: 8, background: amber, color: '#121310', textAlign: 'center', font: '400 15px/1 Anton,sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer' }}
            >
              Gast op de lijst
            </div>
          </div>
        </div>
      )}

      {snack && (
        <div
          style={{
            position: 'absolute',
            left: 12,
            right: 12,
            bottom: 44,
            zIndex: 70,
            background: snack.kleur,
            color: '#121310',
            borderRadius: 10,
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            boxShadow: '0 12px 32px rgba(0,0,0,.45)',
            transition: 'opacity .26s ease,transform .26s ease',
            opacity: snackFade ? 0 : 1,
            transform: snackFade ? 'translateY(6px)' : 'none',
            pointerEvents: snackFade ? 'none' : 'auto',
          }}
        >
          <span style={{ flex: 1, font: '500 12px/1.35 "Space Grotesk",sans-serif' }}>{snack.tekst}</span>
          {/* Only a booking can be undone; a Beheer toast has no entry behind it. */}
          {snack.id && (
            <span
              onClick={() => {
                undo(pid, snack.id!)
                setSnack(undefined)
              }}
              style={{ flex: 'none', font: '700 10.5px "Space Grotesk",sans-serif', letterSpacing: '.06em', textDecoration: 'underline', cursor: 'pointer' }}
            >
              ONGEDAAN
            </span>
          )}
        </div>
      )}

      {bakVoor && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 80,
            background: '#1B1D17',
            borderTop: `2px solid ${amber}`,
            borderRadius: '18px 18px 0 0',
            padding: '18px 18px 40px',
            animation: 'sheetUp .24s cubic-bezier(.2,.9,.3,1)',
          }}
        >
          <div style={{ font: '400 10px ui-monospace,monospace', letterSpacing: '.16em', color: amber }}>EEN HELE BAK</div>
          <div style={{ font: '400 34px/1 Anton,sans-serif', color: paper, textTransform: 'uppercase', margin: '6px 0 2px' }}>{nick(bakVoor)}</div>
          <div style={{ font: '400 12px "Space Grotesk",sans-serif', color: 'rgba(244,241,230,.55)' }}>
            {period.perBak} streepjes per bak · {bakAantal * period.perBak} streepjes voor {bakAantal} bak{bakAantal > 1 ? 'ken' : ''}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '18px 0' }}>
            <div
              onClick={() => setBakAantal((n) => Math.max(1, n - 1))}
              style={{ width: 52, height: 52, borderRadius: 99, border: '1px solid rgba(244,241,230,.2)', display: 'grid', placeItems: 'center', font: '400 26px/1 Anton,sans-serif', color: paper, cursor: 'pointer' }}
            >
              –
            </div>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ font: '400 46px/1 Anton,sans-serif', color: amber }}>{bakAantal}</div>
              <div style={{ font: '500 10px "Space Grotesk",sans-serif', letterSpacing: '.1em', color: 'rgba(244,241,230,.45)' }}>BAK(KEN)</div>
            </div>
            <div
              onClick={() => setBakAantal((n) => Math.min(9, n + 1))}
              style={{ width: 52, height: 52, borderRadius: 99, border: '1px solid rgba(244,241,230,.2)', display: 'grid', placeItems: 'center', font: '400 26px/1 Anton,sans-serif', color: paper, cursor: 'pointer' }}
            >
              +
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div
              onClick={() => setBakVoor(undefined)}
              style={{ flex: 'none', padding: '14px 18px', borderRadius: 8, border: '1px solid rgba(244,241,230,.2)', font: '500 12px "Space Grotesk",sans-serif', color: 'rgba(244,241,230,.7)', cursor: 'pointer' }}
            >
              Laat maar
            </div>
            <div
              onClick={bevestigBak}
              style={{ flex: 1, padding: 14, borderRadius: 8, background: amber, color: '#121310', textAlign: 'center', font: '400 15px/1 Anton,sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer' }}
            >
              Zet op zijn naam
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
