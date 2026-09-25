import { useState, useEffect, useCallback } from 'react'
import { 
  startLocationUpdates, 
  stopLocationUpdates, 
  requestLocationPermission,
  getCurrentLocation,
  getLocationPermissionState,
} from '../services/location'

export function useLocation(options: {
  enableHighAccuracy?: boolean
  maximumAge?: number
  timeout?: number
} = {}) {
  const [location, setLocation] = useState<{ lat: number; lon: number } | null>(null)
  const [accuracy, setAccuracy] = useState<number | null>(null)
  const [speed, setSpeed] = useState<number>(0)
  const [permission, setPermission] = useState<PermissionState>('prompt')
  const [error, setError] = useState<string | null>(null)
  const [isWatching, setIsWatching] = useState(false)
  
  const cleanupRef = { current: null as (() => void) | null }
  const optionsRef = { current: options }
  optionsRef.current = options

  useEffect(() => {
    getLocationPermissionState().then(setPermission)
  }, [])

  const start = useCallback(() => {
    if (isWatching) return
    
    setError(null)
    const cleanup = startLocationUpdates(
      (point) => {
        setLocation({ lat: point.lat, lon: point.lon })
        setAccuracy(point.accuracy)
        setSpeed(point.speed)
      },
      optionsRef.current
    )
    
    cleanupRef.current = cleanup
    setIsWatching(true)
  }, [isWatching])

  const stop = useCallback(() => {
    if (cleanupRef.current) {
      cleanupRef.current()
      cleanupRef.current = null
    }
    setIsWatching(false)
  }, [])

  const getCurrent = useCallback(async () => {
    const point = await getCurrentLocation()
    if (point) {
      setLocation({ lat: point.lat, lon: point.lon })
      setAccuracy(point.accuracy)
      setSpeed(point.speed)
    }
    return point
  }, [])

  useEffect(() => {
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current()
      }
    }
  }, [])

  return {
    location,
    accuracy,
    speed,
    permission,
    error,
    isWatching,
    start,
    stop,
    getCurrent,
  }
}

export function useLocationPermission() {
  const [permission, setPermission] = useState<PermissionState>('prompt')
  
  useEffect(() => {
    navigator.permissions.query({ name: 'geolocation' }).then((perm) => {
      setPermission(perm.state)
      perm.addEventListener('change', () => setPermission(perm.state))
    })
  }, [])
  
  const request = async () => {
    const granted = await requestLocationPermission()
    return granted
  }
  
  return { permission, request }
}