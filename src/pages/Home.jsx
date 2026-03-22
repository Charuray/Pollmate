import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db, getOpts, getClubName, hasVoted, deletePoll, isCreator } from '../lib/firebase'
import { useAuth } from '../lib/AuthContext'

function timeLeft(dl) {
  if (!dl) return null
  const end = dl.toDate ? dl.toDate() : new Date(dl)
  const ms = end.getTime() - Date.now()
  if (ms <= 0) return null
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  if (h >= 24) return `${Math.floor(h / 24)}d left`
  if (h > 0) return `${h}h ${m}m left`
  return `${m}m left`
}

export default function Home() {
  const nav = useNavigate()
  const { user } = useAuth()  // triggers re-render when auth loads
  const [polls, setPolls]     = useState([])
  const [loading, setLoading] = useState(true)
  const [votedSet, setVotedSet] = useState(new Set())
  const [tab, setTab]         = useState('active')
  const [joinId, setJoinId]   = useState('')
  const [showJoin, setShowJoin] = useState(false)
  const [deleting, setDeleting] = useState(null)

  // Read club name reactively — re-reads when user/auth changes
  const club = getClubName()

  useEffect(() => {
    const q = query(collection(db, 'polls'), orderBy('createdAt', 'desc'))
    return onSnapshot(q, snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setPolls(data)
      const v = new Set()
      data.forEach(p => { if (hasVoted(p.id)) v.add(p.id) })
      setVotedSet(v)
      setLoading(false)
    })
  }, [])

  const handleDelete = async (e, pollId) => {
    e.stopPropagation()
    if (!window.confirm('Delete this poll permanently? This cannot be undone.')) return
    setDeleting(pollId)
    try {
      await deletePoll(pollId)
    } catch (err) {
      alert('Could not delete: ' + (err?.message || 'unknown error'))
    } finally {
      setDeleting(null)
    }
  }

  const active = polls.filter(p => p.isOpen)
  const closed = polls.filter(p => !p.isOpen)
  const display = tab === 'active' ? active : closed
  const totalVotes = polls.reduce((s, p) => s + (p.totalVotes || 0), 0)

  if (loading) return <div className="page"><div className="spinner" /></div>

  return (
    <div className="page">
      <div className="container">

        {/* Header */}
        <div className="row between wrap gap-2 mb-3" style={{ alignItems:'flex-end' }}>
          <div>
            <h1 className="page-title">{club || 'Your Club'}</h1>
            <p className="page-sub">
              {user ? `Signed in as ${user.displayName}` : 'Manage and vote on polls'}
            </p>
          </div>
          <button className="btn btn-primary btn-lg" onClick={() => nav('/create')}>
            + Create Poll
          </button>
        </div>

        {/* No club name warning */}
        {!club && (
          <div style={{
            background:'var(--warn-l)', border:'1px solid var(--warn)',
            borderRadius:12, padding:'12px 16px', marginBottom:20,
            display:'flex', alignItems:'center', gap:12,
          }}>
            <span style={{ fontSize:18 }}>⚠️</span>
            <div style={{ flex:1 }}>
              <p style={{ fontSize:14, fontWeight:600, color:'#92400E' }}>No club name set</p>
              <p style={{ fontSize:12, color:'#92400E', marginTop:2 }}>
                Polls created without a club name will show blank. Set it in setup.
              </p>
            </div>
            <button className="btn btn-sm" style={{ background:'#92400E', color:'#fff', border:'none' }}
              onClick={() => nav('/setup')}>
              Set up →
            </button>
          </div>
        )}

        {/* Stats */}
        {polls.length > 0 && (
          <div className="stats-row">
            <div className="stat-card">
              <div className="stat-num">{active.length}</div>
              <div className="stat-lbl">Active polls</div>
            </div>
            <div className="stat-card">
              <div className="stat-num">{closed.length}</div>
              <div className="stat-lbl">Closed polls</div>
            </div>
            <div className="stat-card">
              <div className="stat-num">{totalVotes}</div>
              <div className="stat-lbl">Total votes</div>
            </div>
            <div className="stat-card">
              {showJoin ? (
                <div className="join-row">
                  <input
                    className="join-input"
                    placeholder="Paste poll ID..."
                    value={joinId}
                    onChange={e => setJoinId(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && joinId.trim() && nav(`/poll/${joinId.trim()}`)}
                    autoFocus
                  />
                  <button className="btn btn-primary btn-sm"
                    onClick={() => joinId.trim() && nav(`/poll/${joinId.trim()}`)}>Go</button>
                  <button className="btn btn-ghost btn-sm"
                    onClick={() => { setShowJoin(false); setJoinId('') }}>✕</button>
                </div>
              ) : (
                <div style={{ cursor:'pointer' }} onClick={() => setShowJoin(true)}>
                  <div className="stat-lbl">Join by Poll ID</div>
                  <div style={{ fontSize:16, color:'var(--primary)', fontWeight:600, marginTop:4 }}>
                    Tap to enter →
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="mb-2">
          <div className="tabs" style={{ width:280 }}>
            <button className={`tab-btn${tab === 'active' ? ' active' : ''}`}
              onClick={() => setTab('active')}>Active ({active.length})</button>
            <button className={`tab-btn${tab === 'closed' ? ' active' : ''}`}
              onClick={() => setTab('closed')}>Closed ({closed.length})</button>
          </div>
        </div>

        {/* Poll grid */}
        {display.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">🗳️</div>
            <div className="empty-title">{tab === 'active' ? 'No active polls' : 'No closed polls'}</div>
            <p className="empty-sub">
              {tab === 'active' ? 'Create the first poll for your club' : 'Closed polls appear here'}
            </p>
            {tab === 'active' && (
              <button className="btn btn-primary" onClick={() => nav('/create')}>Create a poll</button>
            )}
          </div>
        ) : (
          <div className="poll-grid">
            {display.map(poll => {
              const voted   = votedSet.has(poll.id)
              const tl      = poll.isOpen ? timeLeft(poll.deadline) : null
              const opts    = getOpts(poll.options)
              const creator = isCreator(poll.id)
              const isDel   = deleting === poll.id

              return (
                <div
                  key={poll.id}
                  className="card card-clickable poll-card"
                  style={{ position:'relative' }}
                  onClick={() => nav(voted || !poll.isOpen ? `/results/${poll.id}` : `/poll/${poll.id}`)}
                >
                  {/* Delete button — only for creator */}
                  {creator && (
                    <button
                      onClick={e => handleDelete(e, poll.id)}
                      disabled={isDel}
                      style={{
                        position:'absolute', top:10, right:10,
                        width:26, height:26, borderRadius:13,
                        background:'var(--danger-l)', color:'var(--danger)',
                        border:'none', cursor:'pointer', fontSize:13,
                        display:'flex', alignItems:'center', justifyContent:'center',
                        fontWeight:700, zIndex:2,
                      }}
                      title="Delete poll"
                    >
                      {isDel ? '…' : '×'}
                    </button>
                  )}

                  <div className="poll-badges">
                    <span className={`badge ${poll.isOpen ? 'b-live live-dot' : 'b-closed'}`}>
                      {poll.isOpen ? 'Live' : 'Closed'}
                    </span>
                    {poll.isAnonymous && <span className="badge b-anon">Anonymous</span>}
                    {voted && <span className="badge b-voted">✓ Voted</span>}
                    {tl && <span className="badge b-time">⏱ {tl}</span>}
                    {poll.hideResults && poll.isOpen &&
                      <span className="badge" style={{ background:'#FFF3E0', color:'#92400E' }}>Hidden</span>}
                  </div>

                  {/* Club name — shown if different from current user's club */}
                  {poll.clubName && (
                    <div style={{ fontSize:11, fontWeight:600, color:'var(--text2)',
                      textTransform:'uppercase', letterSpacing:.5, marginBottom:3 }}>
                      {poll.clubName}
                    </div>
                  )}

                  <div className="poll-question">{poll.question}</div>

                  <div className="poll-chips">
                    {opts.slice(0, 3).map((o, i) => (
                      <span key={i} className="chip">{o.text}</span>
                    ))}
                    {opts.length > 3 && (
                      <span className="chip chip-more">+{opts.length - 3}</span>
                    )}
                  </div>

                  <div className="poll-footer">
                    <span className="poll-meta">
                      {poll.totalVotes || 0} vote{poll.totalVotes !== 1 ? 's' : ''}
                    </span>
                    <span className={`poll-action${!poll.isOpen ? ' dim' : ''}`}>
                      {voted || !poll.isOpen ? 'See results →' : 'Vote now →'}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
