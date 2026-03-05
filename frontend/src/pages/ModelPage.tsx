import React, { useEffect, useState } from 'react'
import { ModelMetrics } from '../types'
import { getModelMetrics, retrainModel } from '../api'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { RotateCcw, CheckCircle, AlertTriangle, TrendingUp, Info } from 'lucide-react'

interface MetricCardProps {
    label: string
    value: number
    color?: string
    fmt?: (v: number) => string
}

function MetricCard({ label, value, color, fmt = (v: number) => (v * 100).toFixed(1) + '%' }: MetricCardProps) {
    return (
        <div className="kpi-card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 900, color: color ?? 'var(--accent-blue)', marginBottom: 4 }}>{fmt(value)}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</div>
        </div>
    )
}

export function ModelPage() {
    const [metrics, setMetrics] = useState<ModelMetrics | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [retraining, setRetraining] = useState(false)
    const [retrained, setRetrained] = useState(false)

    useEffect(() => {
        getModelMetrics()
            .then(setMetrics)
            .catch(() => setError('Failed to load model metrics.'))
            .finally(() => setLoading(false))
    }, [])

    const handleRetrain = async () => {
        setRetraining(true)
        try {
            await retrainModel()
            setTimeout(() => { setRetrained(true); setRetraining(false) }, 1500)
        } catch { setRetraining(false) }
    }

    const cm = metrics?.confusion_matrix || [[0, 0], [0, 0]]
    const [[tn, fp], [fn, tp]] = cm

    return (
        <div style={{ padding: 24, overflow: 'auto', height: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                    <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Model Performance & Feedback</h1>
                    {metrics?.last_trained && (
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            Last trained: {new Date(metrics.last_trained).toLocaleString()}
                        </div>
                    )}
                </div>
                <button
                    className={`btn ${retrained ? 'btn-green' : 'btn-primary'}`}
                    onClick={handleRetrain}
                    disabled={retraining || retrained}
                >
                    {retrained ? <CheckCircle size={14} /> : <RotateCcw size={14} className={retraining ? 'spin' : ''} />}
                    {retrained ? 'Retrained!' : retraining ? 'Training…' : 'Retrain Model (Demo)'}
                </button>
            </div>

            {loading ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12 }}>
                    {[1, 2, 3, 4, 5].map(i => <div key={i} className="skeleton" style={{ height: 90 }} />)}
                </div>
            ) : metrics ? (
                <>
                    {/* KPI Metrics */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12, marginBottom: 24 }}>
                        <MetricCard label="ROC-AUC" value={metrics.roc_auc} color="#3b82f6" />
                        <MetricCard label="Avg Precision" value={metrics.avg_precision} color="#8b5cf6" />
                        <MetricCard label="Accuracy" value={metrics.accuracy} color="#10b981" />
                        <MetricCard label="Precision" value={metrics.precision} color="#f59e0b" />
                        <MetricCard label="Recall" value={metrics.recall} color="#ef4444" />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
                        {/* Confusion Matrix */}
                        <div className="card" style={{ padding: 20 }}>
                            <div className="section-title">CONFUSION MATRIX</div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
                                {[
                                    { label: 'True Negative', val: tn, color: 'var(--tier-green)', bg: 'rgba(16,185,129,0.1)' },
                                    { label: 'False Positive', val: fp, color: 'var(--tier-red)', bg: 'rgba(239,68,68,0.1)' },
                                    { label: 'False Negative', val: fn, color: 'var(--tier-amber)', bg: 'rgba(245,158,11,0.1)' },
                                    { label: 'True Positive', val: tp, color: 'var(--tier-green)', bg: 'rgba(16,185,129,0.15)' },
                                ].map(({ label, val, color, bg }) => (
                                    <div key={label} className="cm-cell" style={{ height: 90, background: bg, border: `1px solid ${color}30`, borderRadius: 10, flexDirection: 'column', gap: 4 }}>
                                        <span style={{ fontSize: 30, fontWeight: 900, color }}>{val}</span>
                                        <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</span>
                                    </div>
                                ))}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 12 }}>
                                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>FP: {metrics.false_positives_count} (over-flagged)</span>
                                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>FN: {metrics.false_negatives_count} (missed)</span>
                            </div>
                        </div>

                        {/* SHAP Feature Importance */}
                        <div className="card" style={{ padding: 20 }}>
                            <div className="section-title">SHAP FEATURE IMPORTANCE</div>
                            <ResponsiveContainer width="100%" height={200}>
                                <BarChart
                                    data={metrics.top_shap_features?.slice(0, 8).map(f => ({
                                        name: f.feature.replace(/_/g, ' ').slice(0, 18),
                                        val: parseFloat(f.importance.toFixed(3))
                                    }))}
                                    layout="vertical"
                                    margin={{ left: 8, right: 16, top: 4, bottom: 4 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border-subtle)" />
                                    <XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} />
                                    <YAxis type="category" dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} width={110} axisLine={false} />
                                    <Tooltip
                                        contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8 }}
                                        labelStyle={{ color: 'var(--text-primary)' }}
                                    />
                                    <Bar dataKey="val" radius={[0, 4, 4, 0]}>
                                        {metrics.top_shap_features?.slice(0, 8).map((_, i) => (
                                            <Cell key={i} fill={`hsl(${220 + i * 15}, 80%, ${60 - i * 3}%)`} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Model Info */}
                    <div className="card" style={{ padding: 20 }}>
                        <div className="section-title">MODEL DETAILS</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
                            {[
                                { label: 'Algorithm', val: 'XGBoost (3-layer ensemble)' },
                                { label: 'Training Size', val: `${metrics.train_size} samples` },
                                { label: 'Test Size', val: `${metrics.test_size} samples` },
                            ].map(({ label, val }) => (
                                <div key={label} style={{ background: 'var(--bg-primary)', borderRadius: 8, padding: '10px 14px' }}>
                                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase' }}>{label}</div>
                                    <div style={{ fontSize: 13, fontWeight: 600 }}>{val}</div>
                                </div>
                            ))}
                        </div>
                        <div style={{ marginTop: 12, padding: 12, background: 'rgba(59,130,246,0.08)', borderRadius: 8, border: '1px solid rgba(59,130,246,0.2)' }}>
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                                <strong style={{ color: 'var(--text-primary)' }}>Scoring Formula:</strong><br />
                                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>
                                    final_score = clamp(0.45 x Layer1_base + 0.45 x Layer2_ml + Layer3_behavioral_boost, 0, 100)
                                </span>
                            </div>
                        </div>
                        <div style={{ marginTop: 12, padding: 12, background: 'rgba(245,158,11,0.08)', borderRadius: 8, border: '1px solid rgba(245,158,11,0.2)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                            <Info size={16} color="var(--tier-amber)" style={{ flexShrink: 0, marginTop: 1 }} />
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                                <strong style={{ color: 'var(--tier-amber)' }}>Demo Note:</strong> This model is trained on synthetic data generated for demonstration purposes.
                                Perfect metrics (AUC 1.0) reflect the synthetic training set — production deployment would use real FDTL/FRMS crew fatigue records,
                                yielding realistic performance figures.
                            </div>
                        </div>
                    </div>
                </>
            ) : (
                <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
                    <TrendingUp size={40} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                    <div>Model metrics not available. Train the model first:</div>
                    <code style={{ fontSize: 12, background: 'var(--bg-card)', padding: '4px 8px', borderRadius: 4, marginTop: 8, display: 'inline-block' }}>python ml/train.py</code>
                </div>
            )}
        </div>
    )
}
