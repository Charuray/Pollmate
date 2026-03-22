import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { doc, onSnapshot, addDoc, collection, serverTimestamp } from 'firebase/firestore'
import {
  db, getOpts, isFull, slotStatus,
  getDeviceId, getVoterName, getUID,
  hasVoted, markVoted, getVotedOpt, clearVote,
  castVote
} from '../lib/firebase'

const COLORS = ['#5C6BC0','#26A69A','#EF6C00','#8E24AA','#D81B60','#00838F']

function SlotBar({ opt, selected }) {
  const st  = slotStatus(opt)
  if (st === 'none') return null
  const lim  = opt.limit
  const filled = Math.min(opt.votes, lim)
  const pct  = Math.round(filled / lim * 100)
  const left = lim - filled
  const c = st === 'full' ? '#EF5350' : st === 'warn' ? '#E65100' : 'var(--primary)'
  return (
    <div style={{ padding:'0 16px 12px', background: selected ? 'var(--primary-l)' : 'transparent' }}>
      <div style={{ height:5, background:'var(--border)', borderRadius:3, overflow:'hidden', marginBottom:4 }}>
        <div style={{ height:5, borderRadius:3, background:c, width:`${pct}%` }} />
      </div>
      <span style={{ fontSize:11, color:c }}>
        {filled}/{lim} slots filled
        {st !== 'full' && <strong> · {left} left</strong>}
      </span>
    </div>
  )
}

