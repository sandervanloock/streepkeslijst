import type { Melding } from './data'
import { dagLabel, kort } from './period'

// Ported from design/"Streepkeslijst App.dc.html", the meldingenOpen panel
// (lines 737-790), Dutch copy verbatim. The heading ("Meldingen") and the
// close affordance belong to the shared header row in Lijst.tsx (same as
// every other screen, see Afsluiten.tsx's own comment on this), so this
// component starts at the "alles gelezen"/wacht-chip row.
//
// AC2/AC3: this renders straight off a Melding[] — a plain in-memory type,
// no Firestore snapshot in sight — so TASK-15 can concat derived meldingen
// onto the same array without touching a line here. No per-kind if-else:
// an unknown kind falls through both lookup tables below and still renders.
const paper = '#F4F1E6'
const lime = '#D8F651'

/** Left accent + soort-label colour per kind, fallback paper so a kind this
 *  screen has never heard of (TASK-15, TASK-14's future kinds, or AC10's
 *  test) still renders instead of throwing. */
const kleurVanKind: Record<string, string> = {
  'period-closed': '#E4483A',
}

/** Human soort-label per kind, fallback derived from the kind string itself
 *  ("something-new" → "Something new") so an unknown kind reads as something
 *  sensible rather than its raw machine id. */
const labelVanKind: Record<string, string> = {
  'period-closed': 'Periode afgesloten',
}

const labelVoorKind = (kind: string) =>
  labelVanKind[kind] ?? kind.charAt(0).toUpperCase() + kind.slice(1).replace(/-/g, ' ')

const lokaleDatum = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10)

/** Het klokuur voor vandaag en gisteren (design line 1777: "21:38"), de korte
 *  dd/mm daarvoor. Bewust niet nog eens "VANDAAG"/"GISTEREN": dat staat al op
 *  de dagkop waar het item onder hangt, en twee keer hetzelfde woord op één
 *  kaartje zegt niets extra. */
const relatieveTijd = (at: Date, nu: Date) =>
  dagLabel(at, nu) === 'eerder' ? kort(lokaleDatum(at)) : at.toTimeString().slice(0, 5)

const dagKop: Record<'vandaag' | 'gisteren' | 'eerder', string> = {
  vandaag: 'VANDAAG',
  gisteren: 'GISTEREN',
  eerder: 'EERDER',
}

export function Meldingen({
  nick,
  meldingen,
  readAt,
  onGa,
  onAllesGelezen,
}: {
  nick: string
  meldingen: Melding[]
  readAt: Date | undefined
  onGa: (scherm: string) => void
  onAllesGelezen: () => void
}) {
  const nu = new Date()
  const ongelezen = (m: Melding) => !readAt || m.at > readAt
  const wachtend = meldingen.filter((m) => ongelezen(m) && m.action).length
  const wachtLabel = wachtend > 0 ? `${wachtend} wachten op jou` : 'niets wacht op jou'

  // Groeperen op dag (design's hand-geschreven meldGroepen-koppen worden hier
  // afgeleid uit `at` in plaats van los bijgehouden).
  const groepen: { kop: string; items: Melding[] }[] = (['vandaag', 'gisteren', 'eerder'] as const)
    .map((bucket) => ({ kop: dagKop[bucket], items: meldingen.filter((m) => dagLabel(m.at, nu) === bucket) }))
    .filter((g) => g.items.length > 0)

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ marginTop: 7, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ font: '400 10px ui-monospace,monospace', letterSpacing: '.16em', color: 'rgba(244,241,230,.45)' }}>
          VOOR {nick.toUpperCase()}
        </div>
        <div onClick={onAllesGelezen} style={{ font: '500 10.5px "Space Grotesk",sans-serif', color: lime, cursor: 'pointer' }}>
          alles gelezen
        </div>
      </div>

      <div style={{ marginTop: 12, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <span
          style={{
            font: '500 10.5px "Space Grotesk",sans-serif',
            color: wachtend > 0 ? '#121310' : 'rgba(244,241,230,.6)',
            background: wachtend > 0 ? lime : 'rgba(244,241,230,.08)',
            padding: '5px 9px',
            borderRadius: 99,
          }}
        >
          {wachtLabel}
        </span>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', marginTop: 8 }}>
        {groepen.map((g) => (
          <div key={g.kop}>
            <div style={{ padding: '20px 0 6px', font: '400 9.5px ui-monospace,monospace', letterSpacing: '.16em', color: 'rgba(244,241,230,.38)' }}>
              {g.kop}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'rgba(244,241,230,.08)' }}>
              {g.items.map((m) => {
                const kleur = kleurVanKind[m.kind] ?? paper
                const nietGelezen = ongelezen(m)
                return (
                  <div
                    key={m.id}
                    style={{ background: nietGelezen ? 'rgba(228,72,58,.09)' : '#161811', padding: '13px 16px', display: 'flex', gap: 11, alignItems: 'flex-start' }}
                  >
                    <div style={{ width: 3, alignSelf: 'stretch', borderRadius: 2, background: kleur, flex: 'none' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
                        <span style={{ font: '400 13px/1 Anton,sans-serif', letterSpacing: '.05em', color: kleur, textTransform: 'uppercase' }}>
                          {labelVoorKind(m.kind)}
                        </span>
                        <span style={{ font: '400 10px ui-monospace,monospace', color: 'rgba(244,241,230,.35)', marginLeft: 'auto' }}>
                          {relatieveTijd(m.at, nu)}
                        </span>
                      </div>
                      <div style={{ font: '500 12.5px/1.45 "Space Grotesk",sans-serif', color: paper, marginTop: 6 }}>{m.text}</div>
                      <div style={{ font: '400 10.5px/1.4 "Space Grotesk",sans-serif', color: 'rgba(244,241,230,.42)', marginTop: 4 }}>{m.meta}</div>
                      {m.action && (
                        <div style={{ display: 'flex', gap: 7, marginTop: 11 }}>
                          <div
                            onClick={() => onGa(m.action!.screen)}
                            style={{ padding: '11px 14px', borderRadius: 8, font: '500 11.5px "Space Grotesk",sans-serif', cursor: 'pointer', background: lime, color: '#121310', border: `1px solid ${lime}` }}
                          >
                            {m.action.label}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        {meldingen.length === 0 && (
          <div style={{ padding: '20px 0', font: '400 11.5px/1.5 "Space Grotesk",sans-serif', color: 'rgba(244,241,230,.42)' }}>
            Nog geen meldingen.
          </div>
        )}

        <div style={{ padding: '20px 0 0', font: '400 10.5px/1.55 "Space Grotesk",sans-serif', color: 'rgba(244,241,230,.42)' }}>
          "Iemand streept voor mij" staat altijd aan. Zonder die melding kan niemand controleren wat er op zijn naam komt.
        </div>
      </div>
    </div>
  )
}
