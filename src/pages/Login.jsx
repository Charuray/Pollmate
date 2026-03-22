import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { signInWithGoogle, getClubName } from '../lib/firebase'

export default function Login() {
  const nav = useNavigate()
  const { user } = useAuth()
  const [busy, setBusy] = useState(false)
  const [err,  setErr]  = useState('')

  // Already signed in → go home
  if (user) {
    nav(getClubName() ? '/home' : '/setup', { replace: true })
    return null
  }

  const handleGoogle = async () => {
    setErr(''); setBusy(true)
    try {
      await signInWithGoogle()
      nav(getClubName() ? '/home' : '/setup', { replace: true })
    } catch (e) {
      if (e.code === 'auth/popup-blocked') {
        setErr('Popups blocked — allow popups for this site then try again')
      } else if (e.code !== 'auth/cancelled-popup-request' && e.code !== 'auth/popup-closed-by-user') {
        setErr('Sign-in failed. Enable Google in Firebase Console → Authentication → Sign-in method')
      }
    } finally { setBusy(false) }
  }

  return (
    <div style={{
      minHeight:'calc(100vh - 60px)',
      display:'flex', alignItems:'center', justifyContent:'center', padding:24,
    }}>
      <div style={{ width:'100%', maxWidth:400, textAlign:'center' }}>

        {/* Logo */}
        <div style={{
          width:80, height:80, borderRadius:22, background:'var(--primary)',
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:40, fontWeight:700, color:'#fff', margin:'0 auto 20px',
        }}>P</div>

        <h1 style={{ fontSize:28, fontWeight:700, letterSpacing:'-.5px', marginBottom:8 }}>
          Welcome to PollMate
        </h1>
        <p style={{ fontSize:15, color:'var(--text2)', marginBottom:36 }}>
          Sign in to create polls, vote, and see live results
        </p>

        {/* Google Sign-In */}
        <button
          onClick={handleGoogle}
          disabled={busy}
          style={{
            width:'100%', padding:'14px 24px',
            border:'1.5px solid var(--border)', borderRadius:12,
            background:'#fff', cursor:'pointer',
            display:'flex', alignItems:'center', justifyContent:'center', gap:12,
            fontSize:15, fontWeight:600, color:'var(--text)',
            transition:'box-shadow .15s',
          }}
          onMouseEnter={e => e.currentTarget.style.boxShadow='0 2px 12px rgba(0,0,0,.1)'}
          onMouseLeave={e => e.currentTarget.style.boxShadow='none'}
        >
          {/* Google SVG icon */}
          <svg width="20" height="20" viewBox="0 0 48 48">
            <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
            <path fill="#FF3D00" d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
            <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
            <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
          </svg>
          {busy ? 'Signing in…' : 'Continue with Google'}
        </button>

        {err && (
          <div style={{ marginTop:16, padding:'10px 14px', background:'var(--danger-l)', borderRadius:10, fontSize:13, color:'var(--danger)', fontWeight:500 }}>
            {err}
          </div>
        )}

        <p style={{ marginTop:24, fontSize:12, color:'var(--text3)', lineHeight:1.6 }}>
          By signing in you agree to use this app responsibly.<br />
          Your Google display name is used when you vote on named polls.
        </p>
      </div>
    </div>
  )
}
