import { useState, useEffect } from 'react'
import { Clock } from 'lucide-react'

interface Props {
    targetTime: string   // ISO timestamp of the upcoming duty
    label?: string
    size?: 'sm' | 'lg'
}

function pad(n: number) { return String(n).padStart(2, '0') }

export function CountdownTimer({ targetTime, label = 'Duty departure in', size = 'lg' }: Props) {
    const [diff, setDiff] = useState(0)

    useEffect(() => {
        const target = new Date(targetTime).getTime()
        const tick = () => setDiff(Math.max(0, target - Date.now()))
        tick()
        const id = setInterval(tick, 1000)
        return () => clearInterval(id)
    }, [targetTime])

    const totalSecs = Math.floor(diff / 1000)
    const hours = Math.floor(totalSecs / 3600)
    const minutes = Math.floor((totalSecs % 3600) / 60)
    const seconds = totalSecs % 60
    const isUrgent = hours < 6

    if (size === 'sm') {
        return (
            <span style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 12, fontWeight: 700,
                color: isUrgent ? 'var(--tier-red)' : 'var(--tier-amber)',
            }}>
                {pad(hours)}:{pad(minutes)}:{pad(seconds)}
            </span>
        )
    }

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Clock size={14} color={isUrgent ? 'var(--tier-red)' : 'var(--tier-amber)'} />
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</span>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                {[
                    { val: pad(hours), unit: 'h' },
                    { val: pad(minutes), unit: 'm' },
                    { val: pad(seconds), unit: 's' },
                ].map(({ val, unit }) => (
                    <div key={unit} style={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                        <span style={{
                            fontFamily: 'JetBrains Mono, monospace',
                            fontSize: 20, fontWeight: 900,
                            color: isUrgent ? 'var(--tier-red)' : 'var(--tier-amber)',
                            lineHeight: 1,
                            textShadow: isUrgent ? '0 0 12px rgba(239,68,68,0.5)' : 'none',
                            transition: 'color 0.5s',
                        }}>{val}</span>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', marginRight: 2 }}>{unit}</span>
                    </div>
                ))}
            </div>
            {isUrgent && (
                <span style={{
                    fontSize: 9, fontWeight: 800, letterSpacing: 1,
                    color: 'var(--tier-red)', background: 'rgba(239,68,68,0.1)',
                    border: '1px solid rgba(239,68,68,0.3)', borderRadius: 4, padding: '2px 6px',
                    animation: 'pulse-red 1.5s infinite',
                }}>CRITICAL</span>
            )}
        </div>
    )
}
