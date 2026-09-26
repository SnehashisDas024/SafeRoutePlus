import { ingestOfflineSOS, triggerSOS } from './api';
import { advertiseOfflineSos, startBleRelay, stopBleRelay } from './bleMesh';
import {
  acknowledgeOfflineSos,
  enqueueOfflineSos,
  listOfflineSos,
} from './offlineSosQueue';
import {
  createOfflineSosEnvelope,
  isOfflineEnvelopeExpired,
  OfflineSosEnvelope,
  OfflineSosEventType,
  verifyOfflineSosEnvelope,
} from './offlineSos';

const seenRelayMessageIds = new Set<string>();
const relayQueue = new Map<string, { envelope: OfflineSosEnvelope; relayHopCount: number }>();
let relayQueueTimer: ReturnType<typeof setInterval> | undefined;
let relayQueueIndex = 0;
let relayAdvertisementInProgress = false;

async function advertiseNextQueuedEnvelope(): Promise<void> {
  if (relayAdvertisementInProgress || relayQueue.size === 0) return;
  relayAdvertisementInProgress = true;
  try {
    const entries = [...relayQueue.entries()];
    for (let attempt = 0; attempt < entries.length; attempt += 1) {
      const entryIndex = relayQueueIndex % entries.length;
      relayQueueIndex = (relayQueueIndex + 1) % entries.length;
      const [messageId, queued] = entries[entryIndex];
      if (isOfflineEnvelopeExpired(queued.envelope)) {
        relayQueue.delete(messageId);
        continue;
      }
      await advertiseOfflineSos(queued.envelope, queued.relayHopCount);
      return;
    }
  } finally {
    relayAdvertisementInProgress = false;
  }
}

function queueEnvelopeForRelay(envelope: OfflineSosEnvelope, relayHopCount = 0): void {
  if (relayQueue.size >= 20 && !relayQueue.has(envelope.message_id)) {
    const oldestMessageId = relayQueue.keys().next().value;
    if (oldestMessageId) relayQueue.delete(oldestMessageId);
  }
  relayQueue.set(envelope.message_id, { envelope, relayHopCount });
  void advertiseNextQueuedEnvelope();
}

function removeEnvelopeFromRelay(messageId: string): void {
  relayQueue.delete(messageId);
  if (relayQueueIndex >= relayQueue.size) relayQueueIndex = 0;
}

async function receiveRelayedEnvelope(serialized: string): Promise<void> {
  let relayHopCount = 0;
  let envelope: OfflineSosEnvelope;
  try {
    const packet = JSON.parse(serialized) as {
      envelope?: OfflineSosEnvelope;
      relay_hop_count?: number;
    } & Partial<OfflineSosEnvelope>;
    if (packet.envelope) {
      envelope = packet.envelope;
      relayHopCount = packet.relay_hop_count ?? 0;
    } else {
      envelope = packet as OfflineSosEnvelope;
      relayHopCount = envelope.hop_count;
    }
  } catch {
    return;
  }

  if (!Number.isInteger(relayHopCount) || relayHopCount < 0 || relayHopCount > 8) return;
  try {
    if (!verifyOfflineSosEnvelope(envelope) || seenRelayMessageIds.has(envelope.message_id)) return;
  } catch {
    return;
  }
  if (relayHopCount > envelope.hop_limit) return;
  seenRelayMessageIds.add(envelope.message_id);
  if (seenRelayMessageIds.size > 100) {
    const oldestMessageId = seenRelayMessageIds.values().next().value;
    if (oldestMessageId) seenRelayMessageIds.delete(oldestMessageId);
  }

  await enqueueOfflineSos(envelope);
  try {
    const response = await ingestOfflineSOS(envelope);
    if (response.status === 'accepted' || response.status === 'duplicate') {
      await acknowledgeOfflineSos(envelope.message_id);
      removeEnvelopeFromRelay(envelope.message_id);
      return;
    }
  } catch {
    // Forward only after persisting; a neighboring gateway may have connectivity.
  }

  if (isOfflineEnvelopeExpired(envelope)) return;
  await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1500));
  if (relayHopCount < envelope.hop_limit) {
    queueEnvelopeForRelay(envelope, relayHopCount + 1);
  }
}

export type SosDeliveryStatus = 'online' | 'gateway' | 'ble_queued';

export async function deliverSos(
  tripId: string,
  eventType: OfflineSosEventType = 'manual_sos',
  location?: { lat: number; lon: number; accuracy_m?: number },
): Promise<SosDeliveryStatus> {
  const envelope = await createOfflineSosEnvelope(tripId, eventType, location);
  seenRelayMessageIds.add(envelope.message_id);
  await enqueueOfflineSos(envelope);

  try {
    await triggerSOS(tripId);
    await acknowledgeOfflineSos(envelope.message_id);
    removeEnvelopeFromRelay(envelope.message_id);
    return 'online';
  } catch {
    try {
      const response = await ingestOfflineSOS(envelope);
      if (response.status === 'accepted' || response.status === 'duplicate') {
        await acknowledgeOfflineSos(envelope.message_id);
        removeEnvelopeFromRelay(envelope.message_id);
        return 'gateway';
      }
    } catch {
      // The envelope remains queued for BLE forwarding and a later gateway retry.
    }

    await startOfflineSosRelay();
    return 'ble_queued';
  }
}

export let isRelayActive = false;

export function getRelayQueueSize(): number {
  return relayQueue.size;
}

export async function startOfflineSosRelay(): Promise<boolean> {
  isRelayActive = true;
  const started = await startBleRelay(receiveRelayedEnvelope);
  if (!started) return false;

  for (const envelope of await listOfflineSos()) {
    queueEnvelopeForRelay(envelope);
  }
  relayQueueTimer ??= setInterval(() => void advertiseNextQueuedEnvelope(), 2500);
  await advertiseNextQueuedEnvelope();
  return true;
}

export async function stopOfflineSosRelay(): Promise<void> {
  isRelayActive = false;
  if (relayQueueTimer) clearInterval(relayQueueTimer);
  relayQueueTimer = undefined;
  await stopBleRelay();
}

export async function flushOfflineSosQueue(): Promise<number> {
  let delivered = 0;
  for (const envelope of await listOfflineSos()) {
    try {
      const response = await ingestOfflineSOS(envelope);
      if (response.status === 'accepted' || response.status === 'duplicate') {
        await acknowledgeOfflineSos(envelope.message_id);
        removeEnvelopeFromRelay(envelope.message_id);
        delivered += 1;
      }
    } catch {
      // Keep the envelope until its expiry or a later retry.
    }
  }
  return delivered;
}
