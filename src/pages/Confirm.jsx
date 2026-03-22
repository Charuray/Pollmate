import { useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'

export default function Confirm() {
  const { id } = useParams()
  const nav = useNavigate()
  const [params] = useSearchParams()
  const option = decodeURIComponent(params.get('option') || '')

  useEffect(() => {
    const t = setTimeout(() => nav(`/results/${id}`, { replace: true }), 2500)
    return () => clearTimeout(t)
  }, [id])

  return (
    <div className="confirm-page">
      <div className="confirm-circle">✓</div>
      <h1 className="confirm-title">Your vote is in!</h1>
      <p className="small t2 mb-2">You voted for</p>
      <div className="confirm-voted">{option}</div>
      <p className="smaller t3" style={{ marginBottom: 24 }}>Taking you to results...</p>
      <button className="btn btn-outline" onClick={() => nav(`/results/${id}`, { replace: true })}>
        See results now →
      </button>
    </div>
  )
}
