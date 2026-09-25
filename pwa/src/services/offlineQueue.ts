import { openDB, DBSchema, IDBPDatabase } from 'idb'
import { OFFLINE_QUEUE_MAX_SIZE, OFFLINE_QUEUE_RETRY_DELAYS } from './config'
import type { OfflineQueueItem, OfflineQueueType, ReportPayload } from '../types'

interface OfflineQueueDB extends DBSchema {
  queue: {
    key: string
    value: OfflineQueueItem
    indexes: { 'by-type': OfflineQueueType; 'by-timestamp': number }
  }
}

let dbPromise: Promise<IDBPDatabase<OfflineQueueDB>> | null = null

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<OfflineQueueDB>('saferoute-offline', 1, {
      upgrade(db) {
        const store = db.createObjectStore('queue', { keyPath: 'id' })
        store.createIndex('by-type', 'type')
        store.createIndex('by-timestamp', 'timestamp')
      },
    })
  }
  return dbPromise
}

export async function enqueueOffline(
  type: OfflineQueueType,
  payload: unknown
): Promise<string> {
  const db = await getDB()
  
  // Check queue size
  const count = await db.count('queue')
  if (count >= OFFLINE_QUEUE_MAX_SIZE) {
    // Remove oldest item
    const oldest = await db.getAllFromIndex('queue', 'by-timestamp', undefined, 1)
    if (oldest.length > 0) {
      await db.delete('queue', oldest[0].id)
    }
  }

  const item: OfflineQueueItem = {
    id: crypto.randomUUID(),
    type,
    payload,
    timestamp: Date.now(),
    retries: 0,
  }

  await db.add('queue', item)
  
  // Try to register background sync
  if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
    const registration = await navigator.serviceWorker.ready
    try {
      await (registration as ServiceWorkerRegistration & { sync: { register: (tag: string) => Promise<void> } }).sync.register('flush-offline-queue')
    } catch (error) {
      console.warn('Background sync registration failed:', error)
    }
  }

  return item.id
}

export async function getOfflineQueue(): Promise<OfflineQueueItem[]> {
  const db = await getDB()
  return db.getAllFromIndex('queue', 'by-timestamp')
}

export async function removeFromQueue(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('queue', id)
}

export async function incrementRetry(id: string): Promise<void> {
  const db = await getDB()
  const item = await db.get('queue', id)
  if (item) {
    item.retries += 1
    await db.put('queue', item)
  }
}

export async function clearQueue(): Promise<void> {
  const db = await getDB()
  await db.clear('queue')
}

export async function getQueueSize(): Promise<number> {
  const db = await getDB()
  return db.count('queue')
}

// Auto-flush when online
let isOnline = navigator.onLine
let flushInProgress = false

window.addEventListener('online', () => {
  isOnline = true
  flushQueue()
})

window.addEventListener('offline', () => {
  isOnline = false
})

// Listen for flush message from Service Worker
window.addEventListener('message', (event) => {
  if (event.data?.type === 'FLUSH_OFFLINE_QUEUE') {
    flushQueue()
  }
})

async function flushQueue() {
  if (flushInProgress || !isOnline) return
  
  flushInProgress = true
  
  try {
    const items = await getOfflineQueue()
    
    for (const item of items) {
      if (!isOnline) break
      
      try {
        // Process based on type
        await processQueueItem(item)
        await removeFromQueue(item.id)
      } catch (error) {
        console.error('Failed to process queue item:', item.id, error)
        
        if (item.retries < OFFLINE_QUEUE_RETRY_DELAYS.length) {
          await incrementRetry(item.id)
        } else {
          // Max retries exceeded, remove item
          await removeFromQueue(item.id)
        }
      }
    }
  } finally {
    flushInProgress = false
  }
}

async function processQueueItem(item: OfflineQueueItem): Promise<void> {
  // Dynamic import to avoid circular dependencies
  const { triggerSOS, sendReport } = await import('./api')
  
  switch (item.type) {
    case 'sos':
      await triggerSOS(item.payload as string)
      break
    case 'report': {
      const reportPayload = item.payload as { tripId: string; payload: ReportPayload }
      await sendReport(reportPayload.tripId, reportPayload.payload)
      break
    }
    case 'ping':
      // Pings are ephemeral, just drop if offline
      break
    default:
      throw new Error(`Unknown queue type: ${item.type}`)
  }
}

// Initialize flush on load if online
if (isOnline) {
  // Small delay to let app initialize
  setTimeout(flushQueue, 1000)
}