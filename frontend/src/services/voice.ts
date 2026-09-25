import { VOICE_SAFE_WORD_MIN_CONFIDENCE } from './config'

type VoiceEventKind = 'duress_word' | 'safe_word' | 'checkin_spoken'
type VoiceHandler = (event: { kind: VoiceEventKind; confidence: number; transcript: string }) => void

let recognition: SpeechRecognition | null = null
let handler: VoiceHandler | null = null
let shouldListen = false

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

export function startListening(cfg: { safeWordHash: string; duressWordHash: string; enabled: boolean }, onEvent: VoiceHandler) {
  handler = onEvent
  const Ctor = getCtor()
  if (!Ctor || !cfg.enabled) return false
  shouldListen = true
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
      if (await hashPhrase(transcript) === cfg.duressWordHash && cfg.duressWordHash) {
        handler?.({ kind: 'duress_word', confidence, transcript })
        return
      }
      if (cfg.safeWordHash && await hashPhrase(transcript) === cfg.safeWordHash) {
        if (confidence < VOICE_SAFE_WORD_MIN_CONFIDENCE) return // low-confidence safe word ignored
        handler?.({ kind: 'safe_word', confidence, transcript })
        return
      }
      handler?.({ kind: 'checkin_spoken', confidence, transcript })
    }
    recognition.onerror = () => { /* auto-restart via onend */ }
    recognition.onend = () => {
      if (shouldListen) {
        try { recognition?.start() } catch { /* race */ }
      }
    }
  }
  try { recognition.start() } catch { /* already started */ }
  return true
}

export function stopListening() {
  shouldListen = false
  try { recognition?.stop() } catch { /* noop */ }
}

// One-shot microphone test against a target word (plain text, hashed locally)
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

