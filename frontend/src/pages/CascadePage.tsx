import React, { useEffect, useState } from 'react'
import { CascadeFlight, CrewProfile } from '../types'
import { getCrew, getCascade } from '../api'
import { RiskBadge } from '../components/RiskBadge'
import { Plane, Shield, AlertTriangle, Users, ToggleLeft, ToggleRight } from 'lucide-react'

export function CascadePage() {
    const [redCrew, setRedCrew] = useState<CrewProfile[]>([])
    const [selected, setSelected] = useState<string>('C9999')
    const [cascade, setCascade] = useState<any | null>(null)
    const [loading, setLoading] = useState(false)
    const [showProtected, setShowProtected] = useState(false)

    useEffect(() => {
        getCrew({ tier: 'RED' }).then(r => {
            const crew = r.crew || []
            setRedCrew(crew)
        })
    }, [])

    useEffect(() => {
        if (!selected) return
        setLoading(true)
        getCascade(selected)
            .then(setCascade)
            .catch(() => setCascade(null))
            .finally(() => setLoading(false))
    }, [selected])

    const flights: CascadeFlight[] = cascade?.cascade_flights || []
    const displayed = showProtected ? flights : flights.filter(f => !f.protected)

    const riskColor = (level: string) => level === 'HIGH' ? 'var(--tier-red)' : level === 'MEDIUM' ? 'var(--tier-amber)' : '#3b82f6'
    const riskBg = (level: string) => level === 'HIGH' ? 'rgba(239,68,68,0.1)' : level === 'MEDIUM' ? 'rgba(245,158,11,0.1)' : 'rgba(59,130,246,0.1)'

    return (
        <div style={{ display: 'flex', height: '100%', overflow: 'hidden', padding: 20, gap: 20 }}>
            {/* Left: crew selector */}
            <div style={{ width: 220, flexShrink: 0 }}>
                <div className="section-title">SELECT RED CREW</div>
                <div className="scroll-area" style={{ maxHeight: '80vh' }}>
                    {redCrew.map(c => (
                        <div key={c.crew_id} onClick={() => setSelected(c.crew_id)}
                            style={{
                                padding: '10px 12px', borderRadius: 8, marginBottom: 6, cursor: 'pointer',
                                background: selected === c.crew_id ? 'rgba(239,68,68,0.1)' : 'var(--bg-card)',
                                border: `1px solid ${selected === c.crew_id ? 'rgba(239,68,68,0.35)' : 'var(--border-subtle)'}`,
                            }}>
                            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 2 }}>{c.name}</div>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{c.base} · {c.aircraft_type}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Right: cascade timeline */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {/* Header stats */}
                {cascade && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
                        {[
                            { label: 'Total Flights', val: cascade.total_flights, color: '#3b82f6', icon: Plane },
                            { label: 'At Risk', val: cascade.at_risk, color: 'var(--tier-red)', icon: AlertTriangle },
                            { label: 'Protected', val: cascade.protected, color: 'var(--tier-green)', icon: Shield },
                            { label: 'Pax Impacted', val: cascade.estimated_passengers_impacted, color: 'var(--tier-amber)', icon: Users },
                        ].map(({ label, val, color, icon: Icon }) => (
                            <div key={label} className="kpi-card" style={{ padding: 14 }}>
                                <Icon size={18} color={color} style={{ marginBottom: 8 }} />
                                <div style={{ fontSize: 22, fontWeight: 800, color }}>{val}</div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Toggle */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div className="section-title" style={{ marginBottom: 0 }}>AFFECTED FLIGHTS TIMELINE</div>
                    <button className="btn btn-ghost" onClick={() => setShowProtected(!showProtected)} style={{ fontSize: 11, gap: 6 }}>
                        {showProtected ? <ToggleRight size={15} color="var(--tier-green)" /> : <ToggleLeft size={15} />}
                        {showProtected ? 'Showing All' : 'Hiding Protected'}
                    </button>
                </div>

                <div className="scroll-area">
                    {loading ? (
                        [1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 80, marginBottom: 10 }} />)
                    ) : displayed.length ? (
                        <div style={{ position: 'relative' }}>
                            {/* Timeline line */}
                            <div style={{ position: 'absolute', left: 20, top: 20, bottom: 20, width: 2, background: 'var(--border-subtle)' }} />
                            {displayed.map((f, i) => (
                                <div key={i} className="cascade-item" style={{ paddingLeft: 46, position: 'relative' }}>
                                    <div style={{
                                        position: 'absolute', left: 15, top: 16,
                                        width: 12, height: 12, borderRadius: '50%',
                                        background: f.protected ? 'var(--tier-green)' : riskColor(f.risk_level),
                                        border: '2px solid var(--bg-secondary)',
                                        boxShadow: `0 0 8px ${f.protected ? 'rgba(16,185,129,0.4)' : riskColor(f.risk_level)}`,
                                    }} />
                                    <div style={{ flex: 1, background: f.protected ? 'rgba(16,185,129,0.05)' : riskBg(f.risk_level), borderRadius: 10, padding: '12px 16px', border: `1px solid ${f.protected ? 'rgba(16,185,129,0.2)' : 'var(--border-subtle)'}` }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{f.flight_id}</span>
                                                {f.protected ? (
                                                    <span style={{ background: 'rgba(16,185,129,0.15)', color: 'var(--tier-green)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 4, fontSize: 10, padding: '2px 8px', fontWeight: 700 }}>🛡 PROTECTED</span>
                                                ) : (
                                                    <span style={{ background: riskBg(f.risk_level), color: riskColor(f.risk_level), borderRadius: 4, fontSize: 10, padding: '2px 8px', fontWeight: 700 }}>{f.risk_level} RISK</span>
                                                )}
                                            </div>
                                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                                {new Date(f.departure_time).toLocaleString('en-IN', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', gap: 16 }}>
                                            <span style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                                <Plane size={11} /> {f.route}
                                            </span>
                                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{f.station}</span>
                                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>✈ {f.aircraft}</span>
                                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>👤 {f.passengers} pax</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                            <Shield size={32} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
                            <div>No cascade events found for selected crew</div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
