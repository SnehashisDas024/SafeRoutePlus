import { useState, useRef, useEffect, useCallback } from 'react'

export interface NominatimResult {
  place_id: number
  display_name: string
  lat: string
  lon: string
  type: string
  class: string
}

interface PlaceAutocompleteProps {
  value: string
  onChange: (name: string, coords: [number, number] | null) => void
  placeholder?: string
  isActive?: boolean
  accentColor?: string
  onFocus?: () => void
}

// Bias search results towards Kolkata / India region
const VIEWBOX = '88.20,22.40,88.55,22.70'

export default function PlaceAutocomplete({
  value,
  onChange,
  placeholder = 'Type a place name...',
  isActive = false,
  accentColor = '#27AE60',
  onFocus,
}: PlaceAutocompleteProps) {
  const [query, setQuery] = useState(value)
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([])
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
      setSuggestions([])
      setShowDropdown(false)
      return
    }
    setLoading(true)
    try {
      const params = new URLSearchParams({
        q,
        format: 'json',
        addressdetails: '1',
        limit: '6',
        viewbox: VIEWBOX,
        bounded: '0',
      })
      const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
        headers: { 'Accept-Language': 'en' },
      })
      if (res.ok) {
        const data: NominatimResult[] = await res.json()
        setSuggestions(data)
        setShowDropdown(data.length > 0)
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
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 350)
  }

  const handleSelect = (item: NominatimResult) => {
    const shortName = formatShortName(item.display_name)
    const coords: [number, number] = [parseFloat(item.lon), parseFloat(item.lat)]
    setQuery(shortName)
    setSuggestions([])
    setShowDropdown(false)
    onChange(shortName, coords)
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
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          position: 'relative',
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            onFocus?.()
            if (suggestions.length > 0) setShowDropdown(true)
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
            maxHeight: 280,
            overflowY: 'auto',
          }}
        >
          {suggestions.map((item, idx) => {
            const isHighlighted = idx === highlightIdx
            return (
              <button
                key={item.place_id}
                type="button"
                onClick={() => handleSelect(item)}
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
                <span
                  style={{
                    flexShrink: 0,
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    background: isHighlighted ? accentColor : '#E8E2D6',
                    color: isHighlighted ? '#fff' : '#1E4E6E',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 13,
                    fontWeight: 700,
                    marginTop: 1,
                  }}
                >
                  {getPlaceIcon(item.class)}
                </span>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: '#1E4E6E',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {formatShortName(item.display_name)}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: '#8899A6',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      marginTop: 1,
                    }}
                  >
                    {item.display_name}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** Shorten "Place, Area, City, State, Country" to first 2–3 parts */
function formatShortName(displayName: string): string {
  const parts = displayName.split(', ')
  return parts.slice(0, Math.min(3, parts.length)).join(', ')
}

/** Map Nominatim class to a small emoji icon */
function getPlaceIcon(cls: string): string {
  switch (cls) {
    case 'railway':
      return '🚉'
    case 'highway':
      return '🛣️'
    case 'amenity':
      return '🏛️'
    case 'tourism':
      return '🏖️'
    case 'shop':
      return '🛒'
    case 'building':
      return '🏢'
    case 'place':
      return '📍'
    case 'natural':
      return '🌳'
    case 'leisure':
      return '🎭'
    default:
      return '📌'
  }
}
