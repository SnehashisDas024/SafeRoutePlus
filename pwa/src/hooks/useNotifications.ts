import { useState, useEffect, useCallback } from 'react'
import {
  requestNotificationPermission,
  getNotificationPermission,
  showNotification,
  mockShowNotification,
  subscribeToPush,
  unsubscribeFromPush,
  isPushSupported,
} from '../services/notifications'

export function useNotifications(mockMode = true) {
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [pushSupported, setPushSupported] = useState(false)
  const [pushSubscribed, setPushSubscribed] = useState(false)

  useEffect(() => {
    setPermission(getNotificationPermission())
    setPushSupported(isPushSupported())
    
    if (isPushSupported()) {
      checkPushSubscription()
    }
  }, [])

  const checkPushSubscription = async () => {
    if (!isPushSupported()) return
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      setPushSubscribed(!!subscription)
    } catch {
      setPushSubscribed(false)
    }
  }

  const requestPermission = useCallback(async () => {
    const granted = await requestNotificationPermission()
    setPermission(getNotificationPermission())
    return granted
  }, [])

  const notify = useCallback(async (payload: {
    title: string
    body: string
    data?: Record<string, unknown>
    actions?: Array<{ action: string; title: string }>
    requireInteraction?: boolean
  }) => {
    if (mockMode) {
      const { mockShowNotification } = await import('../services/notifications')
      mockShowNotification({
        title: payload.title,
        body: payload.body,
        data: payload.data,
        actions: payload.actions,
        requireInteraction: payload.requireInteraction,
      })
    } else {
      await showNotification({
        title: payload.title,
        body: payload.body,
        data: payload.data,
        actions: payload.actions,
        requireInteraction: payload.requireInteraction,
      })
    }
  }, [mockMode])

  const subscribePush = useCallback(async () => {
    if (!isPushSupported()) return false
    const subscription = await subscribeToPush()
    if (subscription) {
      setPushSubscribed(true)
      // Send subscription to backend
      return true
    }
    return false
  }, [])

  const unsubscribePush = useCallback(async () => {
    const success = await unsubscribeFromPush()
    if (success) setPushSubscribed(false)
    return success
  }, [])

  return {
    permission,
    pushSupported,
    pushSubscribed,
    requestPermission,
    notify,
    subscribePush,
    unsubscribePush,
  }
}