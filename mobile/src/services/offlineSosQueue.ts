import * as SecureStore from 'expo-secure-store';
import { OfflineSosEnvelope, isOfflineEnvelopeExpired } from './offlineSos';

const QUEUE_KEY = 'saferoute.ble.offline-sos-queue.v1';
const MAX_QUEUE_SIZE = 20;

async function readQueue(): Promise<OfflineSosEnvelope[]> {
  const raw = await SecureStore.getItemAsync(QUEUE_KEY);
  if (!raw) return [];
  try {
    return (JSON.parse(raw) as OfflineSosEnvelope[]).filter(item => !isOfflineEnvelopeExpired(item));
  } catch {
    return [];
  }
}

async function writeQueue(queue: OfflineSosEnvelope[]): Promise<void> {
  await SecureStore.setItemAsync(QUEUE_KEY, JSON.stringify(queue.slice(-MAX_QUEUE_SIZE)));
}

export async function enqueueOfflineSos(envelope: OfflineSosEnvelope): Promise<void> {
  const queue = await readQueue();
  if (!queue.some(item => item.message_id === envelope.message_id)) {
    queue.push(envelope);
    await writeQueue(queue);
  }
}

export async function listOfflineSos(): Promise<OfflineSosEnvelope[]> {
  const queue = await readQueue();
  await writeQueue(queue);
  return queue;
}

export async function acknowledgeOfflineSos(messageId: string): Promise<void> {
  const queue = await readQueue();
  await writeQueue(queue.filter(item => item.message_id !== messageId));
}

export async function clearExpiredOfflineSos(): Promise<void> {
  await writeQueue(await readQueue());
}
