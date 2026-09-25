import { SHAKE_THRESHOLD, SHAKE_COOLDOWN_MS } from './config'

let shakeCallback: (() => void) | null = null
let lastShakeTime = 0

function handleMotion(event: DeviceMotionEvent) {
  const acc = event.accelerationIncludingGravity
  if (!acc) return
  
  const magnitude = Math.sqrt(
    (acc.x ?? 0) ** 2 + (acc.y ?? 0) ** 2 + (acc.z ?? 0) ** 2
  )
  
  const now = Date.now()
  
  if (magnitude > SHAKE_THRESHOLD && now - lastShakeTime > SHAKE_COOLDOWN_MS) {
    lastShakeTime = now
    shakeCallback?.()
  }
}

const DeviceMotionEventWithPermission = DeviceMotionEvent as { requestPermission?: () => Promise<PermissionState> }

export async function requestMotionPermission(): Promise<boolean> {
  if (typeof DeviceMotionEventWithPermission.requestPermission === 'function') {
    try {
      const permission = await DeviceMotionEventWithPermission.requestPermission()
      return permission === 'granted'
    } catch {
      return false
    }
  }
  return true
}

export function startShakeDetection(callback: () => void): () => void {
  shakeCallback = callback
  
  if (typeof DeviceMotionEventWithPermission.requestPermission === 'function') {
    DeviceMotionEventWithPermission.requestPermission().then((granted: PermissionState) => {
      if (granted === 'granted') {
        window.addEventListener('devicemotion', handleMotion)
      }
    })
  } else {
    window.addEventListener('devicemotion', handleMotion)
  }
  
  // Return cleanup function
  return () => {
    shakeCallback = null
    window.removeEventListener('devicemotion', handleMotion)
  }
}

export function stopShakeDetection() {
  shakeCallback = null
  window.removeEventListener('devicemotion', handleMotion)
}

export function isShakeSupported(): boolean {
  return 'DeviceMotionEvent' in window
}

export async function requestMotionPermissionIfNeeded(): Promise<boolean> {
  if (typeof DeviceMotionEventWithPermission.requestPermission === 'function') {
    try {
      const permission = await DeviceMotionEventWithPermission.requestPermission()
      return permission === 'granted'
    } catch {
      return false
    }
  }
  return true
}

export function getShakeConfig() {
  return {
    threshold: SHAKE_THRESHOLD,
    cooldown: SHAKE_COOLDOWN_MS,
  }
}

export function setShakeConfig(config: { threshold?: number; cooldown?: number }) {
  // These are constants from config, but we could make them mutable if needed
  console.warn('Shake config is read-only, defined in config.ts')
}