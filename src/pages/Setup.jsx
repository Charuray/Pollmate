import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { getClubName, setClubName, getVoterName, setVoterName, saveUserProfile } from '../lib/firebase'

export default function Setup() {
  const nav = useNavigate()
  const { user } = useAuth()
  const [club, setClub]   = useState(getClubName())
  const [name, setName]   = useState(getVoterName() === 'Anonymous' ? '' : getVoterName())
  const [saving, setSaving] = useState(false)
  const [err, setErr]     = useState('')

  // If already have club name, skip setup
  useEffect(() => {
    if (getClubName()) nav('/home', { replace: true })
  }, [])

  const save = async () => {
    if (!club.trim()) { setErr('Please enter your club name'); return }
    setSaving(true)
    const voterName = name.trim() || user?.displayName || 'Anonymous'
    setClubName(club.trim())
    setVoterName(voterName)
    if (user) {
      try { await saveUserProfile(club.trim(), voterName) } catch {}
    }
    nav('/home', { replace: true })
  }

  return (
    <div style={{
      minHeight: 'calc(100vh - 60px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 72, height: 72, borderRadius: 20, background: 'var(--primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 36, fontWeight: 700, color: '#fff',
            margin: '0 auto 16px',
          }}>P</div>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.5px', marginBottom: 6 }}>
            Welcome to PollMate
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text2)' }}>
            Quick setup before you start
          </p>
        </div>

        <div className="form-group">
          <label className="label">Your club name *</label>
          <input
            className="input"
            placeholder="e.g. ACM Student Chapter"
            value={club}
            onChange={e => setClub(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && save()}
            maxLength={60}
            autoFocus
          />
          <p className="hint">This appears on every poll you create</p>
        </div>

        <div className="form-group">
          <label className="label">Your name {user ? '(from Google)' : ''}</label>
          <input
            className="input"
            placeholder={user?.displayName || 'e.g. Arjun Kumar'}
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && save()}
            maxLength={50}
          />
          <p className="hint">Shown when you vote on named polls</p>
        </div>

        {err && <p className="error-msg">{err}</p>}

        <button className="btn btn-primary btn-lg btn-block" onClick={save} disabled={saving}>
          {saving ? 'Saving...' : 'Get started →'}
        </button>
      </div>
    </div>
  )
}
