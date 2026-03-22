import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './lib/AuthContext'
import { getClubName } from './lib/firebase'
import Nav    from './components/Nav'
import Login  from './pages/Login'
import Setup  from './pages/Setup'
import Home   from './pages/Home'
import Create from './pages/Create'
import Vote   from './pages/Vote'
import Confirm from './pages/Confirm'
import Results from './pages/Results'

// Redirect unauthenticated users to /login
function RequireAuth({ children }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return children
}

// Redirect users without club name to /setup
function RequireSetup({ children }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (!getClubName()) return <Navigate to="/setup" replace />
  return children
}

export default function App() {
  return (
    <>
      <Nav />
      <Routes>
        <Route path="/"       element={<Navigate to="/login" replace />} />
        <Route path="/login"  element={<Login />} />
        <Route path="/setup"  element={<RequireAuth><Setup /></RequireAuth>} />
        <Route path="/home"   element={<RequireSetup><Home /></RequireSetup>} />
        <Route path="/create" element={<RequireSetup><Create /></RequireSetup>} />
        {/* Vote and Results accessible without login so shared links work */}
        <Route path="/poll/:id"    element={<Vote />} />
        <Route path="/confirm/:id" element={<Confirm />} />
        <Route path="/results/:id" element={<Results />} />
      </Routes>
    </>
  )
}
