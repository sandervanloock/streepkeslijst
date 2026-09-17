import type { Entry } from './period'
import { fuifDag, kort, logboek } from './period'

// Ported from design/"Streepkeslijst App.dc.html", the auditOpen panel
// (lines 131-187, derivation 1336-1391), Dutch copy verbatim — minus two
// things the design has that this screen deliberately doesn't (see TASK-16):
// the heel-de-lijst mode (auditAlles/auditPid == null) and the counter strip
// (auditStats). This is always "jouw" logboek, so there is no "voor wie"
// column and no heeftWie switch either. The heading and the shared header
// row live in Lijst.tsx, same convention as every other screen.
const paper = '#F4F1E6'
const lime = '#D8F651'
const amber = '#F0A32B'
const red = '#E4483A'
const paarsAnders = '#C7A6FF'

export function Logboek({ entries, myRef }: { entries: Entry[]; myRef: string }) {
  const dagen = logboek(entries, myRef)
  const vandaag = fuifDag(new Date())

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', marginTop: 8 }}>
      {dagen.length === 0 && (
        <div style={{ margin: '16px 0 0', borderRadius: 12, background: 'rgba(244,241,230,.05)', border: '1px dashed rgba(244,241,230,.2)', padding: 18 }}>
          <div style={{ font: '400 20px/1 Anton,sans-serif', color: paper, textTransform: 'uppercase' }}>Nog niets geboekt</div>
          <div style={{ font: '400 11px/1.5 "Space Grotesk",sans-serif', color: 'rgba(244,241,230,.5)', marginTop: 6 }}>
            Zodra er streepjes op jouw naam komen, zie je hier waar ze vandaan komen.
          </div>
        </div>
      )}

      {dagen.map((d) => (
        <div key={d.dag} style={{ marginTop: 16 }}>
          <div style={{ padding: '0 0 7px', display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ font: '400 9.5px ui-monospace,monospace', letterSpacing: '.16em', color: d.dag === vandaag ? lime : 'rgba(244,241,230,.38)' }}>
              {(d.dag === vandaag ? 'VANDAAG · ' : '') + kort(d.dag)}
            </span>
            <span style={{ font: '400 9.5px ui-monospace,monospace', color: 'rgba(244,241,230,.3)', marginLeft: 'auto' }}>
              {(d.netto >= 0 ? '+' : '') + d.netto + ' streepjes' + (d.bakken ? ' · ' + d.bakken + ' BAK' : '')}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'rgba(244,241,230,.08)' }}>
            {d.regels.map((e) => {
              const isBak = e.kind === 'bak'
              const isSchrap = e.n < 0
              const zelf = myRef === 'user:' + e.by
              // Twee losse labels, niet één: een geschrapte BAK is allebei, en de
              // design (regel 1377) toont dan alleen GESCHRAPT — dan lees je niet
              // meer terug wát er weg is. Soort eerst, correctie erachter.
              const labels = [
                ...(isBak ? [{ t: Math.abs(e.n) > 1 ? 'BAKKEN' : 'BAK', fg: amber, bg: 'rgba(240,163,43,.16)' }] : []),
                ...(isSchrap ? [{ t: 'GESCHRAPT', fg: red, bg: 'rgba(228,72,58,.16)' }] : []),
              ]
              return (
                <div key={`${e.uur}-${e.by}-${e.kind}-${e.n}`} style={{ background: '#161811', padding: '11px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flex: 'none', width: 34, font: '400 10px ui-monospace,monospace', color: 'rgba(244,241,230,.34)' }}>{e.uur}u</div>
                  <div style={{ flex: 'none', minWidth: 34, font: '400 21px/1 Anton,sans-serif', color: isSchrap ? red : isBak ? amber : paper }}>
                    {(e.n >= 0 ? '+' : '−') + Math.abs(e.n)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ font: '400 10.5px/1.35 "Space Grotesk",sans-serif', color: zelf ? 'rgba(244,241,230,.42)' : paarsAnders }}>
                      {(zelf ? 'zelf gezet' : 'door ' + e.byNick) + (e.keer > 1 ? ' · ' + e.keer + ' keer dit uur' : '')}
                    </div>
                  </div>
                  {labels.map((l) => (
                    <span key={l.t} style={{ flex: 'none', font: '400 9px/1 Anton,sans-serif', letterSpacing: '.09em', padding: '5px 6px', borderRadius: 3, background: l.bg, color: l.fg }}>
                      {l.t}
                    </span>
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
