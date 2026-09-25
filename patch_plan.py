import os

path = r'C:\Users\sneha\Desktop\SafeRoutePlus\frontend\src\screens\PlanScreen.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add recentOrigins and recentDestinations
# First, find the line where recentRoutes is defined
hook_insertion = """  const [recentRoutes, setRecentRoutes] = useState<RouteHistoryItem[]>([])
  const [frequentRoutes, setFrequentRoutes] = useState<RouteHistoryItem[]>([])"""

new_hook = """  const [recentRoutes, setRecentRoutes] = useState<RouteHistoryItem[]>([])
  const [frequentRoutes, setFrequentRoutes] = useState<RouteHistoryItem[]>([])

  const recentOrigins = useMemo(() => {
    const unique = new Map<string, [number, number]>()
    recentRoutes.forEach(r => {
      if (r.origin.name && !unique.has(r.origin.name)) {
        unique.set(r.origin.name, r.origin.coordinates)
      }
    })
    return Array.from(unique.entries()).map(([name, coords]) => ({ name, coords })).slice(0, 5)
  }, [recentRoutes])

  const recentDestinations = useMemo(() => {
    const unique = new Map<string, [number, number]>()
    recentRoutes.forEach(r => {
      if (r.destination.name && !unique.has(r.destination.name)) {
        unique.set(r.destination.name, r.destination.coordinates)
      }
    })
    return Array.from(unique.entries()).map(([name, coords]) => ({ name, coords })).slice(0, 5)
  }, [recentRoutes])"""
  
# Also need useMemo import
content = content.replace("import { useEffect, useState } from 'react'", "import { useEffect, useState, useMemo } from 'react'")
content = content.replace(hook_insertion, new_hook)

# 2. Add them to PlaceAutocomplete
old_origin_auto = """                <PlaceAutocomplete
                  value={originName}
                  onChange={(name, coords) => {
                    setOriginName(name)
                    setOrigin(coords)
                  }}
                  placeholder="Starting point..."
                  isActive={activeTarget === 'origin'}
                  onFocus={() => setActiveTarget('origin')}
                />"""

new_origin_auto = """                <PlaceAutocomplete
                  value={originName}
                  onChange={(name, coords) => {
                    setOriginName(name)
                    setOrigin(coords)
                  }}
                  placeholder="Starting point..."
                  isActive={activeTarget === 'origin'}
                  onFocus={() => setActiveTarget('origin')}
                  recentPlaces={recentOrigins}
                />"""
content = content.replace(old_origin_auto, new_origin_auto)

old_dest_auto = """                <PlaceAutocomplete
                  value={destName}
                  onChange={(name, coords) => {
                    setDestName(name)
                    setDestination(coords)
                  }}
                  placeholder="Where to?"
                  isActive={activeTarget === 'destination'}
                  onFocus={() => setActiveTarget('destination')}
                  accentColor="#E74C3C"
                />"""

new_dest_auto = """                <PlaceAutocomplete
                  value={destName}
                  onChange={(name, coords) => {
                    setDestName(name)
                    setDestination(coords)
                  }}
                  placeholder="Where to?"
                  isActive={activeTarget === 'destination'}
                  onFocus={() => setActiveTarget('destination')}
                  accentColor="#E74C3C"
                  recentPlaces={recentDestinations}
                />"""
content = content.replace(old_dest_auto, new_dest_auto)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Patched PlanScreen.tsx with recent destinations in autocomplete")
