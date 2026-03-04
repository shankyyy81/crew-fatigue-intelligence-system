import { useState, useEffect, useCallback } from 'react'
import { AlertTriangle, X, CheckCircle, Info } from 'lucide-react'

export type ToastType = 'alert' | 'success' | 'info'

interface Toast {
    id: number
    type: ToastType
    title: string
    message: string
    duration?: number
}

// Global toast state (simple singleton)
let _setToasts: React.Dispatch<React.SetStateAction<Toast[]>> | null = null
let _counter = 0

export function showToast(type: ToastType, title: string, message: string, duration = 6000) {
    if (_setToasts) {
        const id = ++_counter
        _setToasts(prev => [...prev, { id, type, title, message, duration }])
    }
}

const config = {
    alert: { icon: AlertTriangle, color: 'var(--tier-red)', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.35)' },
    success: { icon: CheckCircle, color: 'var(--tier-green)', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.35)' },
    info: { icon: Info, color: 'var(--accent-blue)', 'bg': 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.35)' },
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: number) => void }) {
    const c = config[toast.type]
    const Icon = c.icon

    useEffect(() => {
        const t = setTimeout(() => onRemove(toast.id), toast.duration ?? 6000)
        return () => clearTimeout(t)
    }, [toast.id, toast.duration, onRemove])

    return (
        <div style={{
            display: 'flex', gap: 12, alignItems: 'flex-start',
            background: c.bg, border: `1px solid ${c.border}`,
            borderRadius: 12, padding: '14px 16px',
            boxShadow: `0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px ${c.border}`,
            animation: 'toast-in 0.35s cubic-bezier(0.34,1.56,0.64,1)',
            minWidth: 340, maxWidth: 420,
            backdropFilter: 'blur(8px)',
        }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: `${c.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={18} color={c.color} />
            </div>
            <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 3 }}>{toast.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{toast.message}</div>
            </div>
            <button onClick={() => onRemove(toast.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, flexShrink: 0 }}>
                <X size={14} />
            </button>
        </div>
    )
}

export function ToastContainer() {
    const [toasts, setToasts] = useState<Toast[]>([])

    useEffect(() => {
        _setToasts = setToasts
        return () => { _setToasts = null }
    }, [])

    const remove = useCallback((id: number) => {
        setToasts(prev => prev.filter(t => t.id !== id))
    }, [])

    if (!toasts.length) return null

    return (
        <>
            <style>{`
        @keyframes toast-in {
          from { opacity: 0; transform: translateX(100%) scale(0.9); }
          to   { opacity: 1; transform: translateX(0) scale(1); }
        }
      `}</style>
            <div style={{
                position: 'fixed', top: 20, right: 20, zIndex: 1000,
                display: 'flex', flexDirection: 'column', gap: 10,
            }}>
                {toasts.map(t => <ToastItem key={t.id} toast={t} onRemove={remove} />)}
            </div>
        </>
    )
}
