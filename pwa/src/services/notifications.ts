export interface NotificationPayload {
  title: string
  body: string
  icon?: string
  badge?: string
  data?: Record<string, unknown>
  actions?: Array<{ action: string; title: string }>
  tag?: string
  requireInteraction?: boolean
}

let swRegistration: ServiceWorkerRegistration | null = null

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.warn('Notifications not supported')
    return false
  }
  
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  
  const permission = await Notification.requestPermission()
  return permission === 'granted'
}

export function getNotificationPermission(): NotificationPermission {
  return Notification.permission
}

export async function showNotification(payload: NotificationPayload): Promise<Notification | null> {
  if (Notification.permission !== 'granted') {
    console.warn('Notification permission not granted')
    return null
  }
  
  if (!swRegistration) {
    swRegistration = await navigator.serviceWorker.ready
  }
  
  try {
    // Use Service Worker to show notification (works even if app is closed)
    await swRegistration.showNotification(payload.title, {
      body: payload.body,
      icon: payload.icon || '/icons/icon-192x192.png',
      badge: payload.badge || '/icons/icon-72x72.png',
      data: payload.data,
      // actions: payload.actions, // Not supported in all browsers
      tag: payload.tag,
      requireInteraction: payload.requireInteraction,
    })
    return null // SW notification doesn't return Notification object
  } catch (error) {
    console.error('Failed to show notification via SW:', error)
    
    // Fallback to regular Notification API
    try {
      const notification = new Notification(payload.title, {
        body: payload.body,
        icon: payload.icon,
        badge: payload.badge,
        data: payload.data,
        requireInteraction: payload.requireInteraction,
      })
      return notification
    } catch (fallbackError) {
      console.error('Fallback notification failed:', fallbackError)
      return null
    }
  }
}

// Mock mode - for demo without real push credentials
export function mockShowNotification(payload: NotificationPayload): void {
  console.log('📱 MOCK PUSH NOTIFICATION:', {
    title: payload.title,
    body: payload.body,
    data: payload.data,
    timestamp: new Date().toISOString(),
  })
  
  // Also show in-app banner
  showInAppBanner(payload)
}

function showInAppBanner(payload: NotificationPayload): void {
  // Create and show a temporary banner
  const banner = document.createElement('div')
  banner.style.cssText = `
    position: fixed;
    top: 70px;
    left: 16px;
    right: 16px;
    z-index: 1000;
    background: #fff3e0;
    border: 1px solid #ffb74d;
    border-radius: 8px;
    padding: 12px 16px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    animation: slideDown 0.3s ease-out;
  `
  banner.innerHTML = `
    <strong style="color: #e65100;">${payload.title}</strong>
    <p style="color: #5d4037; margin: 4px 0 0;">${payload.body}</p>
    <small style="color: #8d6e63;">Mock notification - push not configured</small>
  `
  
  // Add animation
  const style = document.createElement('style')
  style.textContent = `
    @keyframes slideDown {
      from { opacity: 0; transform: translateY(-20px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes fadeOut {
      from { opacity: 1; }
      to { opacity: 0; }
    }
  `
  document.head.appendChild(style)
  
  document.body.appendChild(banner)
  
  setTimeout(() => {
    banner.style.animation = 'fadeOut 0.3s ease-in'
    setTimeout(() => banner.remove(), 300)
  }, 5000)
}

// Push subscription
export async function subscribeToPush(): Promise<PushSubscription | null> {
  if (!('PushManager' in window)) return null
  
  try {
    const registration = await navigator.serviceWorker.ready
    const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY || ''
    if (!vapidKey) {
      console.warn('VAPID public key not configured')
      return null
    }
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey) as unknown as BufferSource,
    })
    return subscription
  } catch (error) {
    console.error('Push subscription failed:', error)
    return null
  }
}

export async function unsubscribeFromPush(): Promise<boolean> {
  try {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()
    if (subscription) {
      await subscription.unsubscribe()
      return true
    }
    return false
  } catch (error) {
    console.error('Push unsubscribe failed:', error)
    return false
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

// Mock push for demo
export function mockPush(payload: { title: string; body: string; data?: Record<string, unknown> }) {
  mockShowNotification({
    title: payload.title,
    body: payload.body,
    data: payload.data,
    requireInteraction: true,
    tag: 'mock-push',
  })
}

export function isPushSupported(): boolean {
  return 'PushManager' in window && 'serviceWorker' in navigator
}