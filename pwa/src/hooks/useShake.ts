import { useState, useEffect, useCallback, useRef } from 'react'
import { 
  startShakeDetection, 
  stopShakeDetection, 
  requestMotionPermission,
  isShakeSupported 
} from '../services/sensors'

export function useShake(onShake: () => void, enabled = true) {
  const [supported, setSupported] = useState(false)
  const [permission, setPermission] = useState<'granted' | 'denied' | 'prompt'>('prompt')
  const [active, setActive] = useState(false)
  const cleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    setSupported(isShakeSupported())
  }, [])

  const requestPermission = useCallback(async () => {
    if (!supported) return false
    
    const granted = await requestMotionPermission()
    setPermission(granted ? 'granted' : 'denied')
    return granted
  }, [supported])

  const start = useCallback(() => {
    if (!supported || active || !enabled) return
    
    if (permission === 'denied') {
      console.warn('Motion permission denied')
      return
    }
    
    if (permission === 'prompt') {
      requestPermission().then(granted => {
        if (granted) start()
      })
      return
    }
    
    cleanupRef.current = startShakeDetection(onShake)
    setActive(true)
  }, [onShake, supported, enabled, permission])

  const stop = useCallback(() => {
    if (cleanupRef.current) {
      cleanupRef.current()
      cleanupRef.current = null
    }
    setActive(false)
  }, [])

  useEffect(() => {
    if (enabled && !active && permission === 'granted') {
      start()
    } else if (!enabled && active) {
      stop()
    }
    
    return () => stop()
  }, [enabled, active, start, stop])

  useEffect(() => {
    if (supported) {
      if (typeof (DeviceMotionEvent as { requestPermission?: () => Promise<PermissionState> }).requestPermission === 'function') {
        setPermission('prompt')
      } else {
        setPermission('granted')
      }
    }
  }, [supported])

  return {
    supported,
    permission,
    active,
    start,
    stop,
    requestPermission,
  }
}