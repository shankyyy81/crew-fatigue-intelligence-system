import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Sidebar } from './components/Sidebar'
import { OverviewPage } from './pages/OverviewPage'
import { ReplacementsPage } from './pages/ReplacementsPage'
import { CascadePage } from './pages/CascadePage'
import { ModelPage } from './pages/ModelPage'

export default function App() {
  return (
    <BrowserRouter>
      <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
        <Sidebar />
        <main style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {/* TopBar */}
          <div style={{
            height: 48, borderBottom: '1px solid var(--border-subtle)',
            display: 'flex', alignItems: 'center', padding: '0 20px',
            justifyContent: 'space-between', flexShrink: 0,
            background: 'var(--bg-secondary)',
          }}>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              ✈ IndiGo Crew Operations · Fatigue Intelligence System
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px #10b981' }} />
                <span style={{ fontSize: 11, color: 'var(--tier-green)', fontWeight: 600 }}>LIVE</span>
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
              </span>
            </div>
          </div>

          {/* Page content */}
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <Routes>
              <Route path="/" element={<OverviewPage />} />
              <Route path="/replacements" element={<ReplacementsPage />} />
              <Route path="/cascade" element={<CascadePage />} />
              <Route path="/model" element={<ModelPage />} />
            </Routes>
          </div>
        </main>
      </div>
    </BrowserRouter>
  )
}
