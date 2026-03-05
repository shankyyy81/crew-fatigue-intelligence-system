import React from 'react'
import { CrewProfile } from '../types'
import { RiskBadge, ScoreBar } from './RiskBadge'
import { MapPin, Plane, User } from 'lucide-react'

interface Props {
    crew: CrewProfile
    onClick?: () => void
    highlighted?: boolean
}

export const CrewCard = React.memo(function CrewCard({ crew, onClick, highlighted }: Props) {
    const { prediction, name, crew_id, base, role, aircraft_type } = crew
    const tier = prediction?.tier || 'GREEN'

    return (
        <div
            className={`crew-card tier-${tier.toLowerCase()}`}
            onClick={onClick}
            onKeyDown={e => e.key === 'Enter' && onClick?.()}
            role="button"
            tabIndex={0}
            aria-label={`${name} (${crew_id}) — ${tier} tier, fatigue score ${prediction?.final_fatigue_score?.toFixed(0) ?? 'unknown'}`}
            style={highlighted ? { borderColor: 'var(--tier-red)', boxShadow: '0 0 16px rgba(239,68,68,0.25)' } : {}}
        >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>
                        {name}
                    </div>
                    <div className="mono" style={{ fontSize: 10, color: 'var(--text-muted)' }}>{crew_id}</div>
                </div>
                <RiskBadge tier={tier} size="sm" />
            </div>

            {/* Meta */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 3 }}>
                    <MapPin size={10} /> {base}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 3 }}>
                    <Plane size={10} /> {aircraft_type}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 3 }}>
                    <User size={10} /> {role}
                </span>
            </div>

            {/* Score */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Fatigue Score</span>
                <span style={{
                    fontSize: 14, fontWeight: 800,
                    color: tier === 'RED' ? 'var(--tier-red)' : tier === 'AMBER' ? 'var(--tier-amber)' : 'var(--tier-green)',
                }}>
                    {prediction?.final_fatigue_score?.toFixed(0) ?? '--'}
                </span>
            </div>
            <ScoreBar score={prediction?.final_fatigue_score || 0} />
        </div>
    )
})
