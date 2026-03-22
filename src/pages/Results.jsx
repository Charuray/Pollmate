import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { doc, onSnapshot, updateDoc, collection, addDoc, onSnapshot as snap2, deleteDoc } from 'firebase/firestore'
import {
  db, getOpts, slotStatus, isCreator, getVotedOpt, clearVote,
  getUID, getVoterName, deletePoll, retractVote, approveSuggestion
} from '../lib/firebase'
import { useAuth } from '../lib/AuthContext'
import QRModal from '../components/QRModal'

const COLORS = ['#5C6BC0','#26A69A','#EF6C00','#8E24AA','#D81B60','#00838F']
const LIGHTS  = ['#EDE7F6','#E0F2F1','#FFF3E0','#F3E5F5','#FCE4EC','#E0F7FA']

function Bar({ opt, total, idx, winner, myVote, anon, showVoters, hideResults }) {
  const [width, setWidth] = useState(0)
  const pct   = total > 0 ? Math.round(opt.votes / total * 100) : 0
  const color = COLORS[idx % COLORS.length]
  const light = LIGHTS[idx % LIGHTS.length]
  const voters = opt.voterNames || []
  const st    = slotStatus(opt)
  const isMe  = myVote === opt.id

  useEffect(() => {
    if (hideResults) return
    const t = setTimeout(() => setWidth(pct), idx * 120 + 50)
    return () => clearTimeout(t)
  }, [pct, hideResults])

  const slotPill = () => {
    if (st === 'none') return null
    const left = (opt.limit || 0) - opt.votes
    const [bg, c, txt] =
      st === 'full' ? ['var(--danger-l)', '#C62828', `Full · ${opt.limit}/${opt.limit}`] :
      st === 'warn' ? ['#FFF3E0', '#E65100', `${left} left · ${opt.votes}/${opt.limit}`] :
                     ['var(--accent-l)', '#00695C', `${left} left · ${opt.votes}/${opt.limit}`]
    return <span className="badge" style={{ background:bg, color:c }}>{txt}</span>
  }

  if (hideResults) {
    return (
      <div className="result-bar">
        <div className="rb-top">
          <div className="rb-label">
            <span className="rb-name">{opt.text}</span>
          </div>
          {isMe && <span className="badge b-voted" style={{ fontSize:11 }}>Your vote</span>}
        </div>
        <div className="rb-track" />
        <div className="rb-bottom">
          <span style={{ fontSize:11, color:'var(--text3)' }}>Hidden until poll closes</span>
        </div>
      </div>
    )
  }

  return (
    <div className={`result-bar${winner ? ' winner' : ''}`} style={winner ? { borderColor:color } : {}}>
      <div className="rb-top">
        <div className="rb-label">
          {winner && <div className="rb-dot" style={{ background:color }} />}
          <span className="rb-name" style={winner ? { color, fontWeight:700 } : {}}>{opt.text}</span>
        </div>
        <span className="rb-pct" style={{ color }}>{pct}%</span>
      </div>
      <div className="rb-track">
        <div className="rb-fill" style={{ width:`${width}%`, background:color }} />
      </div>
      <div className="rb-bottom">
        <span className="rb-votes">{opt.votes} vote{opt.votes !== 1 ? 's' : ''}</span>
        <div className="rb-tags">
          {winner && <span className="badge" style={{ background:light, color }}>Winner</span>}
          {isMe   && <span className="badge b-voted">Your vote</span>}
          {slotPill()}
        </div>
      </div>
      {!anon && showVoters && voters.length > 0 && (
        <div className="rb-voters" style={{ background:light, color }}>
          {voters.slice(0, 4).join(', ')}{voters.length > 4 ? ` +${voters.length - 4} more` : ''}
        </div>
      )}
    </div>
  )
}

