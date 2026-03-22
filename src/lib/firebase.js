import { initializeApp, getApps } from 'firebase/app'
import {
  getFirestore, doc, getDoc, setDoc, deleteDoc,
  collection, getDocs, updateDoc, arrayUnion
} from 'firebase/firestore'
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth'

// ─────────────────────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey:            import.meta.env.VITE_API_KEY,
  authDomain:        import.meta.env.VITE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_APP_ID,
};
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]
export const db   = getFirestore(app)
export const auth = getAuth(app)

// ── Auth ──────────────────────────────────────────────────────────────────
const provider = new GoogleAuthProvider()

export async function signInWithGoogle() {
  const result = await signInWithPopup(auth, provider)
  try {
    const snap = await getDoc(doc(db, 'users', result.user.uid))
    if (snap.exists()) {
      const d = snap.data()
      if (d.clubName)  localStorage.setItem('club_name', d.clubName)
      if (d.voterName) localStorage.setItem('voter_name', d.voterName)
    }
  } catch {}
  return result
}

export const signOutUser = () => signOut(auth)

export async function saveUserProfile(clubName, voterName) {
  const user = auth.currentUser
  if (!user) return
  localStorage.setItem('club_name', clubName)
  localStorage.setItem('voter_name', voterName || user.displayName || '')
  await setDoc(doc(db, 'users', user.uid), {
    clubName,
    voterName: voterName || user.displayName || '',
    email: user.email || '',
    updatedAt: new Date(),
  }, { merge: true })
}

// ── Options ────────────────────────────────────────────────────────────────
// Firestore stores options as an array.
// After dot-notation updates (options.0.votes), Firestore converts the array
// to a map: {"0":{votes:1},"1":{votes:0}} — losing the text field.
// This helper always reconstructs a clean array with all fields guaranteed.
export function getOpts(options) {
  if (!options) return []
  const raw = Array.isArray(options) ? options : Object.values(options)
  return raw.map((o, i) => ({
    id:         o?.id         ?? `opt${i}`,
    text:       o?.text       ?? '',
    votes:      typeof o?.votes === 'number' ? o.votes : 0,
    voterNames: Array.isArray(o?.voterNames) ? o.voterNames : [],
    limit:      o?.limit      ?? null,
  }))
}

// ── THE FIX: write the full options array on every vote ────────────────────
// Instead of dot-notation partial updates which corrupt the array structure,
// we read → modify → write the entire options array atomically.
export async function castVote(pollId, optionId, voterName, isAnonymous) {
  const pollRef  = doc(db, 'polls', pollId)
  const pollSnap = await getDoc(pollRef)
  if (!pollSnap.exists()) throw new Error('Poll not found')

  const data = pollSnap.data()
  const opts = getOpts(data.options)
  const idx  = opts.findIndex(o => o.id === optionId)
  if (idx < 0) throw new Error('Option not found')

  // Mutate the full array — text and all fields preserved
  opts[idx].votes = (opts[idx].votes || 0) + 1
  if (!isAnonymous && voterName) {
    opts[idx].voterNames = [...(opts[idx].voterNames || []), voterName]
  }

  await updateDoc(pollRef, {
    options:    opts,
    totalVotes: (data.totalVotes || 0) + 1,
  })
}

// Retract vote — same pattern: read full array, decrement, write back
export async function retractVote(pollId, optionId, voterName, isAnonymous) {
  const pollRef  = doc(db, 'polls', pollId)
  const pollSnap = await getDoc(pollRef)
  if (!pollSnap.exists()) throw new Error('Poll not found')

  const data = pollSnap.data()
  const opts = getOpts(data.options)
  const idx  = opts.findIndex(o => o.id === optionId)
  if (idx < 0) throw new Error('Option not found')

  opts[idx].votes = Math.max(0, (opts[idx].votes || 0) - 1)
  if (!isAnonymous && voterName) {
    opts[idx].voterNames = (opts[idx].voterNames || []).filter(n => n !== voterName)
  }

  // Also delete from votes subcollection
  try {
    const uid      = getUID()
    const votesSnap = await getDocs(collection(db, 'polls', pollId, 'votes'))
    for (const d of votesSnap.docs) {
      if (d.data().uid === uid) await deleteDoc(d.ref)
    }
  } catch {}

  await updateDoc(pollRef, {
    options:    opts,
    totalVotes: Math.max(0, (data.totalVotes || 0) - 1),
  })
}

// Add suggested option to poll
export async function approveSuggestion(pollId, sugText, sugDocId) {
  const pollRef  = doc(db, 'polls', pollId)
  const pollSnap = await getDoc(pollRef)
  if (!pollSnap.exists()) return
  const opts = getOpts(pollSnap.data().options)
  const newOpt = { id: `opt${opts.length}`, text: sugText, votes: 0, voterNames: [], limit: null }
  await updateDoc(pollRef, { options: [...opts, newOpt] })
  await deleteDoc(doc(db, 'polls', pollId, 'suggestions', sugDocId))
}

// Delete poll + all subcollections
export async function deletePoll(pollId) {
  try {
    const votesSnap = await getDocs(collection(db, 'polls', pollId, 'votes'))
    for (const d of votesSnap.docs) await deleteDoc(d.ref)
    const sugSnap = await getDocs(collection(db, 'polls', pollId, 'suggestions'))
    for (const d of sugSnap.docs) await deleteDoc(d.ref)
  } catch {}
  await deleteDoc(doc(db, 'polls', pollId))
}

// ── Vote limit helpers ─────────────────────────────────────────────────────
export function isFull(opt) {
  if (!opt.limit) return false
  return opt.votes >= opt.limit
}

export function slotStatus(opt) {
  if (!opt.limit || opt.limit <= 0) return 'none'
  const left = opt.limit - opt.votes
  if (left <= 0) return 'full'
  if (left <= 2 || left / opt.limit <= 0.15) return 'warn'
  return 'ok'
}

// ── Device / identity ──────────────────────────────────────────────────────
export function getDeviceId() {
  let id = localStorage.getItem('device_id')
  if (!id) {
    id = 'xxxx-4xxx-yxxx-xxxx'.replace(/[xy]/g, c => {
      const r = (Math.random() * 16) | 0
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
    })
    localStorage.setItem('device_id', id)
  }
  return id
}

export const getUID       = () => auth.currentUser?.uid || getDeviceId()
export const getVoterName = () => auth.currentUser?.displayName || localStorage.getItem('voter_name') || 'Anonymous'
export const setVoterName = (v) => localStorage.setItem('voter_name', v)
export const getClubName  = () => localStorage.getItem('club_name') || ''
export const setClubName  = (v) => localStorage.setItem('club_name', v)
export const hasVoted     = (id) => localStorage.getItem(`voted_${id}`) !== null
export const markVoted    = (id, opt) => localStorage.setItem(`voted_${id}`, opt)
export const clearVote    = (id) => localStorage.removeItem(`voted_${id}`)
export const getVotedOpt  = (id) => localStorage.getItem(`voted_${id}`)
export const isCreator    = (id) => localStorage.getItem(`created_${id}`) === 'true'
export const markCreator  = (id) => localStorage.setItem(`created_${id}`, 'true')
