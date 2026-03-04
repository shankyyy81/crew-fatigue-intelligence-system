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
            display: 'flex', gap: 14, alignItems: 'flex-start',
            background: toast.type === 'alert' ? 'rgba(239,68,68,0.15)' : c.bg,
            border: `2px solid ${c.border}`,
            borderRadius: 14, padding: toast.type === 'alert' ? '20px' : '14px 16px',
            boxShadow: toast.type === 'alert'
                ? `0 12px 40px rgba(239,68,68,0.4), 0 0 0 2px rgba(239,68,68,0.5)`
                : `0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px ${c.border}`,
            animation: toast.type === 'alert'
                ? 'toast-drama 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards, toast-shake 0.4s 0.6s'
                : 'toast-in 0.4s cubic-bezier(0.34,1.56,0.64,1)',
            minWidth: 340, maxWidth: 440,
            backdropFilter: 'blur(12px)',
            position: 'relative',
            overflow: 'hidden'
        }}>
            {toast.type === 'alert' && (
                <div style={{
                    position: 'absolute', inset: 0,
                    background: 'linear-gradient(45deg, transparent, rgba(239,68,68,0.1), transparent)',
                    animation: 'toast-shimmer 2s infinite linear'
                }} />
            )}
            <div style={{
                width: toast.type === 'alert' ? 44 : 36,
                height: toast.type === 'alert' ? 44 : 36,
                borderRadius: 12, background: `${c.color}20`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                border: toast.type === 'alert' ? `1px solid ${c.color}60` : 'none',
                boxShadow: toast.type === 'alert' ? `0 0 15px ${c.color}40` : 'none',
                zIndex: 1
            }}>
                <Icon size={toast.type === 'alert' ? 24 : 18} color={c.color} />
            </div>
            <div style={{ flex: 1, zIndex: 1, marginTop: toast.type === 'alert' ? 2 : 0 }}>
                <div style={{
                    fontSize: toast.type === 'alert' ? 16 : 13,
                    fontWeight: toast.type === 'alert' ? 800 : 700,
                    color: toast.type === 'alert' ? '#fff' : 'var(--text-primary)',
                    marginBottom: 4, letterSpacing: toast.type === 'alert' ? 0.5 : 0,
                    textShadow: toast.type === 'alert' ? '0 2px 4px rgba(0,0,0,0.5)' : 'none'
                }}>{toast.title}</div>
                <div style={{
                    fontSize: toast.type === 'alert' ? 14 : 12,
                    color: toast.type === 'alert' ? 'rgba(255,255,255,0.9)' : 'var(--text-secondary)',
                    lineHeight: 1.5, fontWeight: toast.type === 'alert' ? 500 : 400
                }}>{toast.message}</div>
            </div>
            <button onClick={() => onRemove(toast.id)} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: toast.type === 'alert' ? 'rgba(255,255,255,0.6)' : 'var(--text-muted)',
                padding: 4, flexShrink: 0, zIndex: 1, transition: 'color 0.2s'
            }} onMouseEnter={(e) => e.currentTarget.style.color = '#fff'} onMouseLeave={(e) => e.currentTarget.style.color = toast.type === 'alert' ? 'rgba(255,255,255,0.6)' : 'var(--text-muted)'}>
                <X size={16} />
            </button>
        </div>
    )
}

export function ToastContainer() {
    const [toasts, setToasts] = useState<Toast[]>([])

    useEffect(() => {
        _setToasts = setToasts
        return () => {
            // Only clear if this exact setter is still the active one (fixes React 18 StrictMode issue)
            if (_setToasts === setToasts) {
                _setToasts = null
            }
        }
    }, [])

    const remove = useCallback((id: number) => {
        setToasts(prev => prev.filter(t => t.id !== id))
    }, [])

    if (!toasts.length) return null

    return (
        <>
            <style>{`
        @keyframes toast-in {
          0% { opacity: 0; transform: translateX(100%) scale(0.9); }
          100% { opacity: 1; transform: translateX(0) scale(1); }
        }
        @keyframes toast-drama {
          0% { opacity: 0; transform: translateX(120%) scale(0.5) rotate(10deg); filter: brightness(2); }
          60% { opacity: 1; transform: translateX(-5%) scale(1.05) rotate(-2deg); filter: brightness(1.2); }
          80% { transform: translateX(2%) scale(0.98) rotate(1deg); }
          100% { opacity: 1; transform: translateX(0) scale(1) rotate(0deg); filter: brightness(1); }
        }
        @keyframes toast-shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-4px); }
          40%, 80% { transform: translateX(4px); }
        }
        @keyframes toast-shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
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
