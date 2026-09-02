// Ported verbatim from design/Streepkeslijst App.dc.html lines 917-957 (the
// krijt/chalk tally rendering). The design also had a 'blok' variant behind a
// prop; skipped per the plan, krijt is the only one the lijst screen uses.
import type { ReactNode } from 'react'

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
