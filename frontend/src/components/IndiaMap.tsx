import React from 'react'
import { useState } from 'react'

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

// India mainland silhouette (hand-tuned for this viewBox)
const INDIA_PATH = `
  M 132,18
  C 146,10 164,8 182,12
  C 197,15 212,16 226,14
  C 239,12 251,18 261,28
  C 272,39 282,54 289,69
  C 294,81 296,95 292,106
  C 287,118 279,124 272,130
  C 282,136 294,145 305,158
  C 314,170 314,182 306,192
  C 296,205 281,210 268,217
  C 262,224 258,233 256,242
  C 253,253 250,263 243,271
  C 236,279 228,285 225,295
  C 223,307 216,319 206,329
  C 196,340 188,350 181,361
  C 174,374 170,387 167,399
  C 164,411 160,423 155,433
  C 151,428 148,421 145,413
  C 140,402 134,390 126,378
  C 117,365 109,351 99,336
  C 90,322 81,308 73,295
  C 63,281 53,264 45,245
  C 37,226 31,207 29,188
  C 27,169 28,152 32,137
  C 35,124 40,111 42,99
  C 43,86 47,74 55,64
  C 64,53 76,45 89,38
  C 102,31 116,25 132,18 Z

  M 266,130
  C 279,128 292,129 304,134
  C 314,139 321,146 324,156
  C 321,159 317,160 313,159
  C 305,156 296,153 287,153
  C 278,153 271,151 266,146
  C 262,141 262,135 266,130 Z
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

interface IndiaMapProps {
    crewByBase?: Record<string, BaseStats>
    onBaseClick?: (base: string) => void
}

export const IndiaMap = React.memo(function IndiaMap({ crewByBase, onBaseClick }: IndiaMapProps) {
    const stats = crewByBase ?? {}
    const [hovered, setHovered] = useState<string | null>(null)
    const hasData = Object.keys(stats).length > 0

    const tierColor = (s: BaseStats) => {
        const redPct = s.red / s.total
        if (redPct > 0.5) return { fill: '#ef4444', glow: 'rgba(239,68,68,0.45)', text: '#b91c1c' }
        if (redPct > 0.2) return { fill: '#f59e0b', glow: 'rgba(245,158,11,0.45)', text: '#92400e' }
        return { fill: '#10b981', glow: 'rgba(16,185,129,0.4)', text: '#047857' }
    }

    const bubbleR = (s: BaseStats) => Math.max(16, Math.min(32, 10 + s.red * 3 + s.total * 0.2))

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <div className="section-title" style={{ padding: '0 0 8px' }}>FLEET RISK — INDIA BASE MAP</div>

            {!hasData ? (
                <div className="skeleton" style={{ width: '100%', height: 380, borderRadius: 12 }} />
            ) : (
                <svg
                    viewBox="0 0 340 440"
                    style={{ width: '100%', height: '100%', maxHeight: 440 }}
                    xmlns="http://www.w3.org/2000/svg"
                    role="img"
                    aria-label="India base map showing crew fatigue risk by airport"
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
                        fill="rgba(232, 240, 255, 0.95)"
                        stroke="rgba(0, 27, 148, 0.3)"
                        strokeWidth="1.2"
                        strokeLinejoin="round"
                    />

                    {/* Subtle state grid dots */}
                    {STATE_DOTS.map((d, i) => (
                        <circle key={i} cx={d.x} cy={d.y} r={1.2} fill="rgba(0, 27, 148, 0.16)" />
                    ))}

                    {/* Connector lines between major hubs */}
                    {[['DEL', 'BOM'], ['DEL', 'BLR'], ['DEL', 'HYD'], ['BOM', 'BLR'], ['BOM', 'HYD'], ['BLR', 'MAA'], ['HYD', 'MAA'], ['BLR', 'COK']].map(([a, b]) => {
                        const A = BASES[a], B = BASES[b]
                        return (
                            <line key={`${a}-${b}`}
                                x1={A.x} y1={A.y} x2={B.x} y2={B.y}
                                stroke="rgba(0, 27, 148, 0.16)" strokeWidth="0.8" strokeDasharray="3 4"
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
                                role="button"
                                tabIndex={0}
                                aria-label={`${code} base: ${s.red} RED, ${s.amber} AMBER, ${s.green} GREEN crew`}
                                onClick={() => onBaseClick?.(code)}
                                onKeyDown={e => e.key === 'Enter' && onBaseClick?.(code)}
                                onMouseEnter={() => setHovered(code)}
                                onMouseLeave={() => setHovered(null)}
                                onFocus={() => setHovered(code)}
                                onBlur={() => setHovered(null)}
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
                                    fill="rgba(11, 27, 82, 0.62)" fontSize="6" fontWeight="700"
                                >
                                    RED
                                </text>

                                {/* Airport code label */}
                                <text
                                    x={pos.x} y={pos.y + r + 12}
                                    textAnchor="middle"
                                    fill={isHover ? c.text : 'rgba(53, 80, 163, 0.9)'}
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
                                            fill="rgba(255,255,255,0.97)"
                                            stroke={c.fill + '60'}
                                            strokeWidth="1"
                                        />
                                        <text x={pos.x + r + 10} y={pos.y - 16} fill={c.text} fontSize="9" fontWeight="800">{pos.city}</text>
                                        <text x={pos.x + r + 10} y={pos.y - 4} fill="#ef4444" fontSize="8">RED:   {s.red}</text>
                                        <text x={pos.x + r + 10} y={pos.y + 8} fill="#f59e0b" fontSize="8">AMBER: {s.amber}</text>
                                        <text x={pos.x + r + 10} y={pos.y + 20} fill="#10b981" fontSize="8">GREEN: {s.green}</text>
                                        <text x={pos.x + r + 10} y={pos.y + 32} fill="rgba(53, 80, 163, 0.82)" fontSize="7.5">Total: {s.total}</text>
                                    </g>
                                )}
                            </g>
                        )
                    })}

                    {/* Legend */}
                    <g transform="translate(8, 8)">
                        <rect x="0" y="0" width="82" height="56" rx="6"
                            fill="rgba(255,255,255,0.95)" stroke="rgba(0, 27, 148, 0.2)" strokeWidth="1" />
                        <text x="6" y="13" fill="rgba(95, 118, 187, 0.9)" fontSize="7" fontWeight="700" style={{ textTransform: 'uppercase' as const }}>BUBBLE SIZE</text>
                        <text x="6" y="24" fill="rgba(53, 80, 163, 0.9)" fontSize="7">= # RED crew at base</text>
                        {[
                            { c: '#ef4444', l: '>50% RED crew' },
                            { c: '#f59e0b', l: '>20% RED crew' },
                            { c: '#10b981', l: 'Safe base' },
                        ].map(({ c, l }, i) => (
                            <g key={l} transform={`translate(6,${32 + i * 9})`}>
                                <circle r="3" cx="3" cy="3" fill={c + '40'} stroke={c} strokeWidth="1" />
                                <text x="10" y="6" fill="rgba(53, 80, 163, 0.82)" fontSize="7">{l}</text>
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
})
