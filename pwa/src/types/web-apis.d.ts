// Web API Type Definitions for PWA

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number
  readonly results: SpeechRecognitionResultList
}

interface SpeechRecognitionResultList {
  readonly length: number
  item(index: number): SpeechRecognitionResult
  [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionResult {
  readonly length: number
  item(index: number): SpeechRecognitionAlternative
  [index: number]: SpeechRecognitionAlternative
  readonly isFinal: boolean
}

interface SpeechRecognitionAlternative {
  readonly transcript: string
  readonly confidence: number
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string
  readonly message: string
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean
  grammars: SpeechGrammarList
  interimResults: boolean
  lang: string
  maxAlternatives: number
  serviceURI: string
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => void) | null
  onstart: ((this: SpeechRecognition, ev: Event) => void) | null
  onend: ((this: SpeechRecognition, ev: Event) => void) | null
  start(): void
  stop(): void
  abort(): void
}

interface SpeechGrammarList {
  readonly length: number
  item(index: number): SpeechGrammar
  [index: number]: SpeechGrammar
  addFromURI(src: string, weight?: number): void
  addFromString(string: string, weight?: number): void
}

interface SpeechGrammar {
  src: string
  weight: number
}

interface DeviceMotionEventInit extends EventInit {
  acceleration?: DeviceAccelerationInit | null
  accelerationIncludingGravity?: DeviceAccelerationInit | null
  rotationRate?: DeviceRotationRateInit | null
  interval?: number
}

interface DeviceAccelerationInit {
  x?: number | null
  y?: number | null
  z?: number | null
}

interface DeviceRotationRateInit {
  alpha?: number | null
  beta?: number | null
  gamma?: number | null
}

interface DeviceMotionEvent {
  readonly acceleration: DeviceAcceleration | null
  readonly accelerationIncludingGravity: DeviceAcceleration | null
  readonly rotationRate: DeviceRotationRate | null
  readonly interval: number
}

interface DeviceMotionEventConstructor {
  prototype: DeviceMotionEvent
  new(type: string, eventInitDict?: DeviceMotionEventInit): DeviceMotionEvent
  requestPermission?: () => Promise<PermissionState>
}

interface DeviceAcceleration {
  readonly x: number | null
  readonly y: number | null
  readonly z: number | null
}

interface DeviceRotationRate {
  readonly alpha: number | null
  readonly beta: number | null
  readonly gamma: number | null
}

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
  prompt(): Promise<void>
}

// Extend Window interface
declare global {
  interface Window {
    SpeechRecognition: {
      prototype: SpeechRecognition
      new(): SpeechRecognition
    }
    webkitSpeechRecognition: {
      prototype: SpeechRecognition
      new(): SpeechRecognition
    }
    SpeechGrammarList: {
      prototype: SpeechGrammarList
      new(): SpeechGrammarList
    }
    DeviceMotionEvent: DeviceMotionEventConstructor
  }
}

// Navigator extensions
interface Navigator {
  permissions: Permissions
}