// ── View shown when user already voted or poll is closed ───────────────────
function AlreadyVotedView({ poll, myVotedOptId }) {
  const nav  = useNavigate()
  const { id } = useParams()
  const opts = getOpts(poll.options)
  const myOpt = opts.find(o => o.id === myVotedOptId)
  const total = poll.totalVotes || 0
  const sorted = [...opts].sort((a, b) => b.votes - a.votes)
  const top = sorted[0]?.votes ?? 0
  const isTie = top > 0 && sorted.filter(o => o.votes === top).length > 1

  return (
    <div className="page">
      <div className="container">
        <div className="narrow">
          <p className="upper mb-2">{poll.clubName}</p>
          <h1 style={{ fontSize:24, fontWeight:700, letterSpacing:'-.5px', lineHeight:1.3, marginBottom:10 }}>
            {poll.question}
          </h1>
          <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginBottom:16 }}>
            <span className={`badge ${poll.isOpen ? 'b-live live-dot' : 'b-closed'}`}>
              {poll.isOpen ? 'Live' : 'Closed'}
            </span>
            <span className="small t2">{total} vote{total !== 1 ? 's' : ''}</span>
          </div>

          {/* Your vote card */}
          {myOpt && (
            <div style={{
              background:'var(--primary-l)', border:'1.5px solid var(--primary)',
              borderRadius:14, padding:'14px 16px', marginBottom:20,
              display:'flex', alignItems:'center', gap:12,
            }}>
              <span style={{ fontSize:24 }}>✓</span>
              <div>
                <p style={{ fontSize:12, fontWeight:600, color:'var(--primary)', marginBottom:3 }}>You voted for</p>
                <p style={{ fontSize:17, fontWeight:700, color:'var(--primary-d)' }}>{myOpt.text}</p>
              </div>
            </div>
          )}

          {!poll.isOpen && !myOpt && (
            <div style={{ background:'var(--closed-l)', borderRadius:14, padding:'12px 16px', marginBottom:20, display:'flex', alignItems:'center', gap:10 }}>
              <span style={{ fontSize:20 }}>🔒</span>
              <p style={{ fontSize:14, color:'var(--closed)', fontWeight:500 }}>This poll is closed</p>
            </div>
          )}

          {/* Results hidden */}
          {poll.hideResults && poll.isOpen ? (
            <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:14, padding:'14px 16px', marginBottom:16, display:'flex', alignItems:'center', gap:12 }}>
              <span style={{ fontSize:20 }}>🔒</span>
              <div>
                <p style={{ fontSize:14, fontWeight:600, color:'var(--text)' }}>Results locked</p>
                <p style={{ fontSize:12, color:'var(--text2)', marginTop:2 }}>Revealed when the poll closes</p>
              </div>
            </div>
          ) : (
            <>
              {top > 0 && (
                <div className={`insight ${isTie ? 'insight-tie' : 'insight-win'}`} style={{ marginBottom:14 }}>
                  <span style={{ fontSize:22 }}>{isTie ? '⚖️' : '🏆'}</span>
                  <span className="insight-text">
                    {isTie
                      ? `Tie between ${sorted.filter(o => o.votes === top).map(o => o.text).join(' & ')}`
                      : `${sorted[0]?.text} is leading with ${top} vote${top !== 1 ? 's' : ''}`}
                  </span>
                </div>
              )}

              <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:20 }}>
                {sorted.map((opt, i) => {
                  const pct     = total > 0 ? Math.round(opt.votes / total * 100) : 0
                  const color   = COLORS[i % COLORS.length]
                  const isWinner = !isTie && opt.votes === top && top > 0
                  const isMe    = opt.id === myVotedOptId
                  return (
                    <div key={opt.id} style={{
                      background: isMe ? 'var(--primary-l)' : 'var(--surface)',
                      border:`1px solid ${isWinner ? 'var(--accent)' : isMe ? 'var(--primary)' : 'var(--border)'}`,
                      borderRadius:12, padding:'12px 14px',
                    }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8, gap:8 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:7, flex:1 }}>
                          {isWinner && <div style={{ width:7, height:7, borderRadius:'50%', background:color, flexShrink:0 }} />}
                          <span style={{ fontSize:14, fontWeight: isWinner ? 700 : 500, color: isWinner ? color : 'var(--text)' }}>
                            {opt.text}
                          </span>
                          {isMe && <span className="badge b-voted" style={{ fontSize:10, marginLeft:4 }}>Your vote</span>}
                        </div>
                        <span style={{ fontSize:18, fontWeight:700, color, flexShrink:0 }}>{pct}%</span>
                      </div>
                      <div style={{ height:8, background:'var(--border)', borderRadius:4, overflow:'hidden', marginBottom:5 }}>
                        <div style={{ height:8, borderRadius:4, background:color, width:`${pct}%`, transition:'width .8s cubic-bezier(.4,0,.2,1)' }} />
                      </div>
                      <span style={{ fontSize:11, color:'var(--text2)' }}>{opt.votes} vote{opt.votes !== 1 ? 's' : ''}</span>
                    </div>
                  )
                })}
              </div>
            </>
          )}

          <button className="btn btn-primary btn-lg btn-block" onClick={() => nav(`/results/${id}`)}>
            View full results →
          </button>
          <button className="btn btn-ghost btn-block btn-sm" style={{ marginTop:10 }} onClick={() => nav('/home')}>
            ← Back to polls
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main vote screen ───────────────────────────────────────────────────────
export default function Vote() {
  const { id } = useParams()
  const nav = useNavigate()
  const [poll, setPoll]         = useState(null)
  const [loading, setLoading]   = useState(true)
  const [selected, setSelected] = useState(null)
  const [busy, setBusy]         = useState(false)
  const [err, setErr]           = useState('')

  const alreadyVoted = hasVoted(id)
  const myVotedOptId = getVotedOpt(id)

  useEffect(() => {
    return onSnapshot(doc(db, 'polls', id), snap => {
      if (snap.exists()) setPoll({ id: snap.id, ...snap.data() })
      setLoading(false)
    })
  }, [id])

  useEffect(() => {
    if (!poll || !selected) return
    const opt = getOpts(poll.options).find(o => o.id === selected)
    if (opt && isFull(opt)) setSelected(null)
  }, [poll])

  const vote = async () => {
    if (!selected || !poll) return
    setErr(''); setBusy(true)
    try {
      const opts   = getOpts(poll.options)
      const chosen = opts.find(o => o.id === selected)
      if (!chosen) throw new Error('Option not found')
      if (isFull(chosen)) {
        setErr('This option just filled up. Pick another.')
        setSelected(null); setBusy(false); return
      }

      // Use castVote which writes the full array — preserves all text fields
      await castVote(id, selected, getVoterName(), poll.isAnonymous)

      // Log to votes subcollection for audit
      await addDoc(collection(db, 'polls', id, 'votes'), {
        uid:       getUID(),
        voterName: poll.isAnonymous ? 'anonymous' : getVoterName(),
        optionId:  selected,
        votedAt:   serverTimestamp(),
      })

      markVoted(id, selected)
      nav(`/confirm/${id}?option=${encodeURIComponent(chosen.text)}`)
    } catch (e) {
      setErr(e?.message || 'Could not submit vote.')
      setBusy(false)
    }
  }

  if (loading) return <div className="page"><div className="spinner" /></div>
  if (!poll) return (
    <div className="page">
      <div className="empty">
        <div className="empty-icon">🗳️</div>
        <div className="empty-title">Poll not found</div>
        <button className="btn btn-primary" onClick={() => nav('/home')}>Go home</button>
      </div>
    </div>
  )

  if (alreadyVoted || !poll.isOpen) {
    return <AlreadyVotedView poll={poll} myVotedOptId={myVotedOptId} />
  }

  const opts   = getOpts(poll.options)
  const allFull = poll.hasVoteLimit && opts.every(isFull)
  const dl = poll.deadline ? (() => {
    const end = poll.deadline.toDate ? poll.deadline.toDate() : new Date(poll.deadline)
    const ms  = end.getTime() - Date.now()
    if (ms <= 0) return null
    const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000)
    return h > 0 ? `${h}h ${m}m` : `${m}m`
  })() : null

  return (
    <div className="page">
      <div className="container">
        <div className="narrow">
          <p className="upper mb-2">{poll.clubName}</p>

          {poll.isAnonymous && (
            <div style={{ background:'var(--primary-l)', borderRadius:10, padding:'10px 14px', marginBottom:14, color:'var(--primary)', fontSize:13, fontWeight:500 }}>
              🔒 Anonymous poll — your name won't be shown
            </div>
          )}

          <h1 style={{ fontSize:26, fontWeight:700, letterSpacing:'-.5px', lineHeight:1.3, marginBottom:8 }}>{poll.question}</h1>
          <p className="small t2 mb-2">{poll.totalVotes} vote{poll.totalVotes !== 1 ? 's' : ''} so far</p>

          {dl && (
            <div style={{ background:'var(--warn-l)', borderRadius:10, padding:'10px 14px', marginBottom:14, fontSize:13, fontWeight:600, color:'#B45309' }}>
              ⏱ Closes in {dl}
            </div>
          )}
          {allFull && (
            <div style={{ background:'var(--danger-l)', borderRadius:10, padding:12, marginBottom:14, fontSize:13, color:'var(--danger)', textAlign:'center' }}>
              All slots are filled — no more votes accepted
            </div>
          )}

          <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:24 }}>
            {opts.map(opt => {
              const full = isFull(opt)
              const sel  = selected === opt.id
              const dis  = full || allFull
              const st   = slotStatus(opt)
              return (
                <div
                  key={opt.id}
                  className={`vote-option${sel ? ' selected' : ''}${dis ? ' disabled' : ''}`}
                  onClick={() => !dis && setSelected(opt.id)}
                >
                  <div className="vo-top">
                    <div className="vo-radio">{sel && <div className="vo-dot" />}</div>
                    <span className="vo-label">{opt.text}</span>
                    {full && <span className="badge b-full">Full</span>}
                  </div>
                  {st !== 'none' && <SlotBar opt={opt} selected={sel} />}
                </div>
              )
            })}
          </div>

          {err && <p className="error-msg">{err}</p>}

          <button
            className="btn btn-primary btn-lg btn-block"
            onClick={vote}
            disabled={!selected || busy || allFull}
            style={{ opacity: !selected || allFull ? .5 : 1 }}
          >
            {busy ? 'Submitting…' : allFull ? 'All slots filled' : selected ? 'Confirm Vote' : 'Pick an option above'}
          </button>
          <p className="smaller t3 center mt-2">You can only vote once on this poll</p>
        </div>
      </div>
    </div>
  )
}
