import { useState } from 'react'
import type { User } from 'firebase/auth'
import { saveProfile, useProfile } from './data'
import type { Period, Person } from './data'
import { mededeling } from './period'

// Ported from design/"Streepkeslijst App.dc.html", the profielOpen block
// (lines 267-307), Dutch copy verbatim. The header row's menu button and
// avatar are already the panel's own concern in Lijst.tsx, so this screen
// only ports the heading, subtitle and the profile card.
const paper = '#F4F1E6'
const lime = '#D8F651'
const red = '#E4483A'

export function Profiel({ user, people, period, onTerug }: { user: User; people: Person[]; period: Period; onTerug: () => void }) {
  const myRef = 'user:' + user.uid
  const profile = useProfile(user.uid)
  const huidigeNick = people.find((p) => p.personRef === myRef)?.nick ?? '?'

  const [nick, setNick] = useState<string>()
  const [naam, setNaam] = useState<string>()
  const [mail, setMail] = useState<string>()
  const [fout, setFout] = useState<string>()

  if (!profile) return null

  const nickWaarde = nick ?? profile.nick
  const naamWaarde = naam ?? profile.naam
  const mailWaarde = mail ?? (profile.email || user.email || '')

  const bewaren = async () => {
    const trimmed = nickWaarde.trim()
    if (!trimmed) {
      setFout('Geef een bijnaam.')
      return
    }
    if (people.some((p) => p.personRef !== myRef && p.nick.toLowerCase() === trimmed.toLowerCase())) {
      setFout(trimmed + ' is al bezet.')
      return
    }
    await saveProfile(user.uid, trimmed, naamWaarde.trim(), mailWaarde.trim())
    setFout(undefined)
    onTerug()
  }

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
      <h2 style={{ margin: '16px 0 0', font: '400 38px/0.92 Anton,sans-serif', color: paper, textTransform: 'uppercase' }}>Mijn profiel</h2>
      <div style={{ font: '400 11.5px/1.5 "Space Grotesk",sans-serif', color: 'rgba(244,241,230,.5)', marginTop: 7 }}>
        Zo staat je naam op de lijst en in de mededeling van je betaling.
      </div>

      <div style={{ margin: '20px 0 0', borderRadius: 12, background: '#1B1D17', border: '1px solid rgba(244,241,230,.12)', padding: 16 }}>
        <div style={{ background: 'rgba(244,241,230,.06)', border: `1px solid ${fout ? red : 'rgba(244,241,230,.12)'}`, borderRadius: 10, padding: '11px 13px' }}>
          <div style={{ font: '400 9.5px ui-monospace,monospace', letterSpacing: '.14em', color: 'rgba(244,241,230,.4)' }}>BIJNAAM</div>
          <input
            value={nickWaarde}
            onChange={(e) => {
              setNick(e.target.value)
              setFout(undefined)
            }}
            placeholder="bv. Wollie"
            style={{ width: '100%', marginTop: 5, background: 'transparent', border: 'none', outline: 'none', color: paper, font: '400 26px/1.1 Anton,sans-serif', textTransform: 'uppercase' }}
          />
        </div>
        <div style={{ background: 'rgba(244,241,230,.06)', border: '1px solid rgba(244,241,230,.12)', borderRadius: 10, padding: '11px 13px', marginTop: 9 }}>
          <div style={{ font: '400 9.5px ui-monospace,monospace', letterSpacing: '.14em', color: 'rgba(244,241,230,.4)' }}>VOLLEDIGE NAAM</div>
          <input
            value={naamWaarde}
            onChange={(e) => setNaam(e.target.value)}
            placeholder="bv. Wouter Lievens"
            style={{ width: '100%', marginTop: 5, background: 'transparent', border: 'none', outline: 'none', color: paper, font: '500 15px "Space Grotesk",sans-serif' }}
          />
        </div>

        <div style={{ marginTop: 9, font: '500 11px "Space Grotesk",sans-serif', color: 'rgba(244,241,230,.4)' }}>
          Mededeling: {mededeling((nickWaarde.trim() || huidigeNick), period)}
        </div>

        {fout && <div style={{ marginTop: 9, font: '500 11px "Space Grotesk",sans-serif', color: red }}>{fout}</div>}

        <div style={{ marginTop: 16, paddingTop: 15, borderTop: '1px solid rgba(244,241,230,.1)' }}>
          <div style={{ font: '400 9.5px ui-monospace,monospace', letterSpacing: '.14em', color: 'rgba(244,241,230,.4)' }}>MAILADRES VOOR JE AFREKENING</div>
          <input
            value={mailWaarde}
            onChange={(e) => setMail(e.target.value)}
            type="email"
            inputMode="email"
            autoCapitalize="none"
            style={{ width: '100%', marginTop: 6, background: 'transparent', border: 'none', outline: 'none', color: paper, font: '500 15px "Space Grotesk",sans-serif' }}
          />
          <div style={{ font: '400 10.5px/1.5 "Space Grotesk",sans-serif', color: 'rgba(244,241,230,.45)', marginTop: 8 }}>
            Hier komt je afrekening binnen zodra de drankleider een periode afsluit — en een por als je vergeet over te schrijven. Een por kan ook rechtstreeks in
            je chat komen: de drankleider deelt ze dan met zijn eigen app.
          </div>
        </div>

        <div
          onClick={bewaren}
          style={{ marginTop: 13, padding: 14, borderRadius: 9, background: lime, color: '#121310', textAlign: 'center', font: '400 15px/1 Anton,sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer' }}
        >
          Bewaren
        </div>
      </div>
    </div>
  )
}
