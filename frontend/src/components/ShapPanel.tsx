import React from 'react'
import { ShapDriver } from '../types'

interface Props { drivers: ShapDriver[] }

export function ShapPanel({ drivers }: Props) {
    if (!drivers?.length) return <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No SHAP data available</div>

    const maxImpact = Math.max(...drivers.map(d => d.abs_impact), 0.01)

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {drivers.slice(0, 10).map((d, i) => {
                const pct = (d.abs_impact / maxImpact) * 100
                const isPositive = d.impact > 0
                const color = isPositive ? 'var(--tier-red)' : 'var(--accent-blue)'
                return (
                    <div key={i}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'JetBrains Mono, monospace' }}>
                                {d.feature.replace(/_/g, ' ')}
                            </span>
                            <span style={{ fontSize: 11, fontWeight: 700, color }}>
                                {isPositive ? '+' : ''}{d.impact.toFixed(3)}
                            </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ flex: 1, height: 7, background: 'var(--bg-primary)', borderRadius: 4, overflow: 'hidden' }}>
                                <div style={{
                                    height: '100%', width: `${pct}%`, borderRadius: 4,
                                    background: isPositive
                                        ? 'linear-gradient(90deg, rgba(239,68,68,0.8), rgba(239,68,68,0.3))'
                                        : 'linear-gradient(90deg, rgba(59,130,246,0.8), rgba(59,130,246,0.3))',
                                    transition: 'width 0.6s ease',
                                }} />
                            </div>
                            <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 30, textAlign: 'right' }}>
                                {(d.abs_impact).toFixed(2)}
                            </span>
                        </div>
                    </div>
                )
            })}
            <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 20, height: 6, borderRadius: 3, background: 'rgba(239,68,68,0.7)' }} />
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Increases risk</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 20, height: 6, borderRadius: 3, background: 'rgba(59,130,246,0.7)' }} />
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Decreases risk</span>
                </div>
            </div>
        </div>
    )
}
