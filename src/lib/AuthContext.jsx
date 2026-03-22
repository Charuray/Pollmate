import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db, setClubName, setVoterName } from './firebase'

const Ctx = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]   = useState(undefined) // undefined = loading
  const [ready, setReady] = useState(false)

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      if (u) {
        // Restore saved profile from Firestore on every sign-in
        try {
          const snap = await getDoc(doc(db, 'users', u.uid))
          if (snap.exists()) {
            const d = snap.data()
            if (d.clubName)  setClubName(d.clubName)
            if (d.voterName) setVoterName(d.voterName)
          }
        } catch {}
      }
      setUser(u ?? null)
      setReady(true)
    })
  }, [])

  // Show spinner only on very first load
  if (!ready) return (
    <div style={{ display:'flex', justifyContent:'center', alignItems:'center', height:'100vh' }}>
      <div className="spinner" />
    </div>
  )

  return <Ctx.Provider value={{ user }}>{children}</Ctx.Provider>
}

export const useAuth = () => useContext(Ctx)
