import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { signInWithGoogle, signOutUser, getClubName } from '../lib/firebase'

export default function Nav() {
  const nav = useNavigate()
  const { pathname } = useLocation()
  const { user } = useAuth()
  const [signingIn, setSigningIn] = useState(false)
  const [err, setErr] = useState('')

  const initials = user?.displayName
    ? user.displayName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : '?'

  const handleSignIn = async () => {
    setErr('')
    setSigningIn(true)
    try {
      await signInWithGoogle()
      // After sign-in: if no club name saved, go to setup
      if (!getClubName()) nav('/setup')
    } catch (e) {
      if (e.code === 'auth/popup-blocked') {
        setErr('Popups are blocked — allow popups for this site then try again')
      } else if (e.code !== 'auth/cancelled-popup-request' && e.code !== 'auth/popup-closed-by-user') {
        setErr('Sign-in failed. Enable Google in Firebase Console → Authentication → Sign-in method')
      }
    } finally {
      setSigningIn(false)
    }
  }

  return (
    <>
      <nav className="nav">
        <div className="nav-inner">
          <div className="nav-logo" onClick={() => nav('/home')}>
            <div className="nav-mark">P</div>
            <span className="nav-name">PollMate</span>
          </div>

          <div className="nav-links">
            <button
              className={`nav-link${pathname === '/home' ? ' active' : ''}`}
              onClick={() => nav('/home')}
            >Polls</button>

            <button
              className={`nav-link nav-cta${pathname === '/create' ? ' active' : ''}`}
              onClick={() => nav('/create')}
            >+ New Poll</button>

            {user ? (
              <div style={{ display:'flex', alignItems:'center', gap:8, marginLeft:4 }}>
                <div style={{
                  width:32, height:32, borderRadius:'50%',
                  background:'rgba(255,255,255,.25)',
                  overflow:'hidden', display:'flex', alignItems:'center',
                  justifyContent:'center', fontSize:12, fontWeight:700,
                  color:'#fff', flexShrink:0,
                }}>
                  {user.photoURL
                    ? <img src={user.photoURL} alt="" referrerPolicy="no-referrer"
                        style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                    : initials}
                </div>
                <button
                  className="nav-link"
                  style={{ padding:'5px 12px', fontSize:13 }}
                  onClick={() => signOutUser()}
                >Sign out</button>
              </div>
            ) : (
              <button
                className="nav-link"
                style={{ padding:'7px 14px', background:'rgba(255,255,255,.18)', borderRadius:20, fontSize:13 }}
                onClick={handleSignIn}
                disabled={signingIn}
              >
                {signingIn ? 'Signing in…' : 'Sign in with Google'}
              </button>
            )}
          </div>
        </div>
      </nav>

      {err && (
        <div style={{
          background:'#C62828', color:'#fff',
          padding:'10px 20px', textAlign:'center',
          fontSize:13, fontWeight:500, zIndex:99,
        }}>
          {err}
          <button
            onClick={() => setErr('')}
            style={{ background:'none', border:'none', color:'#fff', marginLeft:12, cursor:'pointer', fontSize:16 }}
          >✕</button>
        </div>
      )}
    </>
  )
}
