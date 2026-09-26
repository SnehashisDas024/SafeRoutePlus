import { PermissionsAndroid, Platform } from 'react-native';
import { EventSubscription, requireOptionalNativeModule } from 'expo-modules-core';
import { OfflineSosEnvelope } from './offlineSos';

export const BLE_MESH_SERVICE_UUID = '6f7a7c42-1e24-4cf8-9c6e-5f6e7f6f534f';

interface NativeBleMeshModule {
  startRelay(serviceUuid: string): Promise<void>;
  stopRelay(): Promise<void>;
  advertise(envelope: string): Promise<void>;
  scanAndForward(): Promise<void>;
  isSupported(): Promise<boolean>;
  addListener(
    eventName: 'onEnvelopeReceived',
    listener: (event: { envelope: string }) => void,
  ): EventSubscription;
}

const nativeBleMesh = requireOptionalNativeModule<NativeBleMeshModule>('SafeRouteBleMesh');
let receiveSubscription: EventSubscription | undefined;
let receiveHandler: ((envelope: string) => void | Promise<void>) | undefined;

async function requestAndroidBlePermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;

  const permissions = Number(Platform.Version) >= 31
    ? [
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
    ]
    : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
  const results = await PermissionsAndroid.requestMultiple(permissions);
  return permissions.every(permission => results[permission] === PermissionsAndroid.RESULTS.GRANTED);
}

export async function checkBlePermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const permissions = Number(Platform.Version) >= 31
    ? [
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
    ]
    : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
  for (const p of permissions) {
    if (await PermissionsAndroid.check(p) === false) return false;
  }
  return true;
}

export function isBleMeshNativeModuleAvailable(): boolean {
  return Boolean(nativeBleMesh);
}

export async function startBleRelay(
  onEnvelopeReceived?: (envelope: string) => void | Promise<void>,
): Promise<boolean> {
  if (!nativeBleMesh) return false;
  if (!(await requestAndroidBlePermissions())) return false;
  if (!(await nativeBleMesh.isSupported())) return false;
  if (onEnvelopeReceived) {
    receiveHandler = onEnvelopeReceived;
    receiveSubscription ??= nativeBleMesh.addListener('onEnvelopeReceived', event => {
      void receiveHandler?.(event.envelope);
    });
  }
  await nativeBleMesh.startRelay(BLE_MESH_SERVICE_UUID);
  await nativeBleMesh.scanAndForward();
  return true;
}

export async function advertiseOfflineSos(
  envelope: OfflineSosEnvelope,
  relayHopCount = 0,
): Promise<boolean> {
  if (!nativeBleMesh) return false;
  await nativeBleMesh.advertise(JSON.stringify({ envelope, relay_hop_count: relayHopCount }));
  return true;
}

export async function stopBleRelay(): Promise<void> {
  receiveSubscription?.remove();
  receiveSubscription = undefined;
  receiveHandler = undefined;
  if (nativeBleMesh) await nativeBleMesh.stopRelay();
}

export function bleMeshPlatformNote(): string {
  if (!nativeBleMesh) {
    return Platform.OS === 'web'
      ? 'BLE relay is unavailable on web.'
      : 'Install the SafeRoute native BLE development build to enable relay.';
  }
  return 'BLE relay is best effort and depends on Bluetooth and background permissions.';
}
