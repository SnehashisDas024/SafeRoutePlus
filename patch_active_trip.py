import os
import codecs

path = r'C:\Users\sneha\Desktop\SafeRoutePlus\frontend\src\screens\ActiveTripScreen.tsx'
with codecs.open(path, 'r', 'utf-8') as f:
    content = f.read()

# Add import
content = content.replace("import { getVoiceConfig, safePlanRoute } from '../services/api'", "import { getVoiceConfig, safePlanRoute, uploadAudioChunk, triggerSOS } from '../services/api'")

# Add states
state_injection = """
  const [pendingSos, setPendingSos] = useState(false)
  const [sosCountdown, setSosCountdown] = useState(5)

  useEffect(() => {
    let timer: any
    if (pendingSos && sosCountdown > 0) {
      timer = setTimeout(() => setSosCountdown(c => c - 1), 1000)
    } else if (pendingSos && sosCountdown === 0) {
      setPendingSos(false)
      if (tripId) triggerSOS(tripId).catch(console.error)
    }
    return () => clearTimeout(timer)
  }, [pendingSos, sosCountdown, tripId])

  useEffect(() => {
    if (!tripId) return
    let mediaRecorder: MediaRecorder | null = null
    let audioChunks: BlobPart[] = []
    let cancelled = false
    let recordTimer: any

    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
      if (cancelled) return
      mediaRecorder = new MediaRecorder(stream)
      
      mediaRecorder.ondataavailable = e => {
        audioChunks.push(e.data)
      }
      
      mediaRecorder.onstop = async () => {
        if (cancelled) return
        if (audioChunks.length > 0) {
          const audioBlob = new Blob(audioChunks, { type: 'audio/webm' })
          audioChunks = []
          try {
            const res = await uploadAudioChunk(tripId, audioBlob)
            if (res.action === 'trigger_sos') {
              if (navigator.vibrate) navigator.vibrate([500, 250, 500])
              setPendingSos(true)
              setSosCountdown(5)
            }
          } catch (e) {
            console.error(e)
          }
        }
        if (!cancelled && mediaRecorder && mediaRecorder.state === 'inactive') {
          mediaRecorder.start()
          recordTimer = setTimeout(() => mediaRecorder?.stop(), 5000)
        }
      }
      
      mediaRecorder.start()
      recordTimer = setTimeout(() => mediaRecorder?.stop(), 5000)
    }).catch(console.error)

    return () => {
      cancelled = true
      clearTimeout(recordTimer)
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop()
      }
    }
  }, [tripId])
"""
content = content.replace("const [communityReports, setCommunityReports] = useState<any[]>([])", "const [communityReports, setCommunityReports] = useState<any[]>([])" + state_injection)

# Add UI for pending SOS
ui_injection = """
      {pendingSos && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(255,0,0,0.9)', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
          <IconSiren size={80} color="#fff" />
          <h1 style={{ fontSize: 40, marginTop: 20 }}>SOS TRIGGERED</h1>
          <p style={{ fontSize: 20 }}>Audio analysis detected distress.</p>
          <div style={{ fontSize: 80, fontWeight: 900 }}>{sosCountdown}</div>
          <button className="clay-btn" style={{ background: '#fff', color: '#F44336', padding: '15px 40px', fontSize: 20, marginTop: 30 }} onClick={() => setPendingSos(false)}>CANCEL</button>
        </div>
      )}
"""
content = content.replace("<EscalationBanner level={level} reason={escalation?.reason} />", "<EscalationBanner level={level} reason={escalation?.reason} />\n" + ui_injection)

with codecs.open(path, 'w', 'utf-8') as f:
    f.write(content)
print("Updated ActiveTripScreen.tsx with audio processing")
