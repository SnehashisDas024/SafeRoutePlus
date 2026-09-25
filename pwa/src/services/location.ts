import type { GPSPoint } from '../types'

let watchId: number | null = null
const listeners: ((point: GPSPoint) => void)[] = []

export async function requestLocationPermission(): Promise<boolean> {
  try {
    const perm = await navigator.permissions.query({ name: 'geolocation' })
    if (perm.state === 'granted') return true
    if (perm.state === 'denied') return false
    // Prompt will be shown when we call watchPosition
    return true
  } catch {
    // Fallback for browsers without permissions API
    return true
  }
}

export function startLocationUpdates(
  onUpdate: (point: GPSPoint) => void,
  options: {
    enableHighAccuracy?: boolean
    maximumAge?: number
    timeout?: number
  } = {}
): () => void {
  const { enableHighAccuracy = true, maximumAge = 1000, timeout = 10000 } = options
  
  listeners.push(onUpdate)
  
  if (watchId !== null) {
    // Already watching, just return cleanup function
    return () => stopLocationUpdates(onUpdate)
  }
  
  watchId = navigator.geolocation.watchPosition(
    (pos) => {
      const point: GPSPoint = {
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
        speed: pos.coords.speed ?? 0,
        accuracy: pos.coords.accuracy,
        timestamp: pos.timestamp,
      }
      listeners.forEach((cb) => cb(point))
    },
    (err) => {
      console.error('Geolocation error:', err.code, err.message)
    },
    {
      enableHighAccuracy,
      maximumAge,
      timeout,
    }
  )
  
  // Return cleanup function
  return () => stopLocationUpdates(onUpdate)
}

export function stopLocationUpdates(onUpdate?: (point: GPSPoint) => void) {
  if (onUpdate) {
    const idx = listeners.indexOf(onUpdate)
    if (idx > -1) listeners.splice(idx, 1)
  } else {
    listeners.length = 0
  }
  
  if (listeners.length === 0 && watchId !== null) {
    navigator.geolocation.clearWatch(watchId)
    watchId = null
  }
}

export async function getCurrentLocation(): Promise<GPSPoint | null> {
  try {
    const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      })
    })
    
    return {
      lat: pos.coords.latitude,
      lon: pos.coords.longitude,
      speed: pos.coords.speed ?? 0,
      accuracy: pos.coords.accuracy,
      timestamp: pos.timestamp,
    }
  } catch (err) {
    console.error('Get current location error:', err)
    return null
  }
}

export function getLocationPermissionState(): Promise<PermissionState> {
  return navigator.permissions.query({ name: 'geolocation' }).then(p => p.state)
}

// Helper to format coordinates for display
export function formatCoords(lat: number, lon: number): string {
  return `${lat.toFixed(6)}, ${lon.toFixed(6)}`
}

// Calculate distance between two points (Haversine formula)
export function calculateDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371000 // Earth radius in meters
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function toRad(deg: number): number {
  return deg * Math.PI / 180
}