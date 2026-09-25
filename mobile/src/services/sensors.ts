import { Accelerometer } from 'expo-sensors';

export type ShakeCallback = () => void;

let shakeCallback: ShakeCallback | null = null;
let lastShakeTime = 0;
const SHAKE_THRESHOLD = 2.5; // m/s^2
const SHAKE_COOLDOWN = 2000; // ms

function handleAccelerometer(data: { x: number; y: number; z: number }) {
  const { x, y, z } = data;
  const acceleration = Math.sqrt(x * x + y * y + z * z);
  const now = Date.now();
  
  if (acceleration > SHAKE_THRESHOLD && now - lastShakeTime > SHAKE_COOLDOWN) {
    lastShakeTime = now;
    shakeCallback?.();
  }
}

export function startShakeDetection(callback: ShakeCallback) {
  shakeCallback = callback;
  Accelerometer.setUpdateInterval(100); // 100ms = 10Hz
  Accelerometer.addListener(handleAccelerometer);
}

export function stopShakeDetection() {
  shakeCallback = null;
  Accelerometer.removeAllListeners();
}