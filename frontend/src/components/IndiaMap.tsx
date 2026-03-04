import { useEffect, useState } from 'react'
import { getCrew } from '../api'
import type { CrewProfile } from '../types'

// Geographic positions mapped to SVG viewBox="0 0 340 440"
// x = (lon - 67.5) / 30 * 310 + 15
// y = (37.5 - lat) / 30 * 410 + 10
const BASES: Record<string, { x: number; y: number; label: string; city: string }> = {
    DEL: { x: 114, y: 131, label: 'DEL', city: 'New Delhi' },
    BOM: { x: 71, y: 256, label: 'BOM', city: 'Mumbai' },
    BLR: { x: 119, y: 334, label: 'BLR', city: 'Bangalore' },
    MAA: { x: 146, y: 336, label: 'MAA', city: 'Chennai' },
    HYD: { x: 129, y: 281, label: 'HYD', city: 'Hyderabad' },
    COK: { x: 105, y: 374, label: 'COK', city: 'Kochi' },
    PNQ: { x: 81, y: 262, label: 'PNQ', city: 'Pune' },
}

// Simplified India outline path (SVG viewBox 0 0 340 440)
const INDIA_PATH = `
  M 152,8 L 170,10 L 195,14 L 218,12 L 238,18 L 255,14 L 272,22
  L 282,34 L 292,50 L 298,68 L 290,82 L 275,86 L 268,100
  L 282,116 L 296,132 L 308,148 L 310,164 L 300,178 L 285,188
  L 272,196 L 262,208 L 255,222 L 248,236 L 242,248 L 238,258
  L 228,264 L 225,274 L 230,286 L 220,302 L 208,316 L 194,330
  L 180,346 L 168,362 L 158,378 L 150,395 L 144,412 L 140,428
  L 136,415 L 128,398 L 116,378 L 100,356 L 84,332 L 70,310
  L 54,288 L 40,264 L 30,244 L 22,222 L 16,200 L 12,178
  L 10,156 L 12,134 L 18,112 L 16,92  L 24,72  L 36,56
  L 50,44  L 66,34  L 84,24  L 106,16 L 130,10 Z
`

// Inner state name decorators (very light, just for atmosphere)
const STATE_DOTS = [
    { x: 155, y: 60 }, { x: 200, y: 75 }, { x: 260, y: 90 },
    { x: 130, y: 100 }, { x: 175, y: 120 }, { x: 235, y: 130 },
    { x: 80, y: 140 }, { x: 150, y: 175 }, { x: 210, y: 170 },
    { x: 55, y: 200 }, { x: 120, y: 220 }, { x: 185, y: 210 },
    { x: 90, y: 300 }, { x: 160, y: 295 }, { x: 75, y: 360 },
]

interface BaseStats { total: number; red: number; amber: number; green: number }

