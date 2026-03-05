import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts'
import type { TrajectoryPoint } from '../types'

interface Props { data: TrajectoryPoint[] }

interface TooltipProps {
    active?: boolean
    payload?: { value: number }[]
    label?: string
}

const CustomTooltip = ({ active, payload, label }: TooltipProps) => {
    if (!active || !payload?.length) return null
    const score = payload[0]?.value as number
    const color = score > 80 ? '#ef4444' : score > 60 ? '#f59e0b' : '#10b981'
    return (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 16, fontWeight: 800, color }}>{score.toFixed(1)}</div>
        </div>
    )
}

export function FatigueChart({ data }: Props) {
    if (!data?.length) return <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No trajectory data</div>

    const chartData = data.map(d => ({
        date: d.date.slice(5),  // MM-DD
        score: d.final_fatigue_score,
        tier: d.tier,
    }))

    const dot = (props: { cx: number; cy: number; payload: { score: number } }) => {
        const { cx, cy, payload } = props
        const color = payload.score > 80 ? '#ef4444' : payload.score > 60 ? '#f59e0b' : '#10b981'
        return <circle key={`dot-${cx}-${cy}`} cx={cx} cy={cy} r={5} fill={color} stroke="var(--bg-secondary)" strokeWidth={2} />
    }

    return (
        <ResponsiveContainer width="100%" height={160}>
            <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={80} stroke="rgba(239,68,68,0.4)" strokeDasharray="4 4" label={{ value: 'RED', fill: 'var(--tier-red)', fontSize: 9, position: 'right' }} />
                <ReferenceLine y={60} stroke="rgba(245,158,11,0.4)" strokeDasharray="4 4" label={{ value: 'AMBER', fill: 'var(--tier-amber)', fontSize: 9, position: 'right' }} />
                <Line
                    type="monotone" dataKey="score"
                    stroke="url(#scoreGrad)" strokeWidth={2.5}
                    dot={dot} activeDot={true}
                />
                <defs>
                    <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ef4444" />
                        <stop offset="50%" stopColor="#f59e0b" />
                        <stop offset="100%" stopColor="#10b981" />
                    </linearGradient>
                </defs>
            </LineChart>
        </ResponsiveContainer>
    )
}
