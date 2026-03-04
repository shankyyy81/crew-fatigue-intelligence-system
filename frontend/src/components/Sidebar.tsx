import React from 'react'
import { NavLink } from 'react-router-dom'
import {
    LayoutDashboard, Shuffle, GitBranch, BarChart2, Zap, TrendingUp
} from 'lucide-react'

const nav = [
    { to: '/', icon: LayoutDashboard, label: 'Overview' },
    { to: '/replacements', icon: Shuffle, label: 'Replacements' },
    { to: '/cascade', icon: GitBranch, label: 'Cascade Impact' },
    { to: '/roi', icon: TrendingUp, label: 'ROI & Impact' },
    { to: '/model', icon: BarChart2, label: 'Model Performance' },
]

export function Sidebar() {
    return (
        <div className="sidebar">
            {/* Logo */}
            <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                        width: 36, height: 36, borderRadius: 10,
                        background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 4px 12px rgba(59,130,246,0.4)',
                    }}>
                        <Zap size={18} color="#fff" />
                    </div>
                    <div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2 }}>CFIS</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.5px' }}>FATIGUE INTELLIGENCE</div>
                    </div>
                </div>
            </div>

            {/* Nav */}
            <nav style={{ padding: '12px 0', flex: 1 }}>
                {nav.map(({ to, icon: Icon, label }) => (
                    <NavLink
                        key={to}
                        to={to}
                        end={to === '/'}
                        className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                    >
                        <Icon size={16} />
                        <span>{label}</span>
                    </NavLink>
                ))}
            </nav>

            {/* Footer */}
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', marginBottom: 8 }}>
                <div style={{
                    background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                    borderRadius: 8, padding: '8px 10px', fontSize: 11,
                }}>
                    <div style={{ color: 'var(--tier-red)', fontWeight: 700, marginBottom: 2 }}>🔴 DEMO ACTIVE</div>
                    <div style={{ color: 'var(--text-muted)' }}>C9999 · Sharma · RED</div>
                </div>
            </div>
            <div style={{ padding: '0 16px 12px' }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center' }}>
                    IndiGo Ops Intelligence · v1.0
                </div>
            </div>
        </div>
    )
}