export function IndiaMap({ onBaseClick }: { onBaseClick?: (base: string) => void }) {
    const [stats, setStats] = useState<Record<string, BaseStats>>({})
    const [hovered, setHovered] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        getCrew({ limit: '300' } as any).then(r => {
            const crew: CrewProfile[] = r.crew || []
            const s: Record<string, BaseStats> = {}
            for (const c of crew) {
                const b = c.base
                if (!b) continue
                if (!s[b]) s[b] = { total: 0, red: 0, amber: 0, green: 0 }
                s[b].total++
                const tier = c.prediction?.tier?.toLowerCase() as 'red' | 'amber' | 'green'
                if (tier) s[b][tier]++
            }
            setStats(s)
        }).finally(() => setLoading(false))
    }, [])

    const tierColor = (s: BaseStats) => {
        const redPct = s.red / s.total
        if (redPct > 0.5) return { fill: '#ef4444', glow: 'rgba(239,68,68,0.6)', text: '#fca5a5' }
        if (redPct > 0.2) return { fill: '#f59e0b', glow: 'rgba(245,158,11,0.6)', text: '#fcd34d' }
        return { fill: '#10b981', glow: 'rgba(16,185,129,0.5)', text: '#6ee7b7' }
    }

    const bubbleR = (s: BaseStats) => Math.max(16, Math.min(32, 10 + s.red * 3 + s.total * 0.2))

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <div className="section-title" style={{ padding: '0 0 8px' }}>FLEET RISK — INDIA BASE MAP</div>

            {loading ? (
                <div className="skeleton" style={{ width: '100%', height: 380, borderRadius: 12 }} />
            ) : (
                <svg
                    viewBox="0 0 340 440"
                    style={{ width: '100%', height: '100%', maxHeight: 440 }}
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <defs>
                        {Object.keys(BASES).map(b => {
                            const s = stats[b]
                            if (!s) return null
                            const c = tierColor(s)
                            return (
                                <radialGradient key={b} id={`glow-${b}`} cx="50%" cy="50%" r="50%">
                                    <stop offset="0%" stopColor={c.glow} stopOpacity="0.9" />
                                    <stop offset="100%" stopColor={c.glow} stopOpacity="0" />
                                </radialGradient>
                            )
                        })}
                        <filter id="drop-shadow">
                            <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.4" />
                        </filter>
                    </defs>

                    {/* India map fill */}
                    <path
                        d={INDIA_PATH}
                        fill="rgba(15,25,45,0.85)"
                        stroke="rgba(59,130,246,0.3)"
                        strokeWidth="1.2"
                        strokeLinejoin="round"
                    />

                    {/* Subtle state grid dots */}
                    {STATE_DOTS.map((d, i) => (
                        <circle key={i} cx={d.x} cy={d.y} r={1.2} fill="rgba(59,130,246,0.15)" />
                    ))}

                    {/* Connector lines between major hubs */}
                    {[['DEL', 'BOM'], ['DEL', 'BLR'], ['DEL', 'HYD'], ['BOM', 'BLR'], ['BOM', 'HYD'], ['BLR', 'MAA'], ['HYD', 'MAA'], ['BLR', 'COK']].map(([a, b]) => {
                        const A = BASES[a], B = BASES[b]
                        return (
                            <line key={`${a}-${b}`}
                                x1={A.x} y1={A.y} x2={B.x} y2={B.y}
                                stroke="rgba(59,130,246,0.12)" strokeWidth="0.8" strokeDasharray="3 4"
                            />
                        )
                    })}

                    {/* Base bubbles */}
                    {Object.entries(BASES).map(([code, pos]) => {
                        const s = stats[code] || { total: 0, red: 0, amber: 0, green: 0 }
                        const c = tierColor(s)
                        const r = bubbleR(s)
                        const isHover = hovered === code

                        return (
                            <g
                                key={code}
                                style={{ cursor: 'pointer' }}
                                onClick={() => onBaseClick?.(code)}
                                onMouseEnter={() => setHovered(code)}
                                onMouseLeave={() => setHovered(null)}
                            >
                                {/* Glow halo */}
                                <circle cx={pos.x} cy={pos.y} r={r * 2.2} fill={`url(#glow-${code})`} opacity={isHover ? 1 : 0.65} />

                                {/* Pulse ring (animated via CSS) */}
                                {s.red > 0 && (
                                    <circle cx={pos.x} cy={pos.y} r={r + 6}
                                        fill="none" stroke={c.fill} strokeWidth="1"
                                        opacity="0.4" strokeDasharray="3 3"
                                        style={{ animation: 'spin 8s linear infinite', transformOrigin: `${pos.x}px ${pos.y}px` }}
                                    />
                                )}

                                {/* Main bubble */}
                                <circle
                                    cx={pos.x} cy={pos.y} r={r}
                                    fill={c.fill + '25'}
                                    stroke={c.fill}
                                    strokeWidth={isHover ? 2.5 : 1.5}
                                    filter={isHover ? 'url(#drop-shadow)' : undefined}
                                    style={{ transition: 'all 0.2s' }}
                                />

                                {/* RED crew count in center */}
                                <text
                                    x={pos.x} y={pos.y - 1}
                                    textAnchor="middle" dominantBaseline="middle"
                                    fill={c.fill} fontSize={r > 22 ? 12 : 10} fontWeight="900"
                                    fontFamily="JetBrains Mono, monospace"
                                >
                                    {s.red}
                                </text>
                                <text
                                    x={pos.x} y={pos.y + (r > 22 ? 10 : 9)}
                                    textAnchor="middle" dominantBaseline="middle"
                                    fill="rgba(255,255,255,0.45)" fontSize="6" fontWeight="600"
                                >
                                    RED
                                </text>

                                {/* Airport code label */}
                                <text
                                    x={pos.x} y={pos.y + r + 12}
                                    textAnchor="middle"
                                    fill={isHover ? c.text : 'rgba(200,215,240,0.85)'}
                                    fontSize="9" fontWeight="700"
                                    fontFamily="JetBrains Mono, monospace"
                                    style={{ transition: 'fill 0.2s' }}
                                >
                                    {code}
                                </text>

                                {/* Hover tooltip */}
                                {isHover && s.total > 0 && (
                                    <g>
                                        <rect
                                            x={pos.x + r + 5} y={pos.y - 30}
                                            width={100} height={68}
                                            rx={6} ry={6}
                                            fill="rgba(13,20,40,0.95)"
                                            stroke={c.fill + '60'}
                                            strokeWidth="1"
                                        />
                                        <text x={pos.x + r + 10} y={pos.y - 16} fill={c.text} fontSize="9" fontWeight="800">{pos.city}</text>
                                        <text x={pos.x + r + 10} y={pos.y - 4} fill="#ef4444" fontSize="8">🔴 RED:   {s.red}</text>
                                        <text x={pos.x + r + 10} y={pos.y + 8} fill="#f59e0b" fontSize="8">🟡 AMBER: {s.amber}</text>
                                        <text x={pos.x + r + 10} y={pos.y + 20} fill="#10b981" fontSize="8">🟢 GREEN: {s.green}</text>
                                        <text x={pos.x + r + 10} y={pos.y + 32} fill="rgba(140,160,200,0.7)" fontSize="7.5">Total: {s.total}</text>
                                    </g>
                                )}
                            </g>
                        )
                    })}

                    {/* Legend */}
                    <g transform="translate(8, 8)">
                        <rect x="0" y="0" width="82" height="56" rx="6"
                            fill="rgba(10,16,28,0.85)" stroke="rgba(59,130,246,0.2)" strokeWidth="1" />
                        <text x="6" y="13" fill="rgba(140,160,200,0.7)" fontSize="7" fontWeight="700" style={{ textTransform: 'uppercase' as const }}>BUBBLE SIZE</text>
                        <text x="6" y="24" fill="rgba(200,215,240,0.8)" fontSize="7">= # RED crew at base</text>
                        {[
                            { c: '#ef4444', l: '>50% RED crew' },
                            { c: '#f59e0b', l: '>20% RED crew' },
                            { c: '#10b981', l: 'Safe base' },
                        ].map(({ c, l }, i) => (
                            <g key={l} transform={`translate(6,${32 + i * 9})`}>
                                <circle r="3" cx="3" cy="3" fill={c + '40'} stroke={c} strokeWidth="1" />
                                <text x="10" y="6" fill="rgba(180,200,230,0.75)" fontSize="7">{l}</text>
                            </g>
                        ))}
                    </g>
                </svg>
            )}

            <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
        </div>
    )
}
