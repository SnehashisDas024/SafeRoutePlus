import * as Location from 'expo-location';

export interface GPSPoint {
  lat: number;
  lon: number;
  speed: number;
  accuracy: number;
  timestamp: number;
}

let watchId: Location.LocationSubscription | null = null;
let listeners: ((point: GPSPoint) => void)[] = [];

export async function requestLocationPermission(): Promise<boolean> {
  const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
  if (foregroundStatus !== 'granted') {
    console.warn('Foreground location permission not granted');
    return false;
  }
  
  const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
  if (backgroundStatus !== 'granted') {
    console.warn('Background location permission not granted');
  }
  return foregroundStatus === 'granted';
}

export function startLocationUpdates(
  onUpdate: (point: GPSPoint) => void,
  options: { interval?: number; accuracy?: Location.Accuracy } = {}
) {
  const { interval = 2000, accuracy = Location.Accuracy.High } = options;
  
  listeners.push(onUpdate);
  
  if (watchId) return; // Already watching
  
  Location.watchPositionAsync(
    {
      accuracy,
      timeInterval: interval,
      distanceInterval: 10, // meters
    },
    (location) => {
      if (!location) return;
      
      const point: GPSPoint = {
        lat: location.coords.latitude,
        lon: location.coords.longitude,
        speed: location.coords.speed ?? 0,
        accuracy: location.coords.accuracy ?? 0,
        timestamp: location.timestamp,
      };
      
      listeners.forEach((cb) => cb(point));
    }
  ).then(subscription => {
    watchId = subscription;
  });
}

export function stopLocationUpdates(onUpdate?: (point: GPSPoint) => void) {
  if (onUpdate) {
    listeners = listeners.filter((cb) => cb !== onUpdate);
  } else {
    listeners = [];
  }
  
  if (listeners.length === 0 && watchId) {
    watchId.remove();
    watchId = null;
  }
}

export async function getCurrentLocation(): Promise<GPSPoint | null> {
  try {
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    return {
      lat: location.coords.latitude,
      lon: location.coords.longitude,
      speed: location.coords.speed ?? 0,
      accuracy: location.coords.accuracy ?? 0,
      timestamp: location.timestamp,
    };
  } catch (err) {
    console.error('Get current location error:', err);
    return null;
  }
}