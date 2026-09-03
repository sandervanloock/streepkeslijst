import { useState } from 'react'
import type { User } from 'firebase/auth'
import { saveGroupName, setRole } from './data'
import type { Group, Person, Rol } from './data'
import { magRolWijzigen } from './period'

// Ported from design/"Streepkeslijst App.dc.html", the beheerOpen block
// (lines 175-265), Dutch copy verbatim. The two invite sections of that block
// (VOLK ERBIJ HALEN and GEMAILD, NOG NIET AANGESLOTEN) are TASK-7.
const paper = '#F4F1E6'
const lime = '#D8F651'
const red = '#E4483A'
const purple = '#7A4BD1'

const opties: { key: Rol; label: string; aanBg: string; aanFg: string }[] = [
  { key: 'lid', label: 'Lid', aanBg: 'rgba(244,241,230,.16)', aanFg: paper },
  { key: 'drankleider', label: 'Drankleider', aanBg: lime, aanFg: '#121310' },
  { key: 'beheerder', label: 'Beheerder', aanBg: purple, aanFg: paper },
]

const kopje = { font: '400 9.5px ui-monospace,monospace', letterSpacing: '.16em', color: 'rgba(244,241,230,.38)' } as const
const veldKopje = { font: '400 9.5px ui-monospace,monospace', letterSpacing: '.14em', color: 'rgba(244,241,230,.4)' } as const

export function Beheer({
  user,
  people,
  group,
  onToast,
}: {
  user: User
  people: Person[]
  group: Group
  onToast: (tekst: string) => void
}) {
  // The group is the leidersploeg, not the guests: a guest has no account and no role.
  const leden = people.filter((p) => !p.isGuest)
  const ik = leden.find((p) => p.id === user.uid)

  const [naam, setNaam] = useState<string>()
  const [fout, setFout] = useState<string>()

  // A hand-typed route must not reach this screen either, not just the menu item.
  if (ik?.role !== 'beheerder') return null

  const naamWaarde = naam ?? group.naam

  const bewaarNaam = () => {
    const trimmed = naamWaarde.trim()
    if (!trimmed) return
    saveGroupName(trimmed)
    onToast('Groep heet nu ' + trimmed)
  }

  const kies = (p: Person, rol: Rol) => {
    if (p.role === rol) return
    if (!magRolWijzigen(leden, p.id, rol)) {
      setFout('Er moet altijd één beheerder overblijven.')
      return
    }
    setFout(undefined)
    setRole(p.id, rol)
    onToast(p.nick + ' is nu ' + opties.find((o) => o.key === rol)!.label.toLowerCase())
  }

  const drankleiders = leden.filter((p) => p.role === 'drankleider').length
  const beheerders = leden.filter((p) => p.role === 'beheerder').length

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
      <span style={{ font: '400 9px/1 Anton,sans-serif', letterSpacing: '.1em', color: paper, background: purple, padding: '4px 5px', borderRadius: 2 }}>
        BEHEERDER
      </span>
      <h2 style={{ margin: '11px 0 0', font: '400 38px/0.92 Anton,sans-serif', color: paper, textTransform: 'uppercase' }}>Beheer</h2>
      <div style={{ font: '400 11.5px/1.5 "Space Grotesk",sans-serif', color: 'rgba(244,241,230,.5)', marginTop: 7 }}>
        Wie zit in de groep, wie mag wat. Alleen beheerders zien deze pagina.
      </div>

      <div style={{ ...kopje, padding: '20px 0 6px' }}>DE GROEP</div>
      <div style={{ background: 'rgba(244,241,230,.06)', border: `1px solid ${naamWaarde.trim() ? 'rgba(244,241,230,.12)' : red}`, borderRadius: 10, padding: '11px 13px' }}>
        <div style={veldKopje}>NAAM VAN DE GROEP</div>
        <input
          value={naamWaarde}
          onChange={(e) => setNaam(e.target.value)}
          onBlur={bewaarNaam}
          placeholder="bv. Chiro Elzestraat"
          style={{ width: '100%', marginTop: 5, background: 'transparent', border: 'none', outline: 'none', color: paper, font: '400 22px/1.15 Anton,sans-serif', textTransform: 'uppercase' }}
        />
      </div>

      <div style={{ padding: '20px 0 6px', display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={kopje}>ROLLEN</span>
        <span style={{ font: '400 9.5px ui-monospace,monospace', color: 'rgba(244,241,230,.28)', marginLeft: 'auto' }}>
          {drankleiders} drankleiders · {beheerders} beheerders
        </span>
      </div>
      <div style={{ padding: '12px 13px', borderRadius: 10, background: 'rgba(122,75,209,.14)', border: '1px solid rgba(122,75,209,.45)', font: '400 11.5px/1.55 "Space Grotesk",sans-serif', color: 'rgba(244,241,230,.8)' }}>
        De <strong style={{ color: lime }}>drankleider</strong> sluit de periode af en houdt de lijst recht. Een <strong style={{ color: '#C7A6FF' }}>beheerder</strong> nodigt volk uit
        en zet de rollen.
      </div>

      {fout && <div style={{ marginTop: 9, font: '500 11px "Space Grotesk",sans-serif', color: red }}>{fout}</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'rgba(244,241,230,.08)', marginTop: 12 }}>
        {leden.map((p) => (
          <div key={p.id} data-rol-rij={p.id} style={{ background: '#161811', padding: '13px 16px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <div
                data-avatar
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 99,
                  background: p.role === 'beheerder' ? purple : p.role === 'drankleider' ? lime : 'rgba(244,241,230,.1)',
                  color: p.role === 'drankleider' ? '#121310' : paper,
                  font: '700 12px/32px "Space Grotesk",sans-serif',
                  textAlign: 'center',
                  flex: 'none',
                }}
              >
                {p.nick[0]?.toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: '400 16px/1 Anton,sans-serif', color: paper, textTransform: 'uppercase' }}>{p.nick}</div>
                <div style={{ font: '400 10.5px/1.4 "Space Grotesk",sans-serif', color: 'rgba(244,241,230,.42)', marginTop: 4 }}>{p.naam}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 11 }}>
              {opties.map((o) => {
                const aan = p.role === o.key
                return (
                  <div
                    key={o.key}
                    onClick={() => kies(p, o.key)}
                    style={{
                      flex: 1,
                      textAlign: 'center',
                      padding: '10px 4px',
                      borderRadius: 8,
                      cursor: 'pointer',
                      background: aan ? o.aanBg : 'transparent',
                      border: `1px solid ${aan ? o.aanBg : 'rgba(244,241,230,.14)'}`,
                      color: aan ? o.aanFg : 'rgba(244,241,230,.5)',
                      font: '400 11px/1 Anton,sans-serif',
                      letterSpacing: '.05em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {o.label}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
