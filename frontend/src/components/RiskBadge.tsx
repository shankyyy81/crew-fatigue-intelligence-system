import React from 'react'
import { Tier } from '../types'
import { AlertTriangle, CheckCircle, Circle } from 'lucide-react'

interface Props {
    tier: Tier
    size?: 'sm' | 'md' | 'lg'
    pulse?: boolean
}

const config = {
    GREEN: { cls: 'badge-green', dot: '#10b981', label: 'GREEN' },
    AMBER: { cls: 'badge-amber', dot: '#f59e0b', label: 'AMBER' },
    RED: { cls: 'badge-red', dot: '#ef4444', label: 'RED' },
    PROTECTED: { cls: 'badge-green', dot: '#10b981', label: 'PROTECTED' },
}

export function RiskBadge({ tier, size = 'md' }: Props) {
    const c = config[tier] || config.GREEN
    const sz = size === 'sm' ? 8 : size === 'lg' ? 14 : 10
    return (
        <span className={`badge ${c.cls}`}>
            <span style={{ width: sz, height: sz, borderRadius: '50%', background: c.dot, display: 'inline-block' }} />
            {c.label}
        </span>
    )
}

interface ScoreBarProps { score: number; width?: number }
export function ScoreBar({ score, width = 100 }: ScoreBarProps) {
    const color = score > 80 ? '#ef4444' : score > 60 ? '#f59e0b' : '#10b981'
    return (
        <div className="score-bar-track" style={{ width }}>
            <div className="score-bar-fill" style={{ width: `${score}%`, background: color }} />
        </div>
    )
}

interface ScoreGaugeProps { score: number; size?: number }
export function ScoreGauge({ score, size = 80 }: ScoreGaugeProps) {
    const color = score > 80 ? '#ef4444' : score > 60 ? '#f59e0b' : '#10b981'
    const r = (size - 12) / 2
    const circ = 2 * Math.PI * r
    const dash = (score / 100) * circ

    return (
        <div style={{ position: 'relative', width: size, height: size }}>
            <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--bg-primary)" strokeWidth={8} />
                <circle
                    cx={size / 2} cy={size / 2} r={r} fill="none"
                    stroke={color} strokeWidth={8}
                    strokeDasharray={`${dash} ${circ - dash}`}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dasharray 0.8s ease', filter: `drop-shadow(0 0 6px ${color})` }}
                />
            </svg>
            <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
            }}>
                <span style={{ fontSize: size * 0.22, fontWeight: 800, color }}>{Math.round(score)}</span>
                <span style={{ fontSize: size * 0.13, color: 'var(--text-muted)', marginTop: -2 }}>/ 100</span>
            </div>
        </div>
    )
}
