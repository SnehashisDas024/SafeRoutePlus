import { VOICE_SAFE_WORD_MIN_CONFIDENCE } from './config'

type VoiceEventKind = 'duress_word' | 'safe_word' | 'checkin_spoken' | 'loud_noise' | 'distress_keyword'
type VoiceHandler = (event: { kind: VoiceEventKind; confidence: number; transcript: string }) => void

let recognition: SpeechRecognition | null = null
let handler: VoiceHandler | null = null
let shouldListen = false

let audioContext: AudioContext | null = null
let mediaStream: MediaStream | null = null
let volumeInterval: number | null = null

const DISTRESS_KEYWORDS = ['help', 'stop', 'please', 'leave me alone', 'police']

function normalize(p: string): string {
  return p.toLowerCase().replace(/[.,!?;:]/g, '').trim()
}

export async function hashPhrase(phrase: string): Promise<string> {
  const data = new TextEncoder().encode(normalize(phrase))
  const buf = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function getCtor(): (new () => SpeechRecognition) | null {
  const w = window as unknown as Record<string, unknown>
  return (w.SpeechRecognition || w.webkitSpeechRecognition) as (new () => SpeechRecognition) | null ?? null
}

export function isVoiceSupported(): boolean {
  return getCtor() !== null
}

export function speak(text: string): Promise<void> {
  if (!('speechSynthesis' in window)) return Promise.resolve()
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'en-US'
    u.rate = 0.9
    u.onend = () => resolve()
    u.onerror = () => resolve()
    window.speechSynthesis.speak(u)
  })
}

async function startScreamDetection() {
  if (audioContext || !shouldListen) return
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true })
    audioContext = new window.AudioContext()
    const source = audioContext.createMediaStreamSource(mediaStream)
    const analyser = audioContext.createAnalyser()
    analyser.fftSize = 256
    source.connect(analyser)
    const dataArray = new Uint8Array(analyser.frequencyBinCount)

    let loudTicks = 0
    volumeInterval = window.setInterval(() => {
      if (!shouldListen) return
      analyser.getByteFrequencyData(dataArray)
      let sum = 0
      for (let i = 0; i < dataArray.length; i++) sum += dataArray[i]
      const avg = sum / dataArray.length
      
      if (avg > 140) { // arbitrary loud threshold
        loudTicks++
        if (loudTicks > 15) { // sustained loud noise for ~1.5s
          handler?.({ kind: 'loud_noise', confidence: 1.0, transcript: '[SUSTAINED LOUD NOISE]' })
          loudTicks = -30 // cooldown
        }
      } else {
        if (loudTicks > 0) loudTicks = 0
        else if (loudTicks < 0) loudTicks++ // cooldown recovery
      }
    }, 100)
  } catch (err) {
    console.warn('AudioContext mic access failed', err)
  }
}

export function startListening(cfg: { safeWordHash: string; duressWordHash: string; enabled: boolean }, onEvent: VoiceHandler) {
  handler = onEvent
  const Ctor = getCtor()
  if (!Ctor || !cfg.enabled) return false
  shouldListen = true
  
  startScreamDetection()

  if (!recognition) {
    recognition = new Ctor()
    recognition.lang = 'en-US'
    recognition.continuous = true
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    recognition.onresult = async (ev: SpeechRecognitionEvent) => {
      const res = ev.results[ev.results.length - 1]
      const transcript = res[0].transcript
      const confidence = res[0].confidence ?? 1.0
      if (!cfg.enabled) return

      const norm = normalize(transcript)

      if (cfg.duressWordHash && await hashPhrase(transcript) === cfg.duressWordHash) {
        handler?.({ kind: 'duress_word', confidence, transcript })
        return
      }

      if (cfg.safeWordHash && await hashPhrase(transcript) === cfg.safeWordHash) {
        if (confidence < VOICE_SAFE_WORD_MIN_CONFIDENCE) return
        handler?.({ kind: 'safe_word', confidence, transcript })
        return
      }

      if (DISTRESS_KEYWORDS.some(k => norm.includes(k))) {
        handler?.({ kind: 'distress_keyword', confidence, transcript })
        return
      }

      handler?.({ kind: 'checkin_spoken', confidence, transcript })
    }
    recognition.onerror = () => { }
    recognition.onend = () => {
      if (shouldListen) {
        try { recognition?.start() } catch { }
      }
    }
  }
  try { recognition.start() } catch { }
  return true
}

export function stopListening() {
  shouldListen = false
  try { recognition?.stop() } catch { }
  if (volumeInterval) window.clearInterval(volumeInterval)
  if (audioContext) {
    audioContext.close()
    audioContext = null
  }
  if (mediaStream) {
    mediaStream.getTracks().forEach(t => t.stop())
    mediaStream = null
  }
}

export function testMicrophone(targetWord: string): Promise<{ match: boolean; transcript: string; confidence: number }> {
  return new Promise((resolve) => {
    const Ctor = getCtor()
    if (!Ctor) { resolve({ match: false, transcript: '', confidence: 0 }); return }
    const test = new Ctor()
    test.lang = 'en-US'
    test.continuous = false
    test.interimResults = true
    test.maxAlternatives = 1
    let finalTranscript = ''
    test.onresult = (ev: SpeechRecognitionEvent) => {
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        if (ev.results[i].isFinal) finalTranscript += ev.results[i][0].transcript
      }
    }
    test.onend = async () => {
      const match = await hashPhrase(finalTranscript) === await hashPhrase(targetWord)
      resolve({ match, transcript: finalTranscript.trim(), confidence: 1.0 })
    }
    test.onerror = () => resolve({ match: false, transcript: '', confidence: 0 })
    try { test.start() } catch { resolve({ match: false, transcript: '', confidence: 0 }) }
  })
}
