import Voice from '@react-native-voice/voice';
import * as Speech from 'expo-speech';
import { BASE_URL } from './config';

export interface VoiceConfig {
  safeWordHash: string;
  duressWordHash: string;
  enabled: boolean;
}

export interface VoiceHashes {
  safeWordHash: string;
  duressWordHash: string;
}

type VoiceHandler = (event: { kind: 'duress_word' | 'safe_word' | 'checkin_spoken' | 'no_response'; confidence: number }) => void;

let voiceHandler: VoiceHandler | null = null;
let currentConfig: VoiceConfig | null = null;
let isListening = false;
let listeningTimeout: ReturnType<typeof setTimeout> | null = null;
const LISTEN_WINDOW_MS = 8000; // 8 seconds for check-in response

function normalizePhrase(phrase: string): string {
  return phrase.toLowerCase().replace(/[.,!?;:]/g, '').trim();
}

async function hashPhrase(phrase: string): Promise<string> {
  const normalized = normalizePhrase(phrase);
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function checkMatch(spoken: string, targetHash: string): Promise<boolean> {
  return hashPhrase(spoken).then(h => h === targetHash);
}

Voice.onSpeechResults = async (e: any) => {
  if (!e.value || e.value.length === 0) return;
  
  const spoken = e.value[0];
  const confidence = e.confidence?.[0] ?? 1.0;
  
  console.log('Voice recognized:', spoken, 'confidence:', confidence);
  
  if (!currentConfig || !currentConfig.enabled) return;
  
  const normalized = normalizePhrase(spoken);
  
  // Check duress word first (higher priority)
  const isDuress = await checkMatch(normalized, currentConfig.duressWordHash);
  if (isDuress) {
    voiceHandler?.({ kind: 'duress_word', confidence });
    return;
  }
  
  // Check safe word
  const isSafe = await checkMatch(normalized, currentConfig.safeWordHash);
  if (isSafe) {
    // Low confidence safe word does NOT de-escalate
    if (confidence < 0.6) {
      console.log('Safe word low confidence, ignoring');
      return;
    }
    voiceHandler?.({ kind: 'safe_word', confidence });
    return;
  }
  
  // If we're in a check-in window, treat any speech as checkin_spoken
  voiceHandler?.({ kind: 'checkin_spoken', confidence });
};

Voice.onSpeechError = (e: any) => {
  console.error('Voice error:', e.error);
};

Voice.onSpeechEnd = () => {
  isListening = false;
};

Voice.onSpeechVolumeChanged = (e: any) => {
  // Can be used for visual feedback
};

export async function initVoice(config: VoiceConfig) {
  currentConfig = config;
  
  try {
    await Voice.start('en-US');
    console.log('Voice recognition started');
  } catch (err) {
    console.error('Voice init error:', err);
  }
}

export function setVoiceHandler(handler: VoiceHandler) {
  voiceHandler = handler;
}

export function startListening(windowMs: number = LISTEN_WINDOW_MS) {
  if (isListening) return;
  
  isListening = true;
  Voice.start('en-US').catch(console.error);
  
  // Auto-stop after window
  if (listeningTimeout) clearTimeout(listeningTimeout);
  listeningTimeout = setTimeout(() => {
    stopListening();
    voiceHandler?.({ kind: 'no_response', confidence: 0 });
  }, windowMs);
}

export function stopListening() {
  isListening = false;
  if (listeningTimeout) clearTimeout(listeningTimeout);
  Voice.stop().catch(console.error);
}

export async function speak(text: string) {
  await Speech.speak(text, {
    language: 'en-US',
    pitch: 1.0,
    rate: 0.9,
  });
}

export function setConfig(config: VoiceConfig) {
  currentConfig = config;
}

export function getConfig(): VoiceConfig | null {
  return currentConfig;
}

export async function testPhrase(phrase: string, targetHash: string): Promise<{ match: boolean; confidence: number }> {
  const normalized = normalizePhrase(phrase);
  const match = await checkMatch(normalized, targetHash);
  return { match, confidence: 1.0 };
}

export async function setVoiceConfig(safeWordHash: string, duressWordHash: string, enabled: boolean) {
  const res = await fetch(`${BASE_URL}/users/voice-config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'test_user_id' },
    body: JSON.stringify({ safe_word_hash: safeWordHash, duress_word_hash: duressWordHash, enabled }),
  });
  if (!res.ok) throw new Error('Failed to save voice config');
}