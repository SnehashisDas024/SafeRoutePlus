import { useState, useEffect } from 'react'

function InstallPrompt() {
  const [show, setShow] = useState(false)
  let deferredPrompt: BeforeInstallPromptEvent | null = null

  useEffect(() => {
    const handler = (e: BeforeInstallPromptEvent) => {
      e.preventDefault()
      deferredPrompt = e
      setShow(true)
    }

    window.addEventListener('beforeinstallprompt', handler as EventListener)
    return () => window.removeEventListener('beforeinstallprompt', handler as EventListener)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    console.log('Install outcome:', outcome)
    deferredPrompt = null
    setShow(false)
  }

  const handleDismiss = () => {
    setShow(false)
    // Don't show again for this session
    sessionStorage.setItem('installPromptDismissed', 'true')
  }

  if (!show || sessionStorage.getItem('installPromptDismissed')) return null

  return (
    <div style={styles.banner} role="banner">
      <div style={styles.content}>
        <div style={styles.icon}>📱</div>
        <div style={styles.text}>
          <strong>Install SafeRoute+</strong>
          <span>Add to home screen for quick access and offline support</span>
        </div>
      </div>
      <div style={styles.actions}>
        <button style={styles.btnSecondary} onClick={handleDismiss}>
          Not now
        </button>
        <button style={styles.btnPrimary} onClick={handleInstall}>
          Install
        </button>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  banner: {
    position: 'fixed' as const,
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 500,
    background: '#ffffff',
    borderTop: '1px solid #eeeeee',
    boxShadow: '0 -4px 20px rgba(0,0,0,0.1)',
    padding: '12px 16px',
    animation: 'slideUp 0.3s ease-out',
  },
  content: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '8px',
  },
  icon: {
    fontSize: '24px',
  },
  text: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '2px',
    flex: 1,
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px',
  },
  btnPrimary: {
    padding: '8px 16px',
    background: '#1976d2',
    color: '#ffffff',
    borderRadius: '8px',
    fontWeight: '600',
    fontSize: '14px',
  },
  btnSecondary: {
    padding: '8px 16px',
    background: '#f5f5f5',
    color: '#666666',
    borderRadius: '8px',
    fontWeight: '500',
    fontSize: '14px',
  },
}

export default InstallPrompt