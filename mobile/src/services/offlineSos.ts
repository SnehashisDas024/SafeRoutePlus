import * as SecureStore from 'expo-secure-store';
import nacl from 'tweetnacl';
import { decodeBase64, decodeUTF8, encodeBase64 } from 'tweetnacl-util';

export type OfflineSosEventType = 'manual_sos' | 'voice_duress' | 'automatic';

export interface OfflineSosEnvelope {
  protocol_version: 1;
  message_id: string;
  origin_device_id: string;
  trip_id: string;
  created_at: string;
  expires_at: string;
  hop_limit: number;
  hop_count: number;
  event_type: OfflineSosEventType;
  approximate_location?: { lat: number; lon: number; accuracy_m?: number };
  payload_ciphertext: string;
  public_key: string;
  signature: string;
}

const KEYPAIR_KEY = 'saferoute.ble.signing-keypair.v1';
const DEVICE_ID_KEY = 'saferoute.ble.device-id.v1';
const PAYLOAD_KEY = 'saferoute.ble.payload-key.v1';

function randomId(bytes = 16): string {
  return encodeBase64(nacl.randomBytes(bytes)).replace(/[^a-zA-Z0-9]/g, '').slice(0, bytes * 2);
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>).sort().reduce<Record<string, unknown>>((result, key) => {
      result[key] = sortValue((value as Record<string, unknown>)[key]);
      return result;
    }, {});
  }
  return value;
}

function canonicalEnvelope(envelope: Omit<OfflineSosEnvelope, 'signature'>): Uint8Array {
  return decodeUTF8(JSON.stringify(sortValue(envelope)));
}

async function getSigningKeyPair(): Promise<nacl.SignKeyPair> {
  const stored = await SecureStore.getItemAsync(KEYPAIR_KEY);
  if (stored) {
    const parsed = JSON.parse(stored) as { publicKey: string; secretKey: string };
    return {
      publicKey: decodeBase64(parsed.publicKey),
      secretKey: decodeBase64(parsed.secretKey),
    };
  }

  const keyPair = nacl.sign.keyPair();
  await SecureStore.setItemAsync(KEYPAIR_KEY, JSON.stringify({
    publicKey: encodeBase64(keyPair.publicKey),
    secretKey: encodeBase64(keyPair.secretKey),
  }));
  return keyPair;
}

async function getDeviceId(): Promise<string> {
  const stored = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (stored) return stored;
  const deviceId = randomId(16);
  await SecureStore.setItemAsync(DEVICE_ID_KEY, deviceId);
  return deviceId;
}

async function getPayloadKey(): Promise<Uint8Array> {
  const stored = await SecureStore.getItemAsync(PAYLOAD_KEY);
  if (stored) return decodeBase64(stored);
  const key = nacl.randomBytes(nacl.secretbox.keyLength);
  await SecureStore.setItemAsync(PAYLOAD_KEY, encodeBase64(key));
  return key;
}

async function encryptPayload(payload: Record<string, unknown>): Promise<string> {
  const key = await getPayloadKey();
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const ciphertext = nacl.secretbox(decodeUTF8(JSON.stringify(payload)), nonce, key);
  return encodeBase64(new Uint8Array([...nonce, ...ciphertext]));
}

export async function createOfflineSosEnvelope(
  tripId: string,
  eventType: OfflineSosEventType = 'manual_sos',
  location?: { lat: number; lon: number; accuracy_m?: number },
): Promise<OfflineSosEnvelope> {
  const now = new Date();
  const unsigned: Omit<OfflineSosEnvelope, 'signature'> = {
    protocol_version: 1,
    message_id: randomId(16),
    origin_device_id: await getDeviceId(),
    trip_id: tripId,
    created_at: now.toISOString(),
    expires_at: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
    hop_limit: 8,
    hop_count: 0,
    event_type: eventType,
    approximate_location: location,
    payload_ciphertext: await encryptPayload({ trip_id: tripId, event_type: eventType }),
    public_key: '',
  };

  const keyPair = await getSigningKeyPair();
  unsigned.public_key = encodeBase64(keyPair.publicKey);
  return {
    ...unsigned,
    signature: encodeBase64(nacl.sign.detached(canonicalEnvelope(unsigned), keyPair.secretKey)),
  };
}

export function isOfflineEnvelopeExpired(envelope: OfflineSosEnvelope): boolean {
  return Date.now() >= new Date(envelope.expires_at).getTime();
}

export function verifyOfflineSosEnvelope(envelope: OfflineSosEnvelope): boolean {
  const createdAt = Date.parse(envelope.created_at);
  const expiresAt = Date.parse(envelope.expires_at);
  if (envelope.protocol_version !== 1 || !Number.isFinite(createdAt) || !Number.isFinite(expiresAt)) return false;
  if (createdAt > Date.now() + 60_000 || expiresAt <= Date.now() || expiresAt <= createdAt) return false;
  if (expiresAt - createdAt > 15 * 60 * 1000 + 60_000) return false;
  if (envelope.hop_limit <= 0 || envelope.hop_limit > 8 || envelope.hop_count < 0) return false;
  if (envelope.hop_count > envelope.hop_limit) return false;
  if (decodeBase64(envelope.public_key).length !== nacl.sign.publicKeyLength) return false;
  if (decodeBase64(envelope.signature).length !== nacl.sign.signatureLength) return false;

  const { signature, ...unsigned } = envelope;
  return nacl.sign.detached.verify(
    canonicalEnvelope(unsigned),
    decodeBase64(signature),
    decodeBase64(envelope.public_key),
  );
}
