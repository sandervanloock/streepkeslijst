import { useEffect, useRef, useState } from 'react'
import type { User } from 'firebase/auth'
import { markRondje, periodId as pidOf, saveProfile, useGroup, usePeople, usePeriodes } from './data'
import { actievePeriode, euro, mededeling } from './period'
import { HOLD_MS, tally, useKlik } from './tally'

// Ported from design/Onboarding.dc.html, the five-step Welkomstrondje shown
// between Login and Lijst on a leader's first sign-in. Dutch copy verbatim,
// except the two lines the profile-link move forces (TASK-12): step 5's closer
// and the skip toast now point at Mijn profiel instead of the design's
// "Menu → Hoe werkt het" (there is no menu entry for this screen).
//
// Watch the design's crossed sN flags in renderVals: s3 is stap 2 (Jouw naam),
// s2 is stap 3 (Streepje zetten). This file is written by the labels array
// below, not by the block order in the markup.
const paper = '#F4F1E6'
const lime = '#D8F651'
const amber = '#F0A32B'
const red = '#E4483A'

const labels = ['Welkom', 'Jouw naam', 'Streepje zetten', 'Afrekenen', 'Klaar']

export function Rondje({ user, onKlaar }: { user: User; onKlaar: (toast?: string) => void }) {
  const periodes = usePeriodes()
  const vandaag = new Date().toISOString().slice(0, 10)
  const period = actievePeriode(periodes, vandaag)
  const group = useGroup()
  const pid = period ? pidOf(period.nr) : undefined
  const people = usePeople(pid)

  const [stap, setStap] = useState(1)
  const [nick, setNick] = useState('')
  const [naam, setNaam] = useState('')
  const [nickFout, setNickFout] = useState<string>()
  const [demo, setDemo] = useState(0)
  const [bak, setBak] = useState(0)
  const [hadBak, setHadBak] = useState(false)
  const [gom, setGom] = useState(false)
  const [geluid, setGeluid] = useState(true)
  const [bakOpen, setBakOpen] = useState(false)
  const [bakAantal, setBakAantal] = useState(1)
  const [houdBezig, setHoudBezig] = useState(false)
  const [overslaan, setOverslaan] = useState(false)
  const [toast, setToast] = useState<string>()

  const klik = useKlik(geluid)
  const holdRef = useRef(false)
  const holdTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(
    () => () => {
      clearTimeout(holdTimer.current)
      clearTimeout(toastTimer.current)
    },
    [],
  )

  const zeg = (t: string) => {
    clearTimeout(toastTimer.current)
    setToast(t)
    toastTimer.current = setTimeout(() => setToast(undefined), 2200)
  }

  const toonNick = nick.trim() || 'Naamloos'

  const ga = (n: number) => {
    setStap(n)
    setOverslaan(false)
    setNickFout(undefined)
  }

  // Both the finish button on stap 5 and 'Naar de lijst' in the skip sheet mark
  // the round seen — skipping is a decision, not a postponement (AC7). The
  // optional toast is shown by the Lijst screen after this component unmounts,
  // since a toast set on our own state would vanish with us in the same tick.
  const klaar = (toastMsg?: string) => {
    markRondje(user.uid)
    onKlaar(toastMsg)
  }

  const verder = () => {
    if (stap === 2 && !nick.trim()) {
      setNickFout('Kies een Chironaam — of tik een van de voorstellen aan.')
      return
    }
    if (stap === 5) {
      klaar()
      return
    }
    if (stap === 2) {
      saveProfile(user.uid, nick.trim(), naam.trim(), '')
      zeg('Opgeslagen als ' + nick.trim())
    }
    ga(stap + 1)
  }

  // Zelfde gebaren als in de echte lijst (Lijst.tsx): tik = 1, 620 ms
  // vasthouden opent het bakvenster — in gomstand haalt vasthouden meteen een
  // bak weg. HOLD_MS en useKlik komen uit tally.tsx zodat de twee rijen niet
  // uit elkaar kunnen groeien.
  const demoDown = () => {
    if (bakOpen) return
    holdRef.current = true
    setHoudBezig(true)
    holdTimer.current = setTimeout(() => {
      holdRef.current = false
      setHoudBezig(false)
      if (gom) {
        if (bak > 0) {
          setBak((b) => Math.max(0, b - 1))
          klik('bak')
          zeg('Een bak weggehaald')
        } else zeg('Er staan geen bakken om weg te halen')
      } else {
        setBakOpen(true)
        setBakAantal(1)
      }
    }, HOLD_MS)
  }

  const demoUp = () => {
    if (!holdRef.current) return
    clearTimeout(holdTimer.current)
    holdRef.current = false
    setHoudBezig(false)
    setDemo((d) => (gom ? Math.max(0, d - 1) : Math.min(96, d + 1)))
    klik('streep')
  }

  const demoAf = () => {
    clearTimeout(holdTimer.current)
    holdRef.current = false
    setHoudBezig(false)
  }

  const bakBevestig = () => {
    setBak((b) => b + bakAantal)
    setBakOpen(false)
    setHadBak(true)
    klik('bak')
    zeg(bakAantal + ' bak' + (bakAantal > 1 ? 'ken' : '') + ' erbij · apart geteld van je streepjes')
    setBakAantal(1)
  }

  const demoReset = () => {
    setDemo(0)
    setBak(0)
    setHadBak(false)
    setGom(false)
    setBakOpen(false)
    setBakAantal(1)
    setGeluid(true)
  }

  const demoUitleg = gom
    ? 'Gomstand staat aan: tikken haalt er één weg, vasthouden een hele bak. Tik "klaar" rechtsboven als je weer bijtelt.'
    : !demo
      ? 'Dit is jouw rij. Tik erop en er komt een streepje bij — precies zoals in de echte lijst.'
      : hadBak
        ? 'De bakken staan erbij. Vergist? Zet de gomstand hieronder aan.'
        : demo >= 5
          ? 'Vijf bij elkaar krijgen een dwarsstreep, net als op papier. Hou de rij nu eens vast voor een bak.'
          : 'Zie je? Eén tik, één streepje. Hou de rij vast om bakken te zetten.'

  const prijs = period?.prijs ?? 0.7
  const perBak = period?.perBak ?? 24
  const bedrag = demo * prijs + bak * perBak * prijs
  const demoMededeling = period ? mededeling(toonNick, period) : toonNick.toUpperCase()

  const knopLabel = stap === 5 ? 'Naar de lijst' : stap === 2 ? 'Dit ben ik' : stap === 3 ? 'Snap het' : 'Verder'
  const knopBg = stap === 5 || stap === 2 ? lime : paper

  const overslaanZin = nick.trim()
    ? 'Je gaat meteen naar de lijst. Je staat er als ' + nick.trim() + ' — later te wijzigen bij Mijn profiel.'
    : 'Je gaat meteen naar de lijst. Je staat er voorlopig zonder naam; die zet je erbij via Mijn profiel.'

  return (
    <div style={{ minHeight: '100vh', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 'none', padding: '58px 20px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 18, flex: 'none' }}>
          {labels.map((_, i) => (
            <div
              key={i}
              style={{
                width: 3,
                height: 14 + (i % 3),
                borderRadius: 2,
                background: i < stap ? lime : 'rgba(244,241,230,.2)',
                transform: `rotate(${[-4, 2, -2, 4, -1][i]}deg)`,
              }}
            />
          ))}
        </div>
        <div style={{ flex: 1, font: '400 9.5px ui-monospace,monospace', letterSpacing: '.14em', color: 'rgba(244,241,230,.38)' }}>
          STAP {stap} VAN 5 · {labels[stap - 1].toUpperCase()}
        </div>
        {stap < 5 && (
          <div
            onClick={() => setOverslaan(true)}
            style={{
              flex: 'none',
              padding: '7px 13px',
              borderRadius: 99,
              border: '1px solid rgba(244,241,230,.18)',
              font: '500 11.5px "Space Grotesk",sans-serif',
              color: 'rgba(244,241,230,.6)',
              cursor: 'pointer',
            }}
          >
            Overslaan
          </div>
        )}
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', padding: '0 20px 20px' }}>
        {stap === 1 && (
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: 1, minHeight: 14 }} />
            <h1 style={{ margin: '26px 0 0', font: '400 46px/0.9 Anton,sans-serif', color: paper, textTransform: 'uppercase', letterSpacing: '-.01em' }}>
              Welkom
              <br />
              op de lijst
            </h1>
            <div style={{ marginTop: 14, font: '400 14px/1.55 "Space Grotesk",sans-serif', color: 'rgba(244,241,230,.6)', maxWidth: 290 }}>
              Je zit nu op de streepkeslijst van <strong style={{ color: paper }}>Chiro Elzestraat</strong>. Eerst: hoe heet jij op de lijst? Daarna tonen we hoe je een streepje zet.
            </div>
            <div style={{ marginTop: 18, display: 'flex', gap: 8 }}>
              <div style={{ flex: 1, border: '1px solid rgba(244,241,230,.12)', borderRadius: 10, background: '#1B1D17', padding: '11px 12px' }}>
                <div style={{ font: '400 22px/1 Anton,sans-serif', color: lime }}>{euro(prijs)}</div>
                <div style={{ marginTop: 4, font: '500 9.5px "Space Grotesk",sans-serif', letterSpacing: '.06em', color: 'rgba(244,241,230,.42)' }}>PER STREEPJE</div>
              </div>
              <div style={{ flex: 1, border: '1px solid rgba(244,241,230,.12)', borderRadius: 10, background: '#1B1D17', padding: '11px 12px' }}>
                <div style={{ font: '400 22px/1 Anton,sans-serif', color: paper }}>{people.length}</div>
                <div style={{ marginTop: 4, font: '500 9.5px "Space Grotesk",sans-serif', letterSpacing: '.06em', color: 'rgba(244,241,230,.42)' }}>LEIDERS OP DE LIJST</div>
              </div>
            </div>
            <div style={{ flex: 1, minHeight: 14 }} />
          </div>
        )}

        {stap === 2 && (
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: 'none', paddingTop: 22 }}>
              <div style={{ font: '400 9.5px ui-monospace,monospace', letterSpacing: '.16em', color: lime }}>JOUW PLEK OP DE LIJST</div>
              <h2 style={{ margin: '9px 0 0', font: '400 34px/0.95 Anton,sans-serif', color: paper, textTransform: 'uppercase' }}>Hoe noemen ze je?</h2>
              <div style={{ marginTop: 10, font: '400 13px/1.5 "Space Grotesk",sans-serif', color: 'rgba(244,241,230,.6)' }}>
                Je Chironaam staat groot op de lijst. Je echte naam staat er klein bij, zodat nieuwe leiding weet wie wie is.
              </div>
            </div>

            <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 9 }}>
              <div style={{ border: `1px solid ${nickFout ? red : nick.trim() ? 'rgba(216,246,81,.45)' : 'rgba(244,241,230,.12)'}`, borderRadius: 10, background: '#1B1D17', padding: '11px 13px' }}>
                <div style={{ font: '400 9.5px ui-monospace,monospace', letterSpacing: '.14em', color: 'rgba(244,241,230,.4)' }}>CHIRONAAM</div>
                <input
                  value={nick}
                  onChange={(e) => {
                    setNick(e.target.value)
                    setNickFout(undefined)
                  }}
                  placeholder="bv. Wollie"
                  style={{ width: '100%', marginTop: 5, background: 'transparent', border: 'none', outline: 'none', color: paper, font: '400 24px/1.1 Anton,sans-serif', textTransform: 'uppercase' }}
                />
              </div>
              <div style={{ border: '1px solid rgba(244,241,230,.12)', borderRadius: 10, background: '#1B1D17', padding: '11px 13px' }}>
                <div style={{ font: '400 9.5px ui-monospace,monospace', letterSpacing: '.14em', color: 'rgba(244,241,230,.4)' }}>ECHTE NAAM</div>
                <input
                  value={naam}
                  onChange={(e) => setNaam(e.target.value)}
                  placeholder="Voornaam Achternaam"
                  style={{ width: '100%', marginTop: 5, background: 'transparent', border: 'none', outline: 'none', color: paper, font: '500 15px "Space Grotesk",sans-serif' }}
                />
              </div>
              {nickFout && (
                <div style={{ padding: '10px 11px', borderRadius: 8, background: 'rgba(228,72,58,.16)', border: `1px solid ${red}`, font: '500 11.5px "Space Grotesk",sans-serif', color: paper }}>
                  {nickFout}
                </div>
              )}
            </div>

            <div style={{ marginTop: 16 }}>
              <div style={{ font: '400 9.5px ui-monospace,monospace', letterSpacing: '.14em', color: 'rgba(244,241,230,.35)' }}>ZO STA JE STRAKS IN DE LIJST</div>
              <div style={{ marginTop: 8, border: '1px solid rgba(216,246,81,.35)', borderRadius: 12, background: 'rgba(216,246,81,.07)', padding: '13px 14px', display: 'flex', alignItems: 'center', gap: 11 }}>
                <div style={{ width: 34, height: 34, borderRadius: 99, background: lime, color: '#121310', font: '700 13px/34px "Space Grotesk",sans-serif', textAlign: 'center', flex: 'none' }}>
                  {toonNick.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ font: '400 18px/1 Anton,sans-serif', color: paper, textTransform: 'uppercase' }}>{toonNick}</div>
                  <div style={{ marginTop: 4, font: '400 10.5px "Space Grotesk",sans-serif', color: 'rgba(244,241,230,.45)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {naam.trim() || 'je echte naam'}
                  </div>
                </div>
                <div style={{ font: '400 22px/0.9 Anton,sans-serif', color: paper, flex: 'none' }}>{demo}</div>
              </div>
            </div>

            <div style={{ flex: 1, minHeight: 12 }} />
            <div style={{ font: '400 10.5px/1.5 "Space Grotesk",sans-serif', color: 'rgba(244,241,230,.35)' }}>Later te wijzigen bij Profiel.</div>
          </div>
        )}

        {stap === 3 && (
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: 'none', paddingTop: 22 }}>
              <div style={{ font: '400 9.5px ui-monospace,monospace', letterSpacing: '.16em', color: lime }}>PROBEER HET EVEN</div>
              <h2 style={{ margin: '9px 0 0', font: '400 34px/0.95 Anton,sans-serif', color: paper, textTransform: 'uppercase' }}>Tik je eigen rij</h2>
              <div style={{ marginTop: 10, font: '400 13px/1.5 "Space Grotesk",sans-serif', color: 'rgba(244,241,230,.6)' }}>{demoUitleg}</div>
            </div>

            <div style={{ flex: 1, minHeight: 12 }} />

            <div style={{ padding: '0 2px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ font: '400 9.5px ui-monospace,monospace', letterSpacing: '.16em', color: 'rgba(244,241,230,.38)', flex: 1, minWidth: 0 }}>
                {gom ? 'TIK = –1 · VASTHOUDEN = – BAK' : 'TIK = +1 · VASTHOUDEN = BAK'}
              </div>
              <div
                onClick={() => {
                  setGeluid((g) => !g)
                  zeg(geluid ? 'Geluid uit · je voelt enkel de tril' : 'Geluid aan · elke streep tikt')
                }}
                style={{ font: '500 10px "Space Grotesk",sans-serif', color: 'rgba(244,241,230,.55)', padding: '3px 7px', border: '1px solid rgba(244,241,230,.16)', borderRadius: 99, cursor: 'pointer', flex: 'none' }}
              >
                {geluid ? 'geluid aan' : 'geluid uit'}
              </div>
              <div
                onClick={() => {
                  setGom((g) => !g)
                  zeg(gom ? 'Gomstand uit · je telt weer bij' : 'Gomstand aan · tikken haalt weg')
                }}
                style={{
                  font: '500 10px "Space Grotesk",sans-serif',
                  padding: '3px 7px',
                  borderRadius: 99,
                  cursor: 'pointer',
                  flex: 'none',
                  border: `1px solid ${gom ? red : 'rgba(244,241,230,.16)'}`,
                  background: gom ? red : 'transparent',
                  color: gom ? '#fff' : 'rgba(244,241,230,.55)',
                }}
              >
                {gom ? 'klaar' : 'corrigeren'}
              </div>
            </div>

            <div
              data-demo-row
              onPointerDown={demoDown}
              onPointerUp={demoUp}
              onPointerLeave={demoAf}
              onPointerCancel={demoAf}
              onContextMenu={(e) => e.preventDefault()}
              style={{
                position: 'relative',
                border: `1px solid ${gom ? red : demo > 0 ? 'rgba(216,246,81,.4)' : 'rgba(244,241,230,.14)'}`,
                borderRadius: 12,
                background: '#1B1D17',
                padding: 14,
                cursor: 'pointer',
                userSelect: 'none',
                touchAction: 'none',
                overflow: 'hidden',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                <div style={{ width: 34, height: 34, borderRadius: 99, background: lime, color: '#121310', font: '700 13px/34px "Space Grotesk",sans-serif', textAlign: 'center', flex: 'none' }}>
                  {toonNick.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ font: '400 18px/1 Anton,sans-serif', color: paper, textTransform: 'uppercase' }}>{toonNick}</div>
                  <div style={{ marginTop: 4, font: '400 10.5px "Space Grotesk",sans-serif', color: 'rgba(244,241,230,.4)' }}>jij · deze periode</div>
                </div>
                <div style={{ textAlign: 'right', flex: 'none' }}>
                  <div data-demo-aantal style={{ font: '400 26px/0.9 Anton,sans-serif', color: gom ? red : demo > 0 ? lime : 'rgba(244,241,230,.3)' }}>{demo}</div>
                  <div style={{ font: '500 8.5px "Space Grotesk",sans-serif', letterSpacing: '.06em', color: 'rgba(244,241,230,.4)' }}>STREEPJES</div>
                  {bak > 0 && (
                    <div data-demo-bak style={{ marginTop: 5, font: '400 12px/1 Anton,sans-serif', letterSpacing: '.05em', color: amber }}>
                      {'+ ' + bak + (bak > 1 ? ' BAKKEN' : ' BAK')}
                    </div>
                  )}
                </div>
              </div>
              <div style={{ marginTop: 13, minHeight: 26, display: 'flex', alignItems: 'flex-end', gap: 13, flexWrap: 'wrap' }}>
                {demo > 0 ? (
                  <span style={{ display: 'block' }}>{tally(demo, paper)}</span>
                ) : (
                  <div style={{ font: '400 11.5px "Space Grotesk",sans-serif', color: 'rgba(244,241,230,.3)' }}>tik hier om te tellen ↑</div>
                )}
              </div>
              {houdBezig && (
                <div style={{ position: 'absolute', left: 0, bottom: 0, height: 3, background: amber, animation: 'holdfill .62s linear forwards' }} />
              )}
            </div>

            <div style={{ marginTop: 11, display: 'flex', flexDirection: 'column', gap: 7 }}>
              {[
                { hoe: 'TIK', wat: gom ? 'één streepje weg' : 'één streepje erbij', bg: lime, aan: false },
                { hoe: 'VASTHOUDEN', wat: gom ? 'een hele bak weg' : 'opent het bakvenster: kies hoeveel bakken', bg: amber, aan: false },
                {
                  hoe: 'CORRIGEREN',
                  wat: gom ? 'staat aan: alles wat je tikt gaat er nu af — tik "klaar" als je weer bijtelt' : 'rechtsboven de lijst: zet de gomstand aan om iets weg te halen',
                  bg: gom ? red : 'rgba(244,241,230,.1)',
                  aan: gom,
                },
                { hoe: 'GELUID', wat: geluid ? 'staat aan: je hoort elke streep, zo weet je dat hij geteld is' : 'staat uit: geen tik, enkel een korte tril', bg: 'rgba(244,241,230,.1)', aan: false },
              ].map((g) => (
                <div key={g.hoe} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 7px', margin: '0 -7px', borderRadius: 8, background: g.aan ? 'rgba(228,72,58,.14)' : 'transparent' }}>
                  <div style={{ font: '400 10px/1 ui-monospace,monospace', letterSpacing: '.1em', color: g.hoe === 'CORRIGEREN' && g.aan ? '#fff' : '#121310', background: g.bg, borderRadius: 4, padding: '5px 7px', flex: 'none', minWidth: 58, textAlign: 'center' }}>
                    {g.hoe}
                  </div>
                  <div style={{ flex: 1, font: '400 12px/1.45 "Space Grotesk",sans-serif', color: g.aan ? paper : 'rgba(244,241,230,.58)' }}>{g.wat}</div>
                  {g.aan && <div style={{ flex: 'none', font: '400 9px/1 ui-monospace,monospace', letterSpacing: '.1em', color: red }}>AAN</div>}
                </div>
              ))}
            </div>

            <div style={{ flex: 1, minHeight: 12 }} />
            <div onClick={demoReset} style={{ textAlign: 'center', font: '500 11px "Space Grotesk",sans-serif', color: 'rgba(244,241,230,.35)', cursor: 'pointer', padding: 4 }}>
              Demo terugzetten
            </div>
          </div>
        )}

        {stap === 4 && (
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: 'none', paddingTop: 22 }}>
              <div style={{ font: '400 9.5px ui-monospace,monospace', letterSpacing: '.16em', color: lime }}>EEN KEER PER PERIODE</div>
              <h2 style={{ margin: '9px 0 0', font: '400 34px/0.95 Anton,sans-serif', color: paper, textTransform: 'uppercase' }}>En dan betalen</h2>
              <div style={{ marginTop: 10, font: '400 13px/1.5 "Space Grotesk",sans-serif', color: 'rgba(244,241,230,.6)' }}>
                Een beheerder sluit de periode af en deelt één bericht in de groep. Jouw bedrag vind je altijd hier in de app.
              </div>
            </div>

            <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 9 }}>
              {[
                { nr: '1', titel: 'De periode loopt', tekst: 'Een week of twee. Je ziet bovenaan altijd hoeveel streepjes je al staan hebt.' },
                { nr: '2', titel: 'Beheerder sluit af', tekst: 'Vanaf dan komen er geen streepjes meer bij en ligt je bedrag vast.' },
                { nr: '3', titel: 'Eén bericht in de groep', tekst: 'Met de rekening en de uiterste datum. Jouw eigen bedrag staat in de app, niet in het bericht.' },
              ].map((u) => (
                <div key={u.nr} style={{ border: '1px solid rgba(244,241,230,.12)', borderRadius: 10, background: '#1B1D17', padding: '12px 13px', display: 'flex', gap: 11, alignItems: 'flex-start' }}>
                  <div style={{ font: '400 15px/1 Anton,sans-serif', color: lime, flex: 'none', width: 16, paddingTop: 2 }}>{u.nr}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ font: '400 15px/1 Anton,sans-serif', color: paper, textTransform: 'uppercase', letterSpacing: '.02em' }}>{u.titel}</div>
                    <div style={{ marginTop: 5, font: '400 11.5px/1.5 "Space Grotesk",sans-serif', color: 'rgba(244,241,230,.55)' }}>{u.tekst}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 12, border: '1px solid rgba(216,246,81,.35)', borderRadius: 10, background: 'rgba(216,246,81,.07)', padding: '12px 13px' }}>
              <div style={{ font: '400 10px/1 ui-monospace,monospace', letterSpacing: '.12em', color: 'rgba(244,241,230,.45)' }}>JOUW VOORBEELD-AFREKENING</div>
              <div style={{ marginTop: 8, display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <div style={{ font: '400 30px/1 Anton,sans-serif', color: lime }}>{euro(bedrag)}</div>
                <div style={{ font: '500 11.5px "Space Grotesk",sans-serif', color: 'rgba(244,241,230,.5)' }}>
                  voor {demo} streepjes{bak ? ' en ' + bak + ' bak' + (bak > 1 ? 'ken' : '') : ''}
                </div>
              </div>
              <div style={{ marginTop: 7, font: '400 10.5px/1.5 "Space Grotesk",sans-serif', color: 'rgba(244,241,230,.42)' }}>
                Met mededeling {demoMededeling} op {group.iban || 'BE68 5390 0754 7034'}.
              </div>
            </div>

            <div style={{ flex: 1, minHeight: 12 }} />
          </div>
        )}

        {stap === 5 && (
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: 1, minHeight: 14 }} />
            <div style={{ width: 66, height: 66, borderRadius: 16, background: lime, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 5, paddingBottom: 16 }}>
              <div style={{ width: 4, height: 30, background: '#121310', borderRadius: 2 }} />
              <div style={{ width: 4, height: 34, background: '#121310', borderRadius: 2 }} />
              <div style={{ width: 4, height: 28, background: '#121310', borderRadius: 2 }} />
            </div>
            <h2 style={{ margin: '22px 0 0', font: '400 42px/0.92 Anton,sans-serif', color: paper, textTransform: 'uppercase' }}>
              {nick.trim() ? 'Klaar, ' + nick.trim() : 'Klaar'}
            </h2>
            <div style={{ marginTop: 13, font: '400 13.5px/1.55 "Space Grotesk",sans-serif', color: 'rgba(244,241,230,.6)', maxWidth: 280 }}>
              Je staat op de lijst van Chiro Elzestraat. Tik je eigen rij zodra je iets pakt — de rest regelt de app.
            </div>
            <div style={{ marginTop: 18, border: '1px solid rgba(244,241,230,.12)', borderRadius: 10, background: '#1B1D17', padding: '12px 13px', font: '400 11.5px/1.55 "Space Grotesk",sans-serif', color: 'rgba(244,241,230,.5)' }}>
              Dit rondje opnieuw bekijken kan altijd via <strong style={{ color: paper }}>Mijn profiel</strong>.
            </div>
            <div style={{ flex: 1, minHeight: 14 }} />
          </div>
        )}
      </div>

      <div style={{ flex: 'none', padding: '0 20px 34px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div
          onClick={verder}
          style={{ height: 58, borderRadius: 99, background: knopBg, color: '#121310', display: 'grid', placeItems: 'center', font: '400 16px/1 Anton,sans-serif', letterSpacing: '.03em', textTransform: 'uppercase', cursor: 'pointer', boxShadow: '0 12px 30px rgba(0,0,0,.35)' }}
        >
          {knopLabel}
        </div>
        {stap > 1 && (
          <div onClick={() => ga(Math.max(1, stap - 1))} style={{ textAlign: 'center', font: '500 11.5px "Space Grotesk",sans-serif', color: 'rgba(244,241,230,.42)', cursor: 'pointer', padding: 2 }}>
            Terug
          </div>
        )}
      </div>

      {bakOpen && (
        <>
          <div onClick={() => setBakOpen(false)} style={{ position: 'absolute', inset: 0, zIndex: 70, background: 'rgba(10,11,9,.62)' }} />
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 80, background: '#1B1D17', borderTop: `2px solid ${amber}`, borderRadius: '18px 18px 0 0', padding: '18px 18px 40px', animation: 'sheetUp .24s cubic-bezier(.2,.9,.25,1) both' }}>
            <div style={{ font: '400 10px ui-monospace,monospace', letterSpacing: '.16em', color: amber }}>EEN HELE BAK</div>
            <div style={{ font: '400 34px/1 Anton,sans-serif', color: paper, textTransform: 'uppercase', margin: '6px 0 2px' }}>{toonNick}</div>
            <div style={{ font: '400 12px "Space Grotesk",sans-serif', color: 'rgba(244,241,230,.55)' }}>
              {perBak} streepjes per bak · {bakAantal * perBak} streepjes voor {bakAantal} bak{bakAantal > 1 ? 'ken' : ''}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '18px 0' }}>
              <div onClick={() => setBakAantal((n) => Math.max(1, n - 1))} style={{ width: 52, height: 52, borderRadius: 99, border: '1px solid rgba(244,241,230,.2)', display: 'grid', placeItems: 'center', font: '400 26px/1 Anton,sans-serif', color: paper, cursor: 'pointer' }}>
                –
              </div>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ font: '400 46px/1 Anton,sans-serif', color: amber }}>{bakAantal}</div>
                <div style={{ font: '500 10px "Space Grotesk",sans-serif', letterSpacing: '.1em', color: 'rgba(244,241,230,.45)' }}>BAK(KEN)</div>
              </div>
              <div onClick={() => setBakAantal((n) => Math.min(9, n + 1))} style={{ width: 52, height: 52, borderRadius: 99, border: '1px solid rgba(244,241,230,.2)', display: 'grid', placeItems: 'center', font: '400 26px/1 Anton,sans-serif', color: paper, cursor: 'pointer' }}>
                +
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div onClick={() => setBakOpen(false)} style={{ flex: 'none', padding: '14px 18px', borderRadius: 8, border: '1px solid rgba(244,241,230,.2)', font: '500 12px "Space Grotesk",sans-serif', color: 'rgba(244,241,230,.7)', cursor: 'pointer' }}>
                Laat maar
              </div>
              <div onClick={bakBevestig} style={{ flex: 1, padding: 14, borderRadius: 8, background: amber, color: '#121310', textAlign: 'center', font: '400 15px/1 Anton,sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer' }}>
                Zet erbij
              </div>
            </div>
          </div>
        </>
      )}

      {overslaan && (
        <>
          <div onClick={() => setOverslaan(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(10,11,9,.62)' }} />
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, background: '#1B1D17', borderTop: '1px solid rgba(244,241,230,.14)', borderRadius: '20px 20px 0 0', padding: '18px 20px 30px', animation: 'sheetUp .28s cubic-bezier(.2,.9,.25,1) both' }}>
            <div style={{ width: 38, height: 4, borderRadius: 99, background: 'rgba(244,241,230,.2)', margin: '0 auto 16px' }} />
            <div style={{ font: '400 24px/1 Anton,sans-serif', color: paper, textTransform: 'uppercase' }}>Rondje overslaan?</div>
            <div style={{ marginTop: 10, font: '400 12.5px/1.6 "Space Grotesk",sans-serif', color: 'rgba(244,241,230,.6)' }}>{overslaanZin}</div>
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 9 }}>
              <div onClick={() => setOverslaan(false)} style={{ height: 54, borderRadius: 99, background: paper, color: '#121310', display: 'grid', placeItems: 'center', font: '400 15px/1 Anton,sans-serif', letterSpacing: '.03em', textTransform: 'uppercase', cursor: 'pointer' }}>
                Toch verder kijken
              </div>
              <div
                onClick={() => klaar('Rondje overgeslagen · terug te vinden bij Mijn profiel')}
                style={{ height: 52, borderRadius: 99, border: '1px solid rgba(244,241,230,.2)', color: 'rgba(244,241,230,.8)', display: 'grid', placeItems: 'center', font: '500 12.5px "Space Grotesk",sans-serif', cursor: 'pointer' }}
              >
                Naar de lijst
              </div>
            </div>
          </div>
        </>
      )}

      {toast && (
        <div style={{ position: 'absolute', left: 18, right: 18, bottom: 112, background: paper, color: '#121310', borderRadius: 10, padding: '12px 14px', font: '500 12px "Space Grotesk",sans-serif', boxShadow: '0 14px 34px rgba(0,0,0,.4)' }}>
          {toast}
        </div>
      )}
    </div>
  )
}
