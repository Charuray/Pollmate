import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore'
import { db, getClubName, getDeviceId, getVoterName, markCreator } from '../lib/firebase'

const DURATIONS = [
  { label: '1 hour', h: 1 }, { label: '3 hours', h: 3 },
  { label: '6 hours', h: 6 }, { label: '12 hours', h: 12 },
  { label: '1 day', h: 24 }, { label: '2 days', h: 48 },
  { label: '3 days', h: 72 }, { label: '1 week', h: 168 },
]
const YES_NO = ['Yes', 'No']
const RATING = ['1 — Poor', '2 — Fair', '3 — Good', '4 — Very Good', '5 — Excellent']

export default function Create() {
  const nav = useNavigate()
  const [question, setQuestion] = useState('')
  const [opts, setOpts] = useState([{ text: '', limit: '' }, { text: '', limit: '' }])
  const [type, setType] = useState('mcq')
  const [anon, setAnon] = useState(false)
  const [voteLimit, setVoteLimit] = useState(false)
  const [duration, setDuration] = useState(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [hideResults, setHideResults] = useState(false)
  const [allowSuggestions, setAllowSuggestions] = useState(false)

  const addOpt = () => { if (opts.length < 6) setOpts([...opts, { text: '', limit: '' }]) }
  const rmOpt = (i) => { if (opts.length > 2) setOpts(opts.filter((_, j) => j !== i)) }
  const setTxt = (i, v) => { const a = [...opts]; a[i] = { ...a[i], text: v }; setOpts(a) }
  const setLim = (i, v) => {
    if (v !== '' && !/^\d+$/.test(v)) return
    const a = [...opts]; a[i] = { ...a[i], limit: v }; setOpts(a)
  }

  const submit = async () => {
    setErr('')
    if (!question.trim()) { setErr('Please enter a question'); return }
    if (type === 'mcq' && opts.filter(o => o.text.trim()).length < 2) { setErr('Add at least 2 options'); return }
    setLoading(true)
    try {
      let optObjs
      if (type === 'mcq') {
        optObjs = opts.filter(o => o.text.trim()).map((o, i) => ({
          id: `opt${i}`, text: o.text.trim(), votes: 0, voterNames: [],
          limit: voteLimit && o.limit ? Math.max(1, parseInt(o.limit)) : null,
        }))
      } else {
        const src = type === 'yesno' ? YES_NO : RATING
        optObjs = src.map((t, i) => ({ id: `opt${i}`, text: t, votes: 0, voterNames: [], limit: null }))
      }
      const ref = await addDoc(collection(db, 'polls'), {
        clubName: getClubName(), question: question.trim(), type, options: optObjs,
        isAnonymous: anon, hasVoteLimit: voteLimit && type === 'mcq',
        hideResults, allowSuggestions,
        isOpen: true, totalVotes: 0,
        createdBy: getDeviceId(), createdByName: getVoterName(),
        createdAt: serverTimestamp(),
        deadline: duration ? Timestamp.fromDate(new Date(Date.now() + duration * 3600000)) : null,
      })
      markCreator(ref.id)
      nav(`/results/${ref.id}`)
    } catch (e) {
      setErr(e?.message || 'Error. Check Firebase config in src/lib/firebase.js')
      setLoading(false)
    }
  }

  const dlLabel = duration ? (() => {
    const end = new Date(Date.now() + duration * 3600000)
    const d = DURATIONS.find(x => x.h === duration)
    return `Closes ${d?.label} from now · ${end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} on ${end.toLocaleDateString([], { day: 'numeric', month: 'short' })}`
  })() : 'No expiry — stays open until you close it'

  return (
    <div className="page">
      <div className="container">
        <div className="narrow">
          <h1 className="page-title mb-2">Create Poll</h1>

          {/* Warn if no club name — polls will show blank club */}
          {!getClubName() && (
            <div style={{
              background:'var(--warn-l)', border:'1px solid var(--warn)',
              borderRadius:10, padding:'10px 14px', marginBottom:16,
              fontSize:13, color:'#92400E'
            }}>
              ⚠️ No club name set — <button
                onClick={() => nav('/setup')}
                style={{ background:'none', border:'none', color:'#92400E',
                  textDecoration:'underline', cursor:'pointer', fontSize:13 }}
              >set it first</button> so it appears on this poll
            </div>
          )}

          {/* Question */}
          <div className="form-group">
            <label className="label">Question *</label>
            <textarea
              className="textarea"
              placeholder="e.g. Which date works for our next meetup?"
              value={question}
              onChange={e => setQuestion(e.target.value)}
              maxLength={200}
              rows={3}
            />
            <div className="char-count">{question.length}/200</div>
          </div>

          {/* Type */}
          <div className="form-group">
            <label className="label">Poll type</label>
            <div className="pills">
              {[['mcq','Multiple choice'],['yesno','Yes / No'],['rating','Rating 1–5']].map(([v, l]) => (
                <button key={v} className={`pill${type === v ? ' active' : ''}`} onClick={() => setType(v)}>{l}</button>
              ))}
            </div>
          </div>

          {/* MCQ options */}
          {type === 'mcq' && (
            <div className="form-group">
              <div className="toggle-row" style={{ marginBottom: 14 }}>
                <div className="toggle-info">
                  <div className="t-title">Vote limit per option</div>
                  <div className="t-sub">{voteLimit ? 'Set max seats per option' : 'No seat cap'}</div>
                </div>
                <button className={`toggle${voteLimit ? ' on' : ''}`} onClick={() => setVoteLimit(!voteLimit)} />
              </div>

              {voteLimit && (
                <div className="row gap-2 mb-2" style={{ paddingLeft: 2 }}>
                  <span className="label" style={{ flex: 1, marginBottom: 0 }}>Option</span>
                  <span className="label" style={{ width: 70, textAlign: 'center', marginBottom: 0 }}>Limit</span>
                  <span style={{ width: 44 }} />
                </div>
              )}

              {opts.map((o, i) => (
                <div key={i} className="opt-row">
                  <input
                    className="input opt-in"
                    placeholder={`Option ${i + 1}`}
                    value={o.text}
                    onChange={e => setTxt(i, e.target.value)}
                    maxLength={80}
                  />
                  {voteLimit && (
                    <input
                      className="lim-in"
                      placeholder="∞"
                      value={o.limit}
                      onChange={e => setLim(i, e.target.value)}
                      inputMode="numeric"
                      maxLength={4}
                    />
                  )}
                  {opts.length > 2 && (
                    <button className="rm-btn" onClick={() => rmOpt(i)}>✕</button>
                  )}
                </div>
              ))}

              {voteLimit && <p className="hint mb-2">Leave blank = unlimited for that option</p>}
              {opts.length < 6 && (
                <button className="add-opt-btn" onClick={addOpt}>+ Add option</button>
              )}
            </div>
          )}

          {/* Preview */}
          {type !== 'mcq' && (
            <div className="form-group">
              <label className="label">Options preview</label>
              <div className="preview-box">
                {(type === 'yesno' ? YES_NO : RATING).map((o, i) => (
                  <div key={i} className="preview-opt">{o}</div>
                ))}
              </div>
            </div>
          )}

          {/* Anonymous */}
          <div className="toggle-row">
            <div className="toggle-info">
              <div className="t-title">Anonymous voting</div>
              <div className="t-sub">{anon ? 'Only counts shown — no names' : 'Voter names visible in results'}</div>
            </div>
            <button className={`toggle${anon ? ' on' : ''}`} onClick={() => setAnon(!anon)} />
          </div>

          {/* Expiry */}
          <div className="form-group mt-3">
            <label className="label">Poll expiry</label>
            <div className="pills">
              {DURATIONS.map(d => (
                <button
                  key={d.h}
                  className={`pill${duration === d.h ? ' active' : ''}`}
                  onClick={() => setDuration(duration === d.h ? null : d.h)}
                >
                  {d.label}
                </button>
              ))}
            </div>
            <div className="deadline-preview">{dlLabel}</div>
          </div>

          {err && <p className="error-msg">{err}</p>}

          <button className="btn btn-primary btn-lg btn-block mt-2" onClick={submit} disabled={loading}>
            {loading ? 'Creating...' : 'Create Poll'}
          </button>
        </div>
      </div>
    </div>
  )
}
