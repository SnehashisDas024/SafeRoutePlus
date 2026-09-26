import { useCallback, useEffect, useRef, useState } from 'react'

export interface LocState {
  lat: number
  lon: number
  accuracy: number
  speed: number
  timestamp: number
}

export function useLocation() {
  const [location, setLocation] = useState<LocState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [watching, setWatching] = useState(false)
  const [mockLocation, setMockLocation] = useState<LocState | null>(null)
  const watchId = useRef<number | null>(null)

  const stop = useCallback(() => {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current)
      watchId.current = null
    }
    setWatching(false)
  }, [])

  const start = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setError('Geolocation not supported on this device')
      return
    }
    if (watchId.current !== null) return
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        setLocation({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          speed: pos.coords.speed ?? 0,
          timestamp: pos.timestamp,
        })
        setError(null)
        setWatching(true)
      },
      (err) => setError(err.message),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 },
    )
  }, [])

  useEffect(() => () => stop(), [stop])

  const effectiveLocation = mockLocation || location
  return { location: effectiveLocation, error, watching, start, stop, setMockLocation }
}
