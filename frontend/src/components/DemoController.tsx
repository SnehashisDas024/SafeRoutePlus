import { useState, useRef, useEffect } from 'react'
import { IconPlay, IconAlert, IconSiren, IconWalk } from './Icons'
import type { LocState } from '../hooks/useLocation'

interface DemoControllerProps {
  activePath: [number, number][] | null
  setMockLocation: (loc: LocState | null) => void
  onVoiceEvent: (kind: 'loud_noise' | 'distress_keyword', confidence: number) => void
}

export default function DemoController({ activePath, setMockLocation, onVoiceEvent }: DemoControllerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isSimulating, setIsSimulating] = useState(false)
  const stepRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  const startDrive = () => {
    if (!activePath || activePath.length === 0) {
      alert("No active path loaded!")
      return
    }
    setIsSimulating(true)
    stepRef.current = 0
    if (timerRef.current) clearInterval(timerRef.current)
    
    // Move along the path every 1 second
    timerRef.current = setInterval(() => {
      if (stepRef.current >= activePath.length) {
        clearInterval(timerRef.current!)
        setIsSimulating(false)
        return
      }
      const [lon, lat] = activePath[stepRef.current]
      setMockLocation({
        lat, lon, accuracy: 5, speed: 1.5, timestamp: Date.now()
      })
      stepRef.current += 3 // Skip a few points to make demo faster
    }, 1000)
  }

  const stopDrive = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    setIsSimulating(false)
    setMockLocation(null)
  }

  const simulateDeviation = () => {
    if (!activePath || activePath.length === 0) return
    const [lon, lat] = activePath[Math.floor(activePath.length / 2)]
    // Teleport 1km away
    setMockLocation({
      lat: lat + 0.01, lon: lon + 0.01, accuracy: 5, speed: 0, timestamp: Date.now()
    })
  }

  const simulateLoudNoise = () => {
    onVoiceEvent('loud_noise', 0.95)
  }

  const simulateKeyword = () => {
    onVoiceEvent('distress_keyword', 0.99)
  }

  return (
    <div style={{
      position: 'absolute', top: 20, right: 20, zIndex: 9999,
      background: 'rgba(30, 78, 110, 0.95)', padding: 15, borderRadius: 12,
      boxShadow: '0 8px 32px rgba(0,0,0,0.3)', color: '#fff',
      width: isOpen ? 250 : 'auto', transition: 'width 0.2s',
      border: '1px solid rgba(255,255,255,0.2)'
    }}>
      <div 
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 'bold' }}>
          <IconWalk size={18} /> {isOpen ? "Hackathon Demo Panel" : "Demo"}
        </div>
        <span style={{ fontSize: 18 }}>{isOpen ? '?' : '?'}</span>
      </div>

      {isOpen && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 15 }}>
          <div style={{ fontSize: 11, color: '#aaa', textTransform: 'uppercase', letterSpacing: 1 }}>Movement</div>
          {isSimulating ? (
            <button onClick={stopDrive} className="clay-btn" style={{ background: '#F44336', color: '#fff', borderColor: '#D32F2F', padding: 8 }}>
              Stop Simulation
            </button>
          ) : (
            <button onClick={startDrive} className="clay-btn" style={{ background: '#4CAF50', color: '#fff', borderColor: '#388E3C', padding: 8 }}>
              <IconPlay size={14} /> Simulate Drive
            </button>
          )}
          <button onClick={simulateDeviation} className="clay-btn" style={{ background: '#FF9800', color: '#fff', borderColor: '#F57C00', padding: 8 }}>
            <IconAlert size={14} /> Teleport 1km (Deviation)
          </button>
          
          <div style={{ fontSize: 11, color: '#aaa', textTransform: 'uppercase', letterSpacing: 1, marginTop: 10 }}>Audio Events</div>
          <button onClick={simulateLoudNoise} className="clay-btn" style={{ background: '#E91E63', color: '#fff', borderColor: '#C2185B', padding: 8 }}>
            <IconSiren size={14} /> Trigger "Scream"
          </button>
          <button onClick={simulateKeyword} className="clay-btn" style={{ background: '#9C27B0', color: '#fff', borderColor: '#7B1FA2', padding: 8 }}>
            <IconAlert size={14} /> Trigger "Help" Word
          </button>
        </div>
      )}
    </div>
  )
}
