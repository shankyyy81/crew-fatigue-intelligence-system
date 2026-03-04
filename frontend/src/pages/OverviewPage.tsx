import React, { useEffect, useState, useCallback } from 'react'
import type { CrewProfile, Alert, Stats } from '../types'
import { getCrew, getAlerts, getStats, simulateAlert } from '../api'
import { CrewCard } from '../components/CrewCard'
import { AlertFeed } from '../components/AlertFeed'
import { CrewDetailDrawer } from '../components/CrewDetailDrawer'
import { RiskBadge } from '../components/RiskBadge'
import { CountdownTimer } from '../components/CountdownTimer'
import { IndiaMap } from '../components/IndiaMap'
import { showToast } from '../components/Toast'
import { Users, AlertTriangle, TrendingDown, DollarSign, Search, Zap, RefreshCw } from 'lucide-react'

function KpiCard({ icon: Icon, label, value, sub, color }: any) {
    return (
        <div className="kpi-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: `${color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${color}40` }}>
                    <Icon size={18} color={color} />
                </div>
            </div>
            <div style={{ fontSize: 26, fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1, marginBottom: 4 }}>{value}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>{label}</div>
            {sub && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>{sub}</div>}
        </div>
    )
}

export function OverviewPage() {
    const [crew, setCrew] = useState<CrewProfile[]>([])
    const [alerts, setAlerts] = useState<Alert[]>([])
    const [stats, setStats] = useState<Stats | null>(null)
    const [loading, setLoading] = useState(true)
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [search, setSearch] = useState('')
    const [tierFilter, setTierFilter] = useState<string>('')
    const [baseFilter, setBaseFilter] = useState<string>('')
    const [simulating, setSimulating] = useState(false)
    const [sharmaNextDuty, setSharmaNextDuty] = useState<string | null>(null)

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const params: Record<string, string> = {}
            if (tierFilter) params.tier = tierFilter
            if (baseFilter) params.base = baseFilter
            if (search) params.search = search
            const [crewData, alertData, statsData] = await Promise.all([
                getCrew(params), getAlerts(), getStats()
            ])
            const allCrew: CrewProfile[] = crewData.crew || []
            setCrew(allCrew)
            setAlerts(alertData.alerts || [])
            setStats(statsData)

            // Find Sharma's next duty time for the countdown
            const sharma = allCrew.find(c => c.crew_id === 'C9999')
            if (sharma?.next_duties?.[0]?.departure_time) {
                setSharmaNextDuty(sharma.next_duties[0].departure_time)
            }
        } catch (e) { console.error(e) }
        setLoading(false)
    }, [tierFilter, baseFilter, search])

    useEffect(() => { load() }, [load])

    // Auto-refresh every 30 seconds
    useEffect(() => {
        const id = setInterval(load, 30_000)
        return () => clearInterval(id)
    }, [load])

    const triggerDemo = async () => {
        setSimulating(true)
        try {
            await simulateAlert('sharma_escalation')
            await load()
            setSelectedId('C9999')
            // 🔔 Toast notification
            showToast(
                'alert',
                '🚨 CRITICAL ALERT — RED Tier Escalation',
                'Captain Priya Sharma (C9999) has crossed the RED threshold. Score 87.3. Duty DEL→LHR departing in ~14 hours. Immediate replacement action required.'
            )
        } finally { setSimulating(false) }
    }

    const BASES = ['DEL', 'BOM', 'BLR', 'MAA', 'HYD', 'COK', 'PNQ']

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

            {/* Demo Banner */}
            <div style={{ padding: '12px 20px 0' }}>
                <div className="demo-banner">
                    <AlertTriangle size={18} color="var(--tier-red)" />
                    <div style={{ flex: 1 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--tier-red)' }}>DEMO: </span>
                        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                            Captain Priya Sharma — <strong style={{ color: 'var(--tier-red)' }}>RED</strong>&nbsp;(score 87.3) — DEL→LHR
                        </span>
                        {sharmaNextDuty && (
                            <div style={{ marginTop: 4 }}>
                                <CountdownTimer targetTime={sharmaNextDuty} label="Duty departure in" size="lg" />
                            </div>
                        )}
                    </div>
                    <button
                        className="btn btn-danger"
                        onClick={triggerDemo}
                        disabled={simulating}
                        style={{ flexShrink: 0 }}
                    >
                        <Zap size={13} />
                        {simulating ? 'Activating…' : 'Activate Demo'}
                    </button>
                    <button
                        className="btn btn-ghost"
                        onClick={() => setSelectedId('C9999')}
                        style={{ flexShrink: 0, fontSize: 12 }}
                    >
                        View Sharma
                    </button>
                </div>
            </div>

            {/* KPI Row */}
            <div style={{ padding: '12px 20px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, flexShrink: 0 }}>
                <KpiCard icon={Users} label="Total Crew Tomorrow" value={stats?.total_crew ?? '—'} color="#3b82f6" />
                <KpiCard icon={TrendingDown} label="RED — High Risk" value={stats?.red_count ?? '—'}
                    sub={`${stats?.amber_count ?? 0} AMBER`} color="#ef4444" />
                <KpiCard icon={AlertTriangle} label="Cancellations Avoided" value={stats?.predicted_cancellations_avoided ?? '—'}
                    sub="Predictive interventions" color="#f59e0b" />
                <KpiCard icon={DollarSign} label="Est. Savings" value={stats ? `₹${stats.estimated_savings_inr_lakhs}L` : '—'}
                    sub="Demo impact estimate" color="#10b981" />
            </div>

            {/* Main Split */}
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden', padding: '0 20px 16px', gap: 16 }}>

                {/* Crew Grid */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    {/* Filters */}
                    <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
                        <div style={{ position: 'relative', flex: 1 }}>
                            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input
                                className="input" placeholder="Search crew name or ID…"
                                style={{ width: '100%', paddingLeft: 30 }}
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                        </div>
                        <select className="input" value={tierFilter} onChange={e => setTierFilter(e.target.value)} style={{ width: 110 }}>
                            <option value="">All Tiers</option>
                            <option value="RED">🔴 RED</option>
                            <option value="AMBER">🟡 AMBER</option>
                            <option value="GREEN">🟢 GREEN</option>
                        </select>
                        <select className="input" value={baseFilter} onChange={e => setBaseFilter(e.target.value)} style={{ width: 90 }}>
                            <option value="">All Bases</option>
                            {BASES.map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                        <button className="btn btn-ghost" onClick={load} title="Refresh">
                            <RefreshCw size={13} />
                        </button>
                    </div>

                    {/* Tier Legend */}
                    <div style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
                        {['GREEN', 'AMBER', 'RED'].map(t => (
                            <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
                                onClick={() => setTierFilter(tierFilter === t ? '' : t)}>
                                <RiskBadge tier={t as any} size="sm" />
                                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                    {crew.filter(c => c.prediction?.tier === t).length}
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* Grid */}
                    <div className="scroll-area" style={{ flex: 1 }}>
                        {loading ? (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
                                {Array.from({ length: 12 }).map((_, i) => (
                                    <div key={i} className="skeleton" style={{ height: 110 }} />
                                ))}
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
                                {crew.map(c => (
                                    <CrewCard
                                        key={c.crew_id}
                                        crew={c}
                                        onClick={() => setSelectedId(c.crew_id)}
                                        highlighted={c.crew_id === 'C9999'}
                                    />
                                ))}
                                {!crew.length && (
                                    <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                                        No crew found matching filters
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* India Map + Alert Feed */}
                <div style={{ width: 320, flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', gap: 12 }}>

                    {/* India Map */}
                    <div className="card" style={{ padding: '12px 14px', flexShrink: 0, height: 310 }}>
                        <IndiaMap onBaseClick={base => setBaseFilter(prev => prev === base ? '' : base)} />
                    </div>

                    {/* Alert feed */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <div className="section-title" style={{ marginBottom: 0 }}>LIVE ALERTS</div>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{alerts.length} events</span>
                        </div>
                        <div className="scroll-area">
                            <AlertFeed alerts={alerts} loading={loading} onCrewClick={setSelectedId} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Drawer */}
            {selectedId && (
                <CrewDetailDrawer
                    crewId={selectedId}
                    onClose={() => setSelectedId(null)}
                />
            )}
        </div>
    )
}
