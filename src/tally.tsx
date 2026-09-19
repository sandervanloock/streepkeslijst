// Ported verbatim from design/Streepkeslijst App.dc.html lines 917-957 (the
// krijt/chalk tally rendering). The design also had a 'blok' variant behind a
// prop; skipped per the plan, krijt is the only one the lijst screen uses.
import { useRef, type ReactNode } from 'react'

// TASK-12: the hold duration and the tik/bak sounds, moved here from Lijst.tsx
// so the real row (Lijst.tsx) and the Welkomstrondje's demo row (Rondje.tsx)
// share the exact same numbers and cannot drift apart.
export const HOLD_MS = 620

/** TASK-17: verschuift de vinger verder dan dit tijdens het drukken, dan was het
 *  een scroll en geen tik. Zelfde drempel op de lijst en in het Welkomstrondje. */
export const SLEEP_PX = 10
export type Punt = { clientX: number; clientY: number }

/** Design lines 958-974: a WebAudio noise burst + a vibrate, gated by the sound toggle. */
export function useKlik(geluid: boolean) {
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

const j = (i: number) => {
  const x = Math.sin(i * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

export function tally(count: number, kleur = '#F4F1E6') {
  const h = 30
  const gap = 6.6
  const groupGap = 13
  const sw = 3.4
  const shown = Math.min(count, 20)
  const extra = count - shown
  const groups: number[] = []
  let rem = shown
  while (rem > 0) {
    const n = Math.min(5, rem)
    groups.push(n)
    rem -= n
  }
  const lines: ReactNode[] = []
  let x = 3
  let idx = 0
  groups.forEach((n, gi) => {
    const bars = n === 5 ? 4 : n
    const startX = x
    for (let i = 0; i < bars; i++) {
      const jx = j(idx) * 1.8 - 0.9
      const tilt = j(idx + 7) * 3.4 - 1.7
      lines.push(
        <line
          key={'b' + idx + '_' + count}
          x1={x + jx + tilt}
          y1={3.5 + j(idx + 3) * 1.6}
          x2={x + jx - tilt}
          y2={h - 3.5 - j(idx + 5) * 1.6}
          stroke={kleur}
          strokeWidth={sw}
          strokeLinecap="round"
          style={idx === shown - 1 ? { animation: 'chalkIn .22s ease-out' } : undefined}
        />,
      )
      x += gap
      idx++
    }
    if (n === 5) {
      const endX = startX + 3 * gap
      lines.push(
        <line
          key={'c' + gi + '_' + count}
          x1={startX - 3.5}
          y1={h - 5}
          x2={endX + 3.5}
          y2={5}
          stroke={kleur}
          strokeWidth={sw}
          strokeLinecap="round"
        />,
      )
    }
    x += groupGap - gap
  })
  let w = Math.max(x + 2, 6)
  if (extra > 0) {
    const label = 'en ' + extra + ' meer'
    lines.push(
      <text key="x" x={w + 5} y={h - 9} fill={kleur} fontSize={10} fontWeight={500} opacity={0.6}>
        {label}
      </text>,
    )
    w += 12 + label.length * 5.4
  }
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block', overflow: 'visible' }}>
      {lines}
    </svg>
  )
}
