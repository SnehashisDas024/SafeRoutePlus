import { VOICE_LISTEN_WINDOW_MS, VOICE_SAFE_WORD_MIN_CONFIDENCE } from './config'
import type { VoiceConfig } from '../types'

type VoiceEventKind = 'duress_word' | 'safe_word' | 'checkin_spoken' | 'no_response'
type VoiceHandler = (event: { kind: VoiceEventKind; confidence: number }) => void

let recognition: SpeechRecognition | null = null
let voiceHandler: VoiceHandler | null = null
let currentConfig: VoiceConfig | null = null
let isListening = false

function normalizePhrase(phrase: string): string {
  return phrase.toLowerCase().replace(/[.,!?;:]/g, '').trim()
}

async function hashPhrase(phrase: string): Promise<string> {
  const normalized = normalizePhrase(phrase)
  const encoder = new TextEncoder()
  const data = encoder.encode(normalized)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

async function checkMatch(spoken: string, targetHash: string): Promise<boolean> {
  return hashPhrase(spoken).then(h => h === targetHash)
}

function getSpeechRecognition(): { new(): SpeechRecognition } | null {
  const w = window as unknown as { SpeechRecognition?: { new(): SpeechRecognition }; webkitSpeechRecognition?: { new(): SpeechRecognition } }
  return w.SpeechRecognition || w.webkitSpeechRecognition || null
}

export async function initVoice(config: VoiceConfig): Promise<boolean> {
  currentConfig = config
  
  const SpeechRecognitionCtor = getSpeechRecognition()
  if (!SpeechRecognitionCtor) {
    console.warn('Speech Recognition not supported')
    return false
  }
  
  recognition = new SpeechRecognitionCtor()
  recognition.lang = 'en-US'
  recognition.continuous = true
  recognition.interimResults = false
  recognition.maxAlternatives = 1
  
  recognition.onresult = async (event: SpeechRecognitionEvent) => {
    if (!event.results.length) return
    
    const spoken = event.results[0][0].transcript
    const confidence = event.results[0][0].confidence ?? 1.0
    
    console.log('Voice recognized:', spoken, 'confidence:', confidence)
    
    if (!currentConfig || !currentConfig.enabled) return
    
    const normalized = normalizePhrase(spoken)
    
    // Check duress word first (higher priority)
    const isDuress = await checkMatch(normalized, currentConfig.duressWordHash)
    if (isDuress) {
      voiceHandler?.({ kind: 'duress_word', confidence })
      return
    }
    
    // Check safe word
    const isSafe = await checkMatch(normalized, currentConfig.safeWordHash)
    if (isSafe) {
      // Low confidence safe word does NOT de-escalate
      if (confidence < VOICE_SAFE_WORD_MIN_CONFIDENCE) {
        console.log('Safe word low confidence, ignoring')
        return
      }
      voiceHandler?.({ kind: 'safe_word', confidence })
      return
    }
    
    // If we're in a check-in window, treat any speech as checkin_spoken
    voiceHandler?.({ kind: 'checkin_spoken', confidence })
  }
  
  recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
    console.error('Voice error:', event.error)
  }
  
  recognition.onend = () => {
    isListening = false
    // Auto-restart if we should be listening
    if (isListening && currentConfig?.enabled && recognition) {
      try {
        recognition.start()
      } catch (err) {
        console.error('Voice restart error:', err)
      }
    }
  }
  
  try {
    await recognition.start()
    isListening = true
    console.log('Voice recognition started')
    return true
  } catch (err) {
    console.error('Voice init error:', err)
    return false
  }
}

export function setVoiceHandler(handler: (event: { kind: VoiceEventKind; confidence: number }) => void) {
  voiceHandler = handler
}

export function startListening(windowMs: number = VOICE_LISTEN_WINDOW_MS) {
  if (!recognition || isListening) return
  
  isListening = true
  try {
    recognition.start()
  } catch (err) {
    console.error('Voice start error:', err)
  }
  
  // Auto-stop after window (for check-in)
  setTimeout(() => {
    if (isListening) {
      stopListening()
      voiceHandler?.({ kind: 'no_response', confidence: 0 })
    }
  }, windowMs)
}

export function stopListening() {
  isListening = false
  recognition?.stop()
}

export function speak(text: string): Promise<void> {
  if (!('speechSynthesis' in window)) return Promise.resolve()
  
  return new Promise<void>((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'en-US'
    utterance.rate = 0.9
    utterance.pitch = 1.0
    utterance.onend = () => resolve()
    utterance.onerror = () => resolve()
    window.speechSynthesis.speak(utterance)
  })
}

export function setConfig(config: VoiceConfig) {
  currentConfig = config
}

export function getConfig(): VoiceConfig | null {
  return currentConfig
}

export function getVoiceConfig(): VoiceConfig | null {
  return currentConfig
}

export function setVoiceConfig(config: VoiceConfig) {
  currentConfig = config
}

export async function testPhrase(phrase: string, targetHash: string): Promise<{ match: boolean; confidence: number }> {
  const normalized = normalizePhrase(phrase)
  const match = await checkMatch(normalized, targetHash)
  return { match, confidence: 1.0 }
}

// Real microphone test using Web Speech API
export function testMicrophone(targetWord: string): Promise<{ match: boolean; transcript: string; confidence: number }> {
  return new Promise((resolve) => {
    const SpeechRecognitionCtor = getSpeechRecognition()
    if (!SpeechRecognitionCtor) {
      resolve({ match: false, transcript: '', confidence: 0 })
      return
    }
    
    const testRecognition = new SpeechRecognitionCtor()
    testRecognition.lang = 'en-US'
    testRecognition.continuous = false
    testRecognition.interimResults = true
    testRecognition.maxAlternatives = 1
    
    let finalTranscript = ''
    
    testRecognition.onresult = async (event: SpeechRecognitionEvent) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        const conf = event.results[i][0].confidence ?? 1.0
        if (event.results[i].isFinal) {
          finalTranscript = transcript
        } else {
          interim += transcript
        }
      }
    }
    
    testRecognition.onend = async () => {
      const normalized = normalizePhrase(finalTranscript)
      const match = await checkMatch(normalized, await hashPhrase(targetWord))
      resolve({ match, transcript: finalTranscript, confidence: 1.0 })
    }
    
    testRecognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Test mic error:', event.error)
      resolve({ match: false, transcript: '', confidence: 0 })
    }
    
    try {
      testRecognition.start()
    } catch (err) {
      console.error('Test mic start error:', err)
      resolve({ match: false, transcript: '', confidence: 0 })
    }
  })
}

export async function setVoiceConfigAPI(safeWordHash: string, duressWordHash: string, enabled: boolean): Promise<void> {
  const res = await fetch('/users/voice-config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'test_user_id' },
    body: JSON.stringify({ safe_word_hash: safeWordHash, duress_word_hash: duressWordHash, enabled })
  })
  if (!res.ok) throw new Error('Failed to save voice config')
}

export function isVoiceSupported(): boolean {
  return getSpeechRecognition() !== null
}

export type { VoiceEventKind }