function Capacity({ opts }) {
  const limited = opts.filter(o => o.limit && o.limit > 0)
  if (!limited.length) return null
  const cap    = limited.reduce((s, o) => s + (o.limit || 0), 0)
  const filled = limited.reduce((s, o) => s + Math.min(o.votes, o.limit || 0), 0)
  const left   = cap - filled
  const pct    = cap > 0 ? Math.round(filled / cap * 100) : 0
  return (
    <div className="cap-card">
      <div className="cap-row">
        <div className="cap-item"><div className="cap-num">{filled}</div><div className="cap-lbl">slots filled</div></div>
        <div className="cap-div" />
        <div className="cap-item"><div className="cap-num">{cap}</div><div className="cap-lbl">total capacity</div></div>
        <div className="cap-div" />
        <div className="cap-item">
          <div className="cap-num" style={{ color: left === 0 ? 'var(--danger)' : 'var(--accent)' }}>{left}</div>
          <div className="cap-lbl">slots left</div>
        </div>
      </div>
      <div className="cap-track"><div className="cap-fill" style={{ width:`${pct}%` }} /></div>
      <div className="cap-pct">{pct}% filled</div>
    </div>
  )
}

function Suggestions({ pollId, creatorMode, allowSuggestions }) {
  const [suggestions, setSuggestions] = useState([])
  const [text, setText]   = useState('')
  const [busy, setBusy]   = useState(false)
  const [done, setDone]   = useState(false)

  useEffect(() => {
    if (!allowSuggestions) return
    return snap2(collection(db, 'polls', pollId, 'suggestions'), snap => {
      setSuggestions(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
  }, [pollId, allowSuggestions])

  if (!allowSuggestions) return null

  const submit = async () => {
    if (!text.trim() || busy) return
    setBusy(true)
    await addDoc(collection(db, 'polls', pollId, 'suggestions'), {
      text: text.trim(), uid: getUID(), voterName: getVoterName(),
      status:'pending', createdAt: new Date(),
    })
    setText(''); setBusy(false); setDone(true)
    setTimeout(() => setDone(false), 3000)
  }

  const pending = suggestions.filter(s => s.status === 'pending')

  return (
    <div style={{ borderTop:'1px solid var(--border)', paddingTop:16, marginTop:16 }}>
      <p style={{ fontSize:13, fontWeight:600, color:'var(--text2)', marginBottom:10 }}>Suggest an option</p>
      {done ? (
        <div style={{ background:'var(--accent-l)', borderRadius:10, padding:'10px 14px', fontSize:13, color:'#00695C', fontWeight:500 }}>
          ✓ Suggestion submitted — waiting for creator approval
        </div>
      ) : (
        <div style={{ display:'flex', gap:8 }}>
          <input
            className="input" placeholder="Type your suggestion…"
            value={text} onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submit()}
            maxLength={80} style={{ flex:1 }}
          />
          <button className="btn btn-outline btn-sm" onClick={submit} disabled={!text.trim() || busy}>
            Submit
          </button>
        </div>
      )}
      {creatorMode && pending.length > 0 && (
        <div style={{ marginTop:14 }}>
          <p className="upper" style={{ marginBottom:8 }}>Pending suggestions ({pending.length})</p>
          {pending.map(s => (
            <div key={s.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', background:'var(--surface)', borderRadius:10, marginBottom:6 }}>
              <span style={{ flex:1, fontSize:14, color:'var(--text)' }}>{s.text}</span>
              <span className="t3" style={{ fontSize:12 }}>by {s.voterName}</span>
              <button className="btn btn-accent btn-sm" onClick={() => approveSuggestion(pollId, s.text, s.id)}>✓ Add</button>
              <button className="btn btn-ghost btn-sm" onClick={() => deleteDoc(doc(db, 'polls', pollId, 'suggestions', s.id))}>✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Results() {
  const { id } = useParams()
  const nav = useNavigate()
  const { user } = useAuth()
  const [poll, setPoll]         = useState(null)
  const [loading, setLoading]   = useState(true)
  const [showVoters, setShowVoters] = useState(false)
  const [closing, setClosing]   = useState(false)
  const [retracting, setRetracting] = useState(false)
  const [showQR, setShowQR]     = useState(false)
  const [toast, setToast]       = useState('')
  const [myVote, setMyVote]     = useState(() => getVotedOpt(id))

  const creator = isCreator(id)
  const notify  = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2800) }
  const voteUrl = `${window.location.origin}/poll/${id}`

  useEffect(() => {
    return onSnapshot(doc(db, 'polls', id), snap => {
      if (snap.exists()) setPoll({ id: snap.id, ...snap.data() })
      setLoading(false)
    })
  }, [id])

  const copyId = async () => {
    await navigator.clipboard.writeText(id); notify('Poll ID copied!')
  }

  const share = async () => {
    const text = `Vote on: "${poll?.question}"\n${voteUrl}`
    if (navigator.share) { try { await navigator.share({ text, title:'PollMate' }) } catch {} }
    else { await navigator.clipboard.writeText(text); notify('Link copied!') }
  }

  const exportCSV = () => {
    if (!poll) return
    const opts  = getOpts(poll.options)
    const total = poll.totalVotes || 0
    let csv = `Poll Results\nClub,${poll.clubName}\nQuestion,"${poll.question}"\nTotal Votes,${total}\n\n`
    csv += poll.isAnonymous ? 'Option,Votes,%\n' : 'Option,Votes,%,Voters\n'
    opts.forEach(o => {
      const pct = total > 0 ? (o.votes / total * 100).toFixed(1) : '0.0'
      if (poll.isAnonymous) csv += `"${o.text}",${o.votes},${pct}%\n`
      else csv += `"${o.text}",${o.votes},${pct}%,"${o.voterNames.join(' | ')}"\n`
    })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type:'text/csv' }))
    a.download = `${poll.question.slice(0,20).replace(/\W/g,'_')}_results.csv`
    a.click()
  }

  const closePoll = async () => {
    if (!window.confirm('Close this poll? Voting will stop permanently.')) return
    setClosing(true)
    try { await updateDoc(doc(db, 'polls', id), { isOpen:false }) }
    catch { notify('Could not close poll') }
    finally { setClosing(false) }
  }

  const handleRetract = async () => {
    if (!myVote || !poll) return
    if (!window.confirm('Retract your vote? You can vote again while the poll is open.')) return
    setRetracting(true)
    try {
      await retractVote(id, myVote, getVoterName(), poll.isAnonymous)
      clearVote(id); setMyVote(null)
      notify('Vote retracted — you can vote again')
    } catch (e) {
      notify('Could not retract: ' + (e?.message || 'unknown error'))
    } finally { setRetracting(false) }
  }

  const handleDelete = async () => {
    if (!window.confirm('Delete this poll permanently? All votes will be lost.')) return
    try { await deletePoll(id); nav('/home') }
    catch { notify('Could not delete poll. Check Firestore rules.') }
  }

  if (loading) return <div className="page"><div className="spinner" /></div>
  if (!poll)   return <div className="page"><div className="empty"><div className="empty-title">Poll not found</div></div></div>

  const opts   = getOpts(poll.options)
  const sorted = [...opts].sort((a, b) => b.votes - a.votes)
  const top    = sorted[0]?.votes ?? 0
  const topOpts = sorted.filter(o => o.votes === top && o.votes > 0)
  const isTie   = topOpts.length > 1
  const hasVotes = poll.totalVotes > 0
  const winnerName = topOpts[0]?.text || ''
  const hideResults = poll.hideResults && poll.isOpen

  const dl = poll.deadline ? (() => {
    const end = poll.deadline.toDate ? poll.deadline.toDate() : new Date(poll.deadline)
    const ms  = end.getTime() - Date.now()
    if (ms <= 0) return null
    const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000)
    return h >= 24 ? `${Math.floor(h/24)}d ${h%24}h remaining` : h > 0 ? `${h}h ${m}m remaining` : `${m}m remaining`
  })() : null

  return (
    <div className="page">
      <div className="container">
        <p className="upper mb-2">{poll.clubName || 'Poll'}</p>
        <h1 style={{ fontSize:26, fontWeight:700, letterSpacing:'-.5px', lineHeight:1.3, marginBottom:14 }}>{poll.question}</h1>

        <div className="row gap-2 wrap mb-2">
          <span className={`badge ${poll.isOpen ? 'b-live live-dot' : 'b-closed'}`}>
            {poll.isOpen ? 'Live' : 'Closed'}
          </span>
          <span className="small t2">{poll.totalVotes || 0} vote{poll.totalVotes !== 1 ? 's' : ''}</span>
          {poll.isAnonymous && <span className="badge b-anon">Anonymous</span>}
          {hideResults && <span className="badge" style={{ background:'#FFF3E0', color:'#92400E' }}>Results hidden</span>}
        </div>

        {dl && (
          <div style={{ background:'var(--warn-l)', borderRadius:10, padding:'10px 14px', marginBottom:16, fontSize:13, fontWeight:600, color:'#B45309' }}>
            ⏱ {dl}
          </div>
        )}

        <div className="results-grid">
          {/* LEFT — charts */}
          <div>
            {poll.isOpen && (
              <div className="poll-id-card" onClick={copyId}>
                <div>
                  <div className="pid-label">Poll ID — click to copy</div>
                  <div className="pid-value">{id}</div>
                </div>
                <span className="pid-hint">Share with members →</span>
              </div>
            )}

            {hideResults ? (
              <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--rl)', padding:'14px 16px', marginBottom:16, display:'flex', alignItems:'center', gap:12 }}>
                <span style={{ fontSize:22 }}>🔒</span>
                <div>
                  <div style={{ fontSize:14, fontWeight:600, color:'var(--text)' }}>Results locked</div>
                  <div style={{ fontSize:13, color:'var(--text2)', marginTop:2 }}>Results revealed when the poll closes</div>
                </div>
              </div>
            ) : hasVotes ? (
              <div className={`insight ${isTie ? 'insight-tie' : 'insight-win'}`}>
                <span style={{ fontSize:24 }}>{isTie ? '⚖️' : '🏆'}</span>
                <span className="insight-text">
                  {isTie
                    ? `Tie between ${topOpts.map(o => o.text).filter(Boolean).join(' & ')}`
                    : winnerName
                      ? `${winnerName} is leading with ${top} vote${top !== 1 ? 's' : ''}`
                      : `${top} vote${top !== 1 ? 's' : ''} cast so far`}
                </span>
              </div>
            ) : (
              <div style={{ background:'var(--surface)', borderRadius:'var(--rl)', padding:14, marginBottom:16, fontSize:13, color:'var(--text2)', textAlign:'center' }}>
                No votes yet — share the Poll ID above to get started
              </div>
            )}

            {!hideResults && <Capacity opts={opts} />}

            {sorted.map((opt, i) => (
              <Bar
                key={opt.id} opt={opt} total={poll.totalVotes || 0} idx={i}
                winner={!isTie && opt.votes === top && top > 0}
                myVote={myVote} anon={poll.isAnonymous}
                showVoters={showVoters} hideResults={hideResults}
              />
            ))}

            {!poll.isAnonymous && hasVotes && !hideResults && (
              <button className="btn btn-ghost btn-sm" style={{ display:'block', margin:'12px auto 0' }}
                onClick={() => setShowVoters(!showVoters)}>
                {showVoters ? '▲ Hide voter names' : '▼ Show who voted'}
              </button>
            )}

            <Suggestions
              pollId={id}
              creatorMode={creator}
              allowSuggestions={!!poll.allowSuggestions && poll.isOpen}
            />
          </div>

          {/* RIGHT — actions */}
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            <div className="row gap-2 wrap">
              <button className="btn btn-outline" style={{ flex:1 }} onClick={share}>↗ Share</button>
              <button className="btn btn-ghost"   style={{ flex:1 }} onClick={() => setShowQR(true)}>▣ QR</button>
            </div>

            {creator && (
              <button className="btn btn-primary btn-block" onClick={exportCSV}>↓ Export CSV</button>
            )}

            {!myVote && poll.isOpen && (
              <button className="btn btn-accent btn-block" onClick={() => nav(`/poll/${id}`)}>
                ✓ Cast your vote
              </button>
            )}

            {myVote && poll.isOpen && (
              <button className="btn btn-block btn-sm" onClick={handleRetract} disabled={retracting}
                style={{ color:'var(--danger)', border:'1.5px solid var(--danger)', background:'none', borderRadius:10, padding:10, fontWeight:600, fontSize:14 }}>
                {retracting ? 'Retracting…' : '↩ Retract my vote'}
              </button>
            )}

            {creator && poll.isOpen && (
              <button className="btn btn-danger btn-block" onClick={closePoll} disabled={closing}>
                {closing ? 'Closing…' : 'Close poll'}
              </button>
            )}

            {creator && (
              <button className="btn btn-block btn-sm" onClick={handleDelete}
                style={{ color:'var(--danger)', border:'1px solid var(--danger)', background:'none', borderRadius:10, padding:9, fontSize:13, fontWeight:600 }}>
                🗑 Delete poll
              </button>
            )}

            <div className="divider" />
            <button className="btn btn-ghost btn-sm" onClick={() => nav('/home')}>← Back to polls</button>
          </div>
        </div>
      </div>
      {showQR && <QRModal url={voteUrl} onClose={() => setShowQR(false)} />}
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
