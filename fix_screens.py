import os

base_dir = r'C:\Users\sneha\Desktop\SafeRoutePlus'

# useTrip.ts
use_trip_path = os.path.join(base_dir, 'frontend', 'src', 'hooks', 'useTrip.ts')
with open(use_trip_path, 'r', encoding='utf-8') as f:
    ut = f.read()
target_ut = '''  const voiceEvent = useCallback(async (kind: 'duress_word' | 'safe_word' | 'checkin_spoken', confidence: number) => {
    if (!tripId) return
    try { await sendVoiceEvent(tripId, { kind, phrase_hash: '', confidence }) } catch { /* ignore */ }
    fetchEscalation()
  }, [tripId, fetchEscalation])'''
replace_ut = '''  const voiceEvent = useCallback(async (kind: 'duress_word' | 'safe_word' | 'checkin_spoken' | 'loud_noise' | 'distress_keyword', confidence: number) => {
    if (!tripId) return
    if (kind === 'loud_noise' || kind === 'distress_keyword') {
      try { await triggerSOS(tripId) } catch { /* ignore */ }
    } else {
      try { await sendVoiceEvent(tripId, { kind, phrase_hash: '', confidence }) } catch { /* ignore */ }
    }
    fetchEscalation()
  }, [tripId, fetchEscalation])'''
if target_ut in ut:
    with open(use_trip_path, 'w', encoding='utf-8') as f:
        f.write(ut.replace(target_ut, replace_ut))

# RouteCompareScreen.tsx
rc_path = os.path.join(base_dir, 'frontend', 'src', 'screens', 'RouteCompareScreen.tsx')
with open(rc_path, 'r', encoding='utf-8') as f:
    rc = f.read()
target_rc = '''      localStorage.setItem('activeTripId', res.trip_id)
      navigate('/trip')'''
replace_rc = '''      localStorage.setItem('activeTripId', res.trip_id)
      localStorage.setItem('activeDestination', JSON.stringify(state!.destination))
      navigate('/trip')'''
if target_rc in rc:
    with open(rc_path, 'w', encoding='utf-8') as f:
        f.write(rc.replace(target_rc, replace_rc))

# PlanScreen.tsx
plan_path = os.path.join(base_dir, 'frontend', 'src', 'screens', 'PlanScreen.tsx')
with open(plan_path, 'r', encoding='utf-8') as f:
    plan = f.read()
target_plan = '''  // Ensure Leaflet tiles render at full dimensions on load/resize
  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize()
    }, 150)
    return () => clearTimeout(timer)
  }, [map])'''
replace_plan = '''  // Ensure Leaflet tiles render at full dimensions on load/resize
  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize()
    }, 150)
    const container = map.getContainer()
    const resizeObserver = new window.ResizeObserver(() => {
      map.invalidateSize()
    })
    resizeObserver.observe(container)
    return () => {
      clearTimeout(timer)
      resizeObserver.disconnect()
    }
  }, [map])'''
if target_plan in plan:
    with open(plan_path, 'w', encoding='utf-8') as f:
        f.write(plan.replace(target_plan, replace_plan))

print('Screens and hooks fixed')
