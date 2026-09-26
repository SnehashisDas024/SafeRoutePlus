import { requireNativeModule } from 'expo-modules-core';
import { EventSubscription } from 'expo-modules-core';

export type BleEnvelopeEvent = { envelope: string };
export type BleMeshEvents = {
  onEnvelopeReceived: (event: BleEnvelopeEvent) => void;
};

export interface SafeRouteBleMeshModule {
  startRelay(serviceUuid: string): Promise<void>;
  stopRelay(): Promise<void>;
  advertise(envelope: string): Promise<void>;
  scanAndForward(): Promise<void>;
  isSupported(): Promise<boolean>;
  addListener(eventName: 'onEnvelopeReceived', listener: (event: BleEnvelopeEvent) => void): EventSubscription;
}

export default requireNativeModule<SafeRouteBleMeshModule>('SafeRouteBleMesh');