import React, { useEffect, useState } from 'react'
import { CrewProfile } from '../types'
import { getCrewDetail } from '../api'
import { RiskBadge, ScoreGauge } from './RiskBadge'
import { FatigueChart } from './FatigueChart'
import { ShapPanel } from './ShapPanel'
import { X, MapPin, Plane, User, Moon, Activity, Calendar, TrendingUp } from 'lucide-react'

interface Props {
    crewId: string | null
    onClose: () => void
}

export function CrewDetailDrawer({ crewId, onClose }: Props) {
    const [crew, setCrew] = useState<CrewProfile | null>(null)
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (!crewId) return
        setLoading(true)
        setCrew(null)
        getCrewDetail(crewId)
            .then(setCrew)
            .catch(console.error)
            .finally(() => setLoading(false))
    }, [crewId])

    if (!crewId) return null

    return (
        <div className="drawer-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="drawer">
                {/* Header */}
                <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'sticky', top: 0, background: 'var(--bg-secondary)', zIndex: 10 }}>
                    {loading ? (
                        <div>
                            <div className="skeleton" style={{ height: 20, width: 200, marginBottom: 8 }} />
                            <div className="skeleton" style={{ height: 14, width: 100 }} />
                        </div>
                    ) : crew ? (
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                                <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>{crew.name}</h2>
                                {crew.is_demo && (
                                    <span style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--tier-red)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, fontSize: 10, padding: '2px 8px', fontWeight: 700 }}>DEMO</span>
                                )}
                            </div>
                            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                                <span style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <MapPin size={11} /> {crew.base}
                                </span>
                                <span style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <User size={11} /> {crew.role}
                                </span>
                                <span style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <Plane size={11} /> {crew.aircraft_type}
                                </span>
                                <RiskBadge tier={crew.prediction.tier} />
                            </div>
                        </div>
                    ) : null}
                    <button className="btn btn-ghost" onClick={onClose} style={{ padding: '6px 8px' }}>
                        <X size={16} />
                    </button>
                </div>

                {loading ? (
                    <div style={{ padding: 24 }}>
                        {[80, 200, 150, 120].map((h, i) => (
                            <div key={i} className="skeleton" style={{ height: h, marginBottom: 16 }} />
                        ))}
                    </div>
                ) : crew ? (
                    <div style={{ padding: 24 }}>

                        {/* Score Overview */}
                        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', marginBottom: 24 }}>
                            <ScoreGauge score={crew.prediction.final_fatigue_score} size={100} />
                            <div style={{ flex: 1 }}>
                                <div className="section-title" style={{ marginBottom: 12 }}>LAYER BREAKDOWN</div>
                                {[
                                    { label: 'Layer 1 — Biomathematical Base', val: crew.prediction.fatigue_base_score, color: '#3b82f6' },
                                    { label: 'Layer 2 — ML Enrichment', val: crew.prediction.fatigue_ml_score, color: '#8b5cf6' },
                                    { label: 'Layer 3 — Behavioral Boost', val: crew.prediction.behavioral_boost, max: 15, color: '#f59e0b' },
                                ].map(({ label, val, color, max = 100 }) => (
                                    <div key={label} style={{ marginBottom: 10 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{label}</span>
                                            <span style={{ fontSize: 12, fontWeight: 700, color }}>{val.toFixed(1)}</span>
                                        </div>
                                        <div className="score-bar-track">
                                            <div className="score-bar-fill" style={{ width: `${(val / max) * 100}%`, background: color }} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="divider" />

                        {/* Profile */}
                        <div style={{ marginBottom: 20 }}>
                            <div className="section-title">CREW PROFILE</div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                {[
                                    { icon: Moon, label: 'Habitual Sleep', val: `${crew.habitual_sleep_start} – ${crew.habitual_sleep_end}` },
                                    { icon: Activity, label: 'Sick Leave (90d)', val: `${crew.sick_leave_last_90_days} days` },
                                    { icon: TrendingUp, label: 'Unfit Risk', val: `${(crew.prediction.unfit_risk_probability * 100).toFixed(0)}%` },
                                    { icon: Calendar, label: 'Consecutive Days', val: `${crew.features.consecutive_duty_days ?? '--'} days` },
                                ].map(({ icon: Icon, label, val }) => (
                                    <div key={label} style={{ background: 'var(--bg-card)', borderRadius: 8, padding: '10px 12px', border: '1px solid var(--border-subtle)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                            <Icon size={11} color="var(--text-muted)" />
                                            <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</span>
                                        </div>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{val}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="divider" />

                        {/* Fatigue Trajectory */}
                        <div style={{ marginBottom: 20 }}>
                            <div className="section-title">7-DAY FATIGUE TRAJECTORY</div>
                            <FatigueChart data={crew.trajectory} />
                        </div>

                        <div className="divider" />

                        {/* SHAP */}
                        <div style={{ marginBottom: 20 }}>
                            <div className="section-title">EXPLAINABILITY — TOP RISK DRIVERS</div>
                            <ShapPanel drivers={crew.prediction.shap_drivers} />
                        </div>

                        <div className="divider" />

                        {/* Next Duties */}
                        <div>
                            <div className="section-title">UPCOMING DUTIES</div>
                            {crew.next_duties.slice(0, 3).map((duty, i) => (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                                    <div>
                                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
                                            {Array.isArray(duty.route) ? duty.route.join(' → ') : duty.route}
                                        </div>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                            {duty.duty_id} · {duty.aircraft_type} · {duty.duration_hrs}h
                                        </div>
                                    </div>
                                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', textAlign: 'right' }}>
                                        {new Date(duty.departure_time).toLocaleString('en-IN', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Crew not found</div>
                )}
            </div>
        </div>
    )
}
