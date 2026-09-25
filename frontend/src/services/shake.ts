import { SHAKE_THRESHOLD, SHAKE_COOLDOWN_MS } from './config'

export function useShake(onShake: () => void) {
  let lastX = 0, lastY = 0, lastZ = 0
  let lastFire = 0
  let active = false

  const handle = (e: DeviceMotionEvent) => {
    const acc = e.accelerationIncludingGravity
    if (!acc) return
    const now = Date.now()
    if (now - lastFire < SHAKE_COOLDOWN_MS) return
    const dx = Math.abs((acc.x ?? 0) - lastX)
    const dy = Math.abs((acc.y ?? 0) - lastY)
    const dz = Math.abs((acc.z ?? 0) - lastZ)
    lastX = acc.x ?? 0; lastY = acc.y ?? 0; lastZ = acc.z ?? 0
    if (dx + dy + dz > SHAKE_THRESHOLD * 3) {
      lastFire = now
      onShake()
    }
  }

  return {
    start() {
      if (active) return
      active = true
      window.addEventListener('devicemotion', handle)
    },
    stop() {
      active = false
      window.removeEventListener('devicemotion', handle)
    },
  }
}
