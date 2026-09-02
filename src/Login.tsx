import { useState } from 'react'
import { signIn } from './auth'
import { tally } from './tally'

// Ported from design/Login.dc.html (the phone screen inside the iOS frame).
// The design's ios-frame.jsx is device chrome and support.js is the Design
// Components runtime, so neither has anything to port. Skipped from the design:
// the Google account-picker sheet (the real popup is Google's own UI) and the
// 'welkom' step (App.tsx swaps to Lijst the moment auth resolves).
const paper = '#F4F1E6'
const lime = '#D8F651'
const red = '#E4483A'

/** Design lines 47-53: the lime app mark, three chalk bars in a rounded square. */
function Merk() {
  return (
    <div
      style={{
        width: 34,
        height: 34,
        borderRadius: 8,
        background: lime,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        gap: 2.5,
        paddingBottom: 8,
        flex: 'none',
      }}
    >
      {[
        [15, -4],
        [17, 3],
        [14, -2],
      ].map(([h, deg]) => (
        <div key={deg} style={{ width: 2.5, height: h, background: '#121310', borderRadius: 2, transform: `rotate(${deg}deg)` }} />
      ))}
    </div>
  )
}

/** The multi-colour Google G, clipped out of a gradient (design lines 96-98). */
function GoogleG({ size = 28 }: { size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 99,
        background: '#fff',
        border: '1px solid rgba(18,19,16,.12)',
        display: 'grid',
        placeItems: 'center',
        flex: 'none',
      }}
    >
      <span
        style={{
          font: `700 ${size * 0.54}px/1 "Space Grotesk",sans-serif`,
          background: 'linear-gradient(135deg,#4285F4 0%,#4285F4 30%,#EA4335 45%,#FBBC05 65%,#34A853 100%)',
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          color: 'transparent',
        }}
      >
        G
      </span>
    </div>
  )
}

const UITLEG = [
  'Een beheerder mailt een uitnodiging naar je Google-adres.',
  'Jij logt in met datzelfde adres — geen wachtwoord om te vergeten.',
  'Je hangt meteen aan de juiste groep, met de rechten die de beheerder je gaf.',
]

