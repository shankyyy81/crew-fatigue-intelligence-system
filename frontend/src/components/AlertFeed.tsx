import React from 'react'
import { Alert } from '../types'
import { RiskBadge } from './RiskBadge'
import { Bell, AlertTriangle, ChevronRight, Clock } from 'lucide-react'

interface Props {
    alerts: Alert[]
    loading?: boolean
    onCrewClick?: (id: string) => void
}

function timeAgo(ts: string) {
    const diff = (Date.now() - new Date(ts + 'Z').getTime()) / 1000
    if (diff < 60) return `${Math.round(diff)}s ago`
    if (diff < 3600) return `${Math.round(diff / 60)}m ago`
    return `${Math.round(diff / 3600)}h ago`
}

export function AlertFeed({ alerts, loading, onCrewClick }: Props) {
    if (loading) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="skeleton" style={{ height: 70 }} />
                ))}
            </div>
        )
    }
    if (!alerts.length) {
        return (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)' }}>
                <Bell size={28} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
                <div style={{ fontSize: 13 }}>No active alerts</div>
            </div>
        )
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {alerts.map((a, i) => (
                <div
                    key={i}
                    className={`alert-item alert-${a.tier_to.toLowerCase()}`}
                    onClick={() => onCrewClick?.(a.crew_id)}
                    style={{ cursor: onCrewClick ? 'pointer' : 'default' }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {a.tier_to === 'RED' && <AlertTriangle size={13} color="var(--tier-red)" />}
                            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                                {a.crew_name}
                            </span>
                            <ChevronRight size={10} color="var(--text-muted)" />
                            <RiskBadge tier={a.tier_from} size="sm" />
                            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>→</span>
                            <RiskBadge tier={a.tier_to} size="sm" />
                        </div>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                            <Clock size={10} /> {timeAgo(a.timestamp)}
                        </span>
                    </div>
                    <p style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.4, marginBottom: 6 }}>
                        {a.reason.length > 100 ? a.reason.slice(0, 97) + '…' : a.reason}
                    </p>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {a.top_factors.map(f => (
                            <span key={f} style={{
                                background: 'var(--bg-primary)', border: '1px solid var(--border)',
                                borderRadius: 4, fontSize: 10, padding: '2px 6px', color: 'var(--text-muted)',
                            }}>{f}</span>
                        ))}
                        <span style={{
                            marginLeft: 'auto', fontSize: 10, padding: '2px 8px',
                            borderRadius: 4,
                            background: a.status === 'resolved' ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
                            color: a.status === 'resolved' ? 'var(--tier-green)' : 'var(--tier-amber)',
                        }}>
                            {a.status}
                        </span>
                    </div>
                </div>
            ))}
        </div>
    )
}
