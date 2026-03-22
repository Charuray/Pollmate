import { useEffect, useRef, useState } from 'react'

export default function QRModal({ url, onClose }) {
  const canvasRef = useRef(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    import('qrcode').then(QRCode => {
      if (cancelled || !canvasRef.current) return
      QRCode.toCanvas(canvasRef.current, url, {
        width: 220,
        margin: 2,
        color: { dark: '#1A1A2E', light: '#FFFFFF' }
      })
      setLoaded(true)
    })
    return () => { cancelled = true }
  }, [url])

  return (
    <div
      style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.55)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}
      onClick={onClose}
    >
      <div
        style={{ background:'#fff', borderRadius:20, padding:'28px 32px', textAlign:'center', maxWidth:300, width:'90%' }}
        onClick={e => e.stopPropagation()}
      >
        <p style={{ fontSize:13, fontWeight:600, textTransform:'uppercase', letterSpacing:.5, color:'#6B6B8A', marginBottom:16 }}>
          Scan to vote
        </p>
        <canvas ref={canvasRef} style={{ borderRadius:10, display:'block', margin:'0 auto' }} />
        {!loaded && <div className="spinner" style={{ padding:30 }} />}
        <p style={{ fontSize:12, color:'#9999AA', marginTop:14, wordBreak:'break-all' }}>{url}</p>
        <button
          className="btn btn-primary btn-block"
          style={{ marginTop:16 }}
          onClick={async () => { await navigator.clipboard.writeText(url); onClose() }}
        >
          Copy link & close
        </button>
        <button className="btn btn-ghost btn-block btn-sm" style={{ marginTop:8 }} onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  )
}