export function Login() {
  const [error, setError] = useState<string>()
  const [bezig, setBezig] = useState(false)
  const [uitleg, setUitleg] = useState(false)

  const onClick = () => {
    setError(undefined)
    setBezig(true)
    // The popup resolving means App.tsx is about to swap us out for Lijst, so
    // only the failure path has to put the button back.
    signIn().catch((e) => {
      setBezig(false)
      setError(e instanceof Error ? e.message : String(e))
    })
  }

  return (
    <main
      style={{
        boxSizing: 'border-box',
        minHeight: '100dvh',
        color: paper,
        display: 'flex',
        flexDirection: 'column',
        padding: '74px 24px calc(40px + env(safe-area-inset-bottom))',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Design lines 38-44: oversized tally scratched into the top-right corner. */}
      <div style={{ position: 'absolute', top: 104, right: -30, display: 'flex', alignItems: 'flex-end', gap: 12, opacity: 0.12, pointerEvents: 'none' }}>
        {[
          [112, -4],
          [118, 2],
          [106, -2],
          [120, 5],
        ].map(([h, deg]) => (
          <div key={deg} style={{ width: 5, height: h, borderRadius: 3, background: lime, transform: `rotate(${deg}deg)` }} />
        ))}
        <div style={{ position: 'absolute', left: 0, top: 26, width: 86, height: 5, borderRadius: 3, background: lime, transform: 'rotate(36deg)' }} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <Merk />
        <div style={{ font: '400 9.5px ui-monospace,monospace', letterSpacing: '.16em', color: 'rgba(244,241,230,.4)' }}>CHIRO ELZESTRAAT</div>
      </div>

      <h1 style={{ margin: '24px 0 0', font: '400 52px/0.88 Anton,sans-serif', color: paper, textTransform: 'uppercase', letterSpacing: '-.01em' }}>
        Streepkes
        <br />
        lijst
      </h1>
      <div style={{ marginTop: 13, font: '400 13px/1.55 "Space Grotesk",sans-serif', color: 'rgba(244,241,230,.55)', maxWidth: 268 }}>
        {bezig
          ? 'Even geduld — we kijken of dit account in de groep zit.'
          : 'De streepjeslijst van je groep, op zak. Meld je aan met het Google-account waarop je uitnodiging is toegekomen.'}
      </div>

      <div style={{ flex: 1, minHeight: 18 }} />

      {error && (
        <div
          role="alert"
          style={{
            marginBottom: 12,
            border: `1px solid ${red}`,
            borderRadius: 12,
            background: 'rgba(228,72,58,.13)',
            padding: 15,
            animation: 'chalkIn .45s ease both',
          }}
        >
          <div style={{ font: '400 15px/1 Anton,sans-serif', letterSpacing: '.03em', color: red, textTransform: 'uppercase' }}>Aanmelden mislukt</div>
          <div style={{ marginTop: 8, font: '400 12px/1.55 "Space Grotesk",sans-serif', color: 'rgba(244,241,230,.62)' }}>{error}</div>
        </div>
      )}

      {bezig ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            height: 58,
            padding: '0 20px',
            boxSizing: 'border-box',
            borderRadius: 99,
            background: 'rgba(244,241,230,.08)',
            border: '1px solid rgba(244,241,230,.14)',
            animation: 'fadeIn .3s ease both',
          }}
        >
          <div style={{ display: 'flex', gap: 5, alignItems: 'center', flex: 'none' }}>
            {[0, 0.15, 0.3].map((d) => (
              <div key={d} style={{ width: 6, height: 6, borderRadius: 99, background: lime, animation: `spinPulse .9s ease-in-out ${d}s infinite` }} />
            ))}
          </div>
          <span style={{ font: '500 12.5px "Space Grotesk",sans-serif', color: 'rgba(244,241,230,.75)' }}>Google-account controleren…</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Design lines 61-84: a peek at the lijst, so the first screen shows what it is. */}
          <div style={{ border: '1px solid rgba(244,241,230,.12)', borderRadius: 12, background: '#1B1D17', padding: '13px 14px' }}>
            <div style={{ font: '400 9px ui-monospace,monospace', letterSpacing: '.16em', color: 'rgba(244,241,230,.35)' }}>ZO ZIET HET ER BINNEN UIT</div>
            <div style={{ marginTop: 11, display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 30, height: 30, borderRadius: 99, background: lime, color: '#121310', font: '700 12px/30px "Space Grotesk",sans-serif', textAlign: 'center', flex: 'none' }}>
                W
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: '400 16px/1 Anton,sans-serif', color: paper, textTransform: 'uppercase' }}>Wollie</div>
                <div style={{ marginTop: 4 }}>{tally(3)}</div>
              </div>
              <div style={{ textAlign: 'right', flex: 'none' }}>
                <div style={{ font: '400 22px/0.9 Anton,sans-serif', color: paper }}>3</div>
                <div style={{ font: '500 8.5px "Space Grotesk",sans-serif', letterSpacing: '.06em', color: 'rgba(244,241,230,.4)' }}>STREEPJES</div>
              </div>
            </div>
          </div>

          <button
            onClick={onClick}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 11,
              width: '100%',
              height: 58,
              padding: 0,
              border: 'none',
              borderRadius: 99,
              background: paper,
              cursor: 'pointer',
              boxShadow: '0 12px 34px rgba(0,0,0,.42)',
            }}
          >
            <GoogleG />
            <span style={{ font: '400 16px/1 Anton,sans-serif', color: '#121310', letterSpacing: '.03em', textTransform: 'uppercase' }}>Doorgaan met Google</span>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
            <div style={{ font: '400 10px/1.5 ui-monospace,monospace', letterSpacing: '.1em', color: 'rgba(244,241,230,.35)' }}>ENKEL OP UITNODIGING</div>
            <div style={{ width: 3, height: 3, borderRadius: 99, background: 'rgba(244,241,230,.25)' }} />
            <button
              onClick={() => setUitleg(true)}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                font: '500 11px "Space Grotesk",sans-serif',
                color: lime,
                cursor: 'pointer',
                textDecoration: 'underline',
                textUnderlineOffset: 3,
              }}
            >
              waarom?
            </button>
          </div>
        </div>
      )}

      {uitleg && (
        <>
          <div onClick={() => setUitleg(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(10,11,9,.62)', animation: 'fadeIn .2s ease both' }} />
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              background: '#1B1D17',
              borderTop: '1px solid rgba(244,241,230,.14)',
              borderRadius: '20px 20px 0 0',
              padding: '18px 20px 30px',
              animation: 'sheetUp .3s cubic-bezier(.2,.9,.25,1) both',
            }}
          >
            <div style={{ width: 38, height: 4, borderRadius: 99, background: 'rgba(244,241,230,.2)', margin: '0 auto 16px' }} />
            <div style={{ font: '400 22px/1 Anton,sans-serif', color: paper, textTransform: 'uppercase' }}>Waarom enkel op uitnodiging?</div>
            <div style={{ marginTop: 10, font: '400 12.5px/1.6 "Space Grotesk",sans-serif', color: 'rgba(244,241,230,.6)' }}>
              Op de lijst staat wie wat moet betalen. Daarom komt er niemand binnen die er niet hoort: een beheerder mailt je Google-adres, jij logt in met
              datzelfde adres en je zit erin.
            </div>
            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 9 }}>
              {UITLEG.map((tekst, i) => (
                <div key={tekst} style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
                  <div style={{ font: '400 13px/1 Anton,sans-serif', color: lime, flex: 'none', width: 14, paddingTop: 2 }}>{i + 1}</div>
                  <div style={{ font: '400 12px/1.5 "Space Grotesk",sans-serif', color: 'rgba(244,241,230,.7)' }}>{tekst}</div>
                </div>
              ))}
            </div>
            <button
              onClick={() => setUitleg(false)}
              style={{
                marginTop: 18,
                width: '100%',
                height: 52,
                border: 'none',
                borderRadius: 99,
                background: paper,
                color: '#121310',
                font: '400 15px/1 Anton,sans-serif',
                letterSpacing: '.03em',
                textTransform: 'uppercase',
                cursor: 'pointer',
              }}
            >
              Duidelijk
            </button>
          </div>
        </>
      )}
    </main>
  )
}
