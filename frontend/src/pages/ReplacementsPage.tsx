import React, { useEffect, useState } from 'react'
import { CrewProfile, Replacement } from '../types'
import { getCrew, getReplacements, assignReplacement } from '../api'
import { RiskBadge, ScoreGauge } from '../components/RiskBadge'
import { CheckCircle, MapPin, Plane, User, Clock, Shield, AlertTriangle, WifiOff } from 'lucide-react'

export function ReplacementsPage() {
    const [redCrew, setRedCrew] = useState<CrewProfile[]>([])
    const [selected, setSelected] = useState<CrewProfile | null>(null)
    const [replacements, setReplacements] = useState<Replacement[]>([])
    const [loading, setLoading] = useState(false)
    const [assigned, setAssigned] = useState<string | null>(null)
    const [savings, setSavings] = useState<number | null>(null)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        getCrew({ tier: 'RED' }).then(r => {
            const crew: CrewProfile[] = r.crew || []
            setRedCrew(crew)
            const sharma = crew.find(c => c.crew_id === 'C9999')
            if (sharma) setSelected(sharma)
        }).catch(() => setError('Failed to load RED crew. Is the backend running?'))
    }, [])

    useEffect(() => {
        if (!selected) return
        setLoading(true)
        setAssigned(null)
        setReplacements([])
        setError(null)
        getReplacements(selected.crew_id)
            .then(r => setReplacements(r.replacements || []))
            .catch(() => setError('Failed to load replacements for this crew member.'))
            .finally(() => setLoading(false))
    }, [selected])

    const handleAssign = async (r: Replacement) => {
        if (!selected) return
        try {
            const res = await assignReplacement(selected.crew_id, r.candidate_id)
            setAssigned(r.candidate_id)
            setSavings(res.estimated_savings_inr_lakhs)
        } catch (e) { console.error(e) }
    }

    return (
        <div style={{ display: 'flex', height: '100%', overflow: 'hidden', padding: 20, gap: 20 }}>
            {/* Error Banner */}
            {error && (
                <div style={{
                    position: 'absolute', top: 20, left: 20, right: 20, zIndex: 10,
                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px',
                    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                    borderRadius: 10, fontSize: 13, color: 'var(--tier-red)',
                }}>
                    <WifiOff size={16} />
                    <span>{error}</span>
                </div>
            )}

            {/* Left: RED crew list */}
            <div style={{ width: 240, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div className="section-title">RED TIER CREW</div>
                <div className="scroll-area">
                    {redCrew.map(c => (
                        <div
                            key={c.crew_id}
                            onClick={() => setSelected(c)}
                            style={{
                                padding: '12px', borderRadius: 10, marginBottom: 6, cursor: 'pointer',
                                background: selected?.crew_id === c.crew_id ? 'rgba(239,68,68,0.1)' : 'var(--bg-card)',
                                border: `1px solid ${selected?.crew_id === c.crew_id ? 'rgba(239,68,68,0.35)' : 'var(--border-subtle)'}`,
                                transition: 'all 0.15s',
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{c.name}</span>
                                {c.crew_id === 'C9999' && (
                                    <span style={{ fontSize: 9, background: 'rgba(239,68,68,0.15)', color: 'var(--tier-red)', borderRadius: 4, padding: '1px 5px', fontWeight: 700 }}>DEMO</span>
                                )}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.base} · {c.aircraft_type}</div>
                            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--tier-red)', marginTop: 4 }}>
                                {c.prediction?.final_fatigue_score?.toFixed(0)} <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--text-muted)' }}>score</span>
                            </div>
                        </div>
                    ))}
                    {!redCrew.length && (
                        <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                            No RED crew at this time
                        </div>
                    )}
                </div>
            </div>

            {/* Right: Replacements */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {!selected ? (
                    <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
                        <Shield size={40} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                        <div>Select a RED tier crew member to find replacements</div>
                    </div>
                ) : (
                    <>
                        {/* Selected crew header */}
                        <div className="card" style={{ padding: '16px 20px', marginBottom: 16, display: 'flex', gap: 20, alignItems: 'center' }}>
                            <ScoreGauge score={selected.prediction.final_fatigue_score} size={72} />
                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                                    <h2 style={{ fontSize: 18, fontWeight: 800 }}>{selected.name}</h2>
                                    <RiskBadge tier="RED" />
                                </div>
                                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                                    {[
                                        { icon: MapPin, val: selected.base },
                                        { icon: Plane, val: selected.aircraft_type },
                                        { icon: User, val: selected.role },
                                        { icon: Clock, val: selected.next_duties?.[0] ? `Duty in ${Math.round((new Date(selected.next_duties[0].departure_time).getTime() - Date.now()) / 3600000)}h` : 'No upcoming duty' },
                                    ].map(({ icon: Icon, val }) => (
                                        <span key={val} style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                            <Icon size={11} />{val}
                                        </span>
                                    ))}
                                </div>
                            </div>
                            {assigned && (
                                <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 10, padding: '12px 16px', textAlign: 'center' }}>
                                    <CheckCircle size={24} color="var(--tier-green)" style={{ margin: '0 auto 4px' }} />
                                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--tier-green)' }}>REPLACEMENT ASSIGNED</div>
                                    {savings && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>₹{savings}L saved</div>}
                                </div>
                            )}
                        </div>

                        <div className="section-title">TOP 3 REPLACEMENT CANDIDATES</div>
                        <div className="scroll-area">
                            {loading ? (
                                [1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 110, marginBottom: 12 }} />)
                            ) : replacements.length ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    {replacements.map((r, i) => (
                                        <div key={r.candidate_id} className="repl-card" style={r.candidate_id === assigned ? { borderColor: 'var(--tier-green)', background: 'rgba(16,185,129,0.05)' } : {}}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                                                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                                                    <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--accent-blue-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: 'var(--accent-blue)' }}>
                                                        #{i + 1}
                                                    </div>
                                                    <div>
                                                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{r.candidate_name}</div>
                                                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.candidate_id} · {r.role} · {r.aircraft_type}</div>
                                                    </div>
                                                </div>
                                                <RiskBadge tier={r.candidate_id === assigned ? 'PROTECTED' : r.tier} />
                                            </div>

                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 10 }}>
                                                {[
                                                    { label: 'Fatigue Score', val: r.final_fatigue_score.toFixed(0), color: 'var(--tier-green)' },
                                                    { label: 'Reach Time', val: `${r.reach_time_hrs}h`, color: 'var(--text-primary)' },
                                                    { label: 'Hours Available', val: `${r.hours_available}h`, color: 'var(--text-primary)' },
                                                    { label: 'DGCA', val: r.dgca_compliant ? '✓ OK' : '✗ Fail', color: r.dgca_compliant ? 'var(--tier-green)' : 'var(--tier-red)' },
                                                ].map(({ label, val, color }) => (
                                                    <div key={label} style={{ textAlign: 'center', background: 'var(--bg-primary)', borderRadius: 8, padding: '8px 6px' }}>
                                                        <div style={{ fontSize: 15, fontWeight: 800, color }}>{val}</div>
                                                        <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>{label}</div>
                                                    </div>
                                                ))}
                                            </div>

                                            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.5 }}>
                                                <span style={{ color: 'var(--tier-green)', marginRight: 4 }}>✓</span>{r.why_eligible}
                                            </div>

                                            {r.candidate_id !== assigned ? (
                                                <button className="btn btn-green" style={{ width: '100%', justifyContent: 'center' }} onClick={() => handleAssign(r)}>
                                                    <CheckCircle size={13} /> Assign as Replacement
                                                </button>
                                            ) : (
                                                <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--tier-green)', fontWeight: 600 }}>
                                                    <CheckCircle size={13} style={{ display: 'inline', marginRight: 4 }} /> Assigned — Cascade Protected
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                                    <AlertTriangle size={24} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
                                    No replacement candidates found
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}
