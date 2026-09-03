import { useState } from 'react'
import type { User } from 'firebase/auth'
import { bumpInvite, createInvite, revokeInvite, saveGroupName, setRole, shareInvite, useInvites } from './data'
import type { Group, Invite, Person, Rol } from './data'
import { geldigeMail, kort, magRolWijzigen } from './period'

// Ported from design/"Streepkeslijst App.dc.html", the beheerOpen block
// (lines 175-265), Dutch copy verbatim except for the invite sections, which
// are written around mail — the delivery decision changed (see TASK-7's plan):
// no mail is sent, the beheerder shares the invite through navigator.share
// instead. Substitutions: 'Mail de uitnodiging' -> 'Deel de uitnodiging',
// 'GEMAILD, NOG NIET AANGESLOTEN' -> 'UITGENODIGD, NOG NIET AANGESLOTEN',
// badge GEMAILD -> UITGENODIGD, 'Opnieuw mailen' -> 'Opnieuw delen'. The
// heading and the BEHEERDER badge belong to the shared header row in
// Lijst.tsx, which keeps them on the menu chip's line on every screen.
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
  const invites = useInvites()
  const [uitContact, setUitContact] = useState('')
  const [uitFout, setUitFout] = useState<string>()

  // A hand-typed route must not reach this screen either, not just the menu item.
  if (ik?.role !== 'beheerder') return null

  const naamWaarde = naam ?? group.naam

  const bewaarNaam = () => {
    const trimmed = naamWaarde.trim()
    if (!trimmed) return
    saveGroupName(trimmed)
    onToast('Groep heet nu ' + trimmed)
  }

  const stuurUitnodiging = async () => {
    const mail = uitContact.trim().toLowerCase()
    if (!geldigeMail(mail)) {
      setUitFout('Geef een geldig e-mailadres.')
      return
    }
    if (invites.some((u) => u.id === mail)) {
      setUitFout('Die is al uitgenodigd — deel de uitnodiging opnieuw hieronder.')
      return
    }
    setUitFout(undefined)
    await createInvite(mail, user.uid, ik?.nick ?? '?')
    setUitContact('')
    const resultaat = await shareInvite(mail, group.naam)
    onToast(
      resultaat === 'gedeeld'
        ? `Uitnodiging voor ${mail} klaar · deel ze met hem`
        : 'Uitnodiging gekopieerd · plak ze in WhatsApp',
    )
  }

  const opnieuwDelen = async (u: Invite & { id: string }) => {
    await bumpInvite(u.id)
    await shareInvite(u.id, group.naam)
    onToast(`Uitnodiging voor ${u.id} opnieuw gedeeld`)
  }

  const trekIn = async (u: Invite & { id: string }) => {
    await revokeInvite(u.id)
    onToast(`Uitnodiging voor ${u.id} ingetrokken · hij kan niet meer aansluiten`)
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

      <div style={{ ...kopje, padding: '20px 0 6px' }}>VOLK ERBIJ HALEN</div>
      <div style={{ borderRadius: 12, background: '#1B1D17', border: '1px solid rgba(244,241,230,.12)', padding: 16 }}>
        <div style={{ font: '400 11.5px/1.55 "Space Grotesk",sans-serif', color: 'rgba(244,241,230,.6)', marginBottom: 14 }}>
          Een uitnodiging is de enige manier om erbij te komen. Ze melden zich aan met Google — <strong style={{ color: paper }}>gebruik het adres van hun Google-account</strong>, anders
          vindt de uitnodiging hen niet.
        </div>
        <div style={{ background: 'rgba(244,241,230,.06)', border: `1px solid ${uitFout ? red : 'rgba(244,241,230,.12)'}`, borderRadius: 10, padding: '11px 13px' }}>
          <div style={veldKopje}>E-MAILADRES</div>
          <input
            value={uitContact}
            onChange={(e) => {
              setUitContact(e.target.value)
              setUitFout(undefined)
            }}
            type="email"
            inputMode="email"
            autoCapitalize="none"
            placeholder="voornaam@mail.be"
            style={{ width: '100%', marginTop: 5, background: 'transparent', border: 'none', outline: 'none', color: paper, font: '500 15px "Space Grotesk",sans-serif' }}
          />
        </div>
        {uitFout && (
          <div style={{ marginTop: 9, padding: '10px 11px', borderRadius: 8, background: 'rgba(228,72,58,.16)', border: `1px solid ${red}`, font: '500 11.5px "Space Grotesk",sans-serif', color: paper }}>
            {uitFout}
          </div>
        )}
        <div
          onClick={stuurUitnodiging}
          style={{ marginTop: 10, padding: 14, borderRadius: 9, background: lime, color: '#121310', textAlign: 'center', font: '400 15px/1 Anton,sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer' }}
        >
          Deel de uitnodiging
        </div>
      </div>

      <div style={{ padding: '20px 0 6px', display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={kopje}>UITGENODIGD, NOG NIET AANGESLOTEN</span>
        <span style={{ font: '400 9.5px ui-monospace,monospace', color: 'rgba(244,241,230,.28)', marginLeft: 'auto' }}>{invites.length}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'rgba(244,241,230,.08)' }}>
        {invites.map((u) => {
          const herinnerd = u.herinnerd > 0
          return (
            <div key={u.id} style={{ background: '#161811', padding: '13px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ font: '500 13px/1.3 "Space Grotesk",sans-serif', color: paper, overflowWrap: 'anywhere' }}>{u.email}</div>
                  <div style={{ font: '400 10.5px/1.45 "Space Grotesk",sans-serif', color: 'rgba(244,241,230,.42)', marginTop: 4 }}>
                    Uitgenodigd {u.at ? kort(u.at.toDate().toISOString().slice(0, 10)) : '—'} · sluit aan zodra hij met dit adres bij Google inlogt
                  </div>
                </div>
                <span
                  style={{
                    flex: 'none',
                    font: '400 9px/1 Anton,sans-serif',
                    letterSpacing: '.09em',
                    padding: '5px 6px',
                    borderRadius: 3,
                    background: herinnerd ? lime : 'rgba(244,241,230,.14)',
                    color: herinnerd ? '#121310' : paper,
                  }}
                >
                  {herinnerd ? 'HERINNERD' : 'UITGENODIGD'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 11 }}>
                <div
                  onClick={() => opnieuwDelen(u)}
                  style={{ flex: 1, textAlign: 'center', padding: 10, borderRadius: 8, border: '1px solid rgba(244,241,230,.18)', font: '500 11px "Space Grotesk",sans-serif', color: 'rgba(244,241,230,.72)', cursor: 'pointer' }}
                >
                  Opnieuw delen
                </div>
                <div
                  onClick={() => trekIn(u)}
                  style={{ flex: 'none', padding: '10px 13px', borderRadius: 8, border: '1px solid rgba(228,72,58,.5)', font: '500 11px "Space Grotesk",sans-serif', color: red, cursor: 'pointer' }}
                >
                  Intrekken
                </div>
              </div>
            </div>
          )
        })}
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
