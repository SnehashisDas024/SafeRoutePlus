import { useState, useEffect, useCallback, useRef } from 'react'
import { 
  initVoice, 
  startListening, 
  stopListening, 
  speak, 
  setVoiceConfig as setVoiceConfigService,
  getVoiceConfig,
  testPhrase,
  setVoiceHandler,
  isVoiceSupported,
} from '../services/voice'
import type { VoiceEventKind } from '../types'

export function useVoice() {
  const [config, setConfigState] = useState<{ safeWordHash: string; duressWordHash: string; enabled: boolean } | null>(null)
  const [supported, setSupported] = useState(false)
  const [listening, setListening] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const handlerRef = useRef<((event: { kind: string; confidence: number }) => void) | null>(null)

  useEffect(() => {
    setSupported(isVoiceSupported())
    loadConfig()
  }, [])

  const loadConfig = async () => {
    try {
      const cfg = await getVoiceConfig()
      if (cfg) {
        setConfigState(cfg)
        initVoice(cfg)
      }
    } catch (error) {
      console.warn('Failed to load voice config:', error)
    }
  }

  const setVoiceConfig = async (safeWord: string, duressWord: string, enabled = true) => {
    try {
      const encoder = new TextEncoder()
      const safeData = encoder.encode(safeWord.toLowerCase().replace(/[.,!?;:]/g, '').trim())
      const duressData = encoder.encode(duressWord.toLowerCase().replace(/[.,!?;:]/g, '').trim())
      
      const safeHashBuffer = await crypto.subtle.digest('SHA-256', safeData)
      const duressHashBuffer = await crypto.subtle.digest('SHA-256', duressData)
      
      const safeHashArray = Array.from(new Uint8Array(safeHashBuffer))
      const duressHashArray = Array.from(new Uint8Array(duressHashBuffer))
      
      const safeHash = safeHashArray.map(b => b.toString(16).padStart(2, '0')).join('')
      const duressHash = duressHashArray.map(b => b.toString(16).padStart(2, '0')).join('')
      
      const newConfig = {
        safeWordHash: safeHash,
        duressWordHash: duressHash,
        enabled,
      }
      
      await setVoiceConfigService(newConfig)
      setConfigState(newConfig)
      initVoice(newConfig)
    } catch (error) {
      console.error('Failed to set voice config:', error)
      throw error
    }
  }

  // Toggle just the enabled state
  const setVoiceEnabled = async (enabled: boolean) => {
    if (!config) return
    try {
      const newConfig = { ...config, enabled }
      await setVoiceConfigService(newConfig)
      setConfigState(newConfig)
      initVoice(newConfig)
    } catch (error) {
      console.error('Failed to set voice enabled:', error)
      throw error
    }
  }

  const setHandler = useCallback((handler: (event: { kind: string; confidence: number }) => void) => {
    handlerRef.current = handler
  }, [])

  // Set up the handler in voice service
  useEffect(() => {
    setVoiceHandler((event: { kind: string; confidence: number }) => {
      handlerRef.current?.(event)
    })
  }, [])

  const start = useCallback((windowMs = 8000) => {
    if (!config?.enabled) return
    startListening(windowMs)
    setListening(true)
  }, [config?.enabled])

  const stop = useCallback(() => {
    stopListening()
    setListening(false)
  }, [])

  const speakText = useCallback(async (text: string) => {
    setSpeaking(true)
    await speak(text)
    setSpeaking(false)
  }, [])

  const testSafeWord = async (safeWord: string) => {
    if (!config) return { match: false, confidence: 0 }
    return testPhrase(safeWord, config.safeWordHash)
  }

  const testDuressWord = async (duressWord: string) => {
    if (!config) return { match: false, confidence: 0 }
    return testPhrase(duressWord, config.duressWordHash)
  }

  return {
    config,
    supported,
    listening,
    speaking,
    setConfig: setVoiceConfig,
    setVoiceEnabled,
    setHandler,
    startListening: start,
    stopListening: stop,
    speak: speakText,
    testSafeWord,
    testDuressWord,
  }
}