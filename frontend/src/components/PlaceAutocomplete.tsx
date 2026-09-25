import { useState, useRef, useEffect, useCallback } from 'react'

/** A single autocomplete suggestion from the Photon geocoding API */
interface PhotonFeature {
  type: string
  geometry: {
    coordinates: [number, number] // [lon, lat]
    type: string
  }
  properties: {
    osm_id: number
    osm_type: string
    name?: string
    street?: string
    housenumber?: string
    city?: string
    district?: string
    state?: string
    country?: string
    postcode?: string
    type?: string
    osm_key?: string
    osm_value?: string
  }
}

interface PhotonResponse {
  type: string
  features: PhotonFeature[]
}

export interface RecentPlace {
  name: string
  coords: [number, number]
}

interface PlaceAutocompleteProps {
  value: string
  onChange: (name: string, coords: [number, number] | null) => void
  placeholder?: string
  isActive?: boolean
  accentColor?: string
  onFocus?: () => void
  recentPlaces?: RecentPlace[]
}

// Bias search results towards Kolkata
const KOLKATA_LAT = 22.57
const KOLKATA_LON = 88.36

export default function PlaceAutocomplete({
  value,
  onChange,
  placeholder = 'Type a place name...',
  isActive = false,
  accentColor = '#27AE60',
  onFocus,
  recentPlaces = [],
}: PlaceAutocompleteProps) {

  const mockFeature = (name: string, coords: [number, number]): PhotonFeature => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: coords },
    properties: {
      osm_id: Math.random(),
      osm_type: 'recent',
      name: name,
      type: 'recent_history'
    }
  })

  const [query, setQuery] = useState(value)
  const [suggestions, setSuggestions] = useState<PhotonFeature[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [loading, setLoading] = useState(false)
  const [highlightIdx, setHighlightIdx] = useState(-1)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Sync external value changes (e.g. from map clicks or presets)
  useEffect(() => {
    setQuery(value)
  }, [value])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      if (recentPlaces && recentPlaces.length > 0) {
        setSuggestions(recentPlaces.map(rp => mockFeature(rp.name, rp.coords)))
        setShowDropdown(true)
      } else {
        setSuggestions([])
        setShowDropdown(false)
      }
      return
    }
    setLoading(true)
    try {
      // Photon API — purpose-built for autocomplete, returns structured place data
      const params = new URLSearchParams({
        q,
        lat: KOLKATA_LAT.toString(),
        lon: KOLKATA_LON.toString(),
        limit: '7',
        lang: 'en',
      })
      const res = await fetch(`https://photon.komoot.io/api/?${params}`)
      if (res.ok) {
        const data: PhotonResponse = await res.json()
        setSuggestions(data.features)
        setShowDropdown(data.features.length > 0)
        setHighlightIdx(-1)
      }
    } catch {
      // silently fail — user can still pick from map
    } finally {
      setLoading(false)
    }
  }, [])

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setQuery(val)
    onChange(val, null) // clear coords while typing

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 300)
  }

  const handleSelect = (feature: PhotonFeature) => {
    const name = formatPlaceName(feature)
    const coords: [number, number] = [
      feature.geometry.coordinates[0], // lon
      feature.geometry.coordinates[1], // lat
    ]
    setQuery(name)
    setSuggestions([])
    setShowDropdown(false)
    onChange(name, coords)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || suggestions.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightIdx((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightIdx((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (highlightIdx >= 0 && highlightIdx < suggestions.length) {
        handleSelect(suggestions[highlightIdx])
      }
    } else if (e.key === 'Escape') {
      setShowDropdown(false)
    }
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            onFocus?.()
            if (query.trim().length < 2 && recentPlaces && recentPlaces.length > 0) {
              setSuggestions(recentPlaces.map(rp => mockFeature(rp.name, rp.coords)))
              setShowDropdown(true)
            } else if (suggestions.length > 0) {
              setShowDropdown(true)
            }
          }}
          placeholder={placeholder}
          autoComplete="off"
          style={{
            width: '100%',
            padding: '10px 14px',
            paddingRight: loading ? 36 : 14,
            border: `2px solid ${isActive ? accentColor : 'transparent'}`,
            borderRadius: 12,
            fontSize: 13.5,
            fontWeight: 600,
            fontFamily: 'inherit',
            color: '#1E4E6E',
            background: isActive ? `${accentColor}12` : '#F5F0E8',
            outline: 'none',
            transition: 'all 0.2s ease',
            boxShadow: isActive
              ? `0 0 0 3px ${accentColor}25`
              : 'inset 2px 2px 4px rgba(0,0,0,0.06), inset -2px -2px 4px rgba(255,255,255,0.7)',
          }}
        />
        {loading && (
          <div
            style={{
              position: 'absolute',
              right: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              width: 16,
              height: 16,
              border: `2px solid ${accentColor}40`,
              borderTopColor: accentColor,
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }}
          />
        )}
      </div>

      {/* Suggestions Dropdown */}
      {showDropdown && suggestions.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 9999,
            background: '#FFFDF7',
            borderRadius: 14,
            boxShadow: '0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.08)',
            border: '1px solid rgba(30, 78, 110, 0.1)',
            overflow: 'hidden',
            maxHeight: 300,
            overflowY: 'auto',
          }}
        >
          {suggestions.map((feature, idx) => {
            const isHighlighted = idx === highlightIdx
            const isRecent = feature.properties.type === 'recent_history'
            const mainName = formatPlaceName(feature)
            const subText = isRecent ? 'Recent Search' : formatSubText(feature)
            return (
              <button
                key={`${feature.properties.osm_id}-${idx}`}
                type="button"
                onClick={() => handleSelect(feature)}
                onMouseEnter={() => setHighlightIdx(idx)}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  width: '100%',
                  padding: '10px 14px',
                  border: 'none',
                  borderBottom: idx < suggestions.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none',
                  background: isHighlighted ? `${accentColor}15` : 'transparent',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.15s ease',
                  fontFamily: 'inherit',
                }}
              >
                {/* Location Pin Icon */}
                <span
                  style={{
                    flexShrink: 0,
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    background: isHighlighted ? accentColor : '#E8E2D6',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: 1,
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={isHighlighted ? '#fff' : '#1E4E6E'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                </span>

                {/* Name + subtitle */}
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div
                    style={{
                      fontSize: 13.5,
                      fontWeight: 700,
                      color: '#1E4E6E',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {mainName}
                  </div>
                  {subText && (
                    <div
                      style={{
                        fontSize: 11.5,
                        color: '#8899A6',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        marginTop: 2,
                      }}
                    >
                      {subText}
                    </div>
                  )}
                </div>

                {/* Place type badge */}
                <span
                  style={{
                    flexShrink: 0,
                    fontSize: 10,
                    fontWeight: 600,
                    color: '#8899A6',
                    background: '#F0ECE4',
                    padding: '2px 8px',
                    borderRadius: 6,
                    textTransform: 'capitalize',
                    marginTop: 4,
                  }}
                >
                  {feature.properties.type || feature.properties.osm_value || 'place'}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/**
 * Format the primary display name from structured Photon properties.
 * Prioritizes the actual place name over street addresses.
 */
function formatPlaceName(feature: PhotonFeature): string {
  const p = feature.properties
  // Use the named place first
  if (p.name) return p.name
  // Fall back to street + house number
  if (p.street) {
    return p.housenumber ? `${p.housenumber} ${p.street}` : p.street
  }
  // Fall back to district or city
  return p.district || p.city || p.state || 'Unknown place'
}

/**
 * Format a secondary subtitle line showing the location context.
 * e.g. "Park Circus, Kolkata, West Bengal"
 */
function formatSubText(feature: PhotonFeature): string {
  const p = feature.properties
  const parts: string[] = []

  // Add street if there's a named place (so the street gives context)
  if (p.name && p.street) parts.push(p.street)
  // Add district/neighborhood for local context
  if (p.district && p.district !== p.name) parts.push(p.district)
  // Add city
  if (p.city && p.city !== p.name && p.city !== p.district) parts.push(p.city)
  // Add state
  if (p.state && p.state !== p.city) parts.push(p.state)
  // Add country only if not India (since this is biased to Kolkata)
  if (p.country && p.country !== 'India' && p.country !== p.state) parts.push(p.country)

  return parts.join(', ')
}


