import os

path = r'C:\Users\sneha\Desktop\SafeRoutePlus\frontend\src\components\PlaceAutocomplete.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update Props Interface
old_props = """interface PlaceAutocompleteProps {
  value: string
  onChange: (name: string, coords: [number, number] | null) => void
  placeholder?: string
  isActive?: boolean
  accentColor?: string
  onFocus?: () => void
}"""

new_props = """export interface RecentPlace {
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
}"""
content = content.replace(old_props, new_props)

# 2. Update Component Arguments
old_args = """export default function PlaceAutocomplete({
  value,
  onChange,
  placeholder = 'Type a place name...',
  isActive = false,
  accentColor = '#27AE60',
  onFocus,
}: PlaceAutocompleteProps) {"""

new_args = """export default function PlaceAutocomplete({
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
"""
content = content.replace(old_args, new_args)

# 3. Update fetchSuggestions logic for empty queries
old_fetch = """  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setSuggestions([])
      setShowDropdown(false)
      return
    }"""

new_fetch = """  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      if (recentPlaces && recentPlaces.length > 0) {
        setSuggestions(recentPlaces.map(rp => mockFeature(rp.name, rp.coords)))
        setShowDropdown(true)
      } else {
        setSuggestions([])
        setShowDropdown(false)
      }
      return
    }"""
content = content.replace(old_fetch, new_fetch)

# 4. Update onFocus logic
old_onFocus = """          onFocus={() => {
            onFocus?.()
            if (suggestions.length > 0) setShowDropdown(true)
          }}"""

new_onFocus = """          onFocus={() => {
            onFocus?.()
            if (query.trim().length < 2 && recentPlaces && recentPlaces.length > 0) {
              setSuggestions(recentPlaces.map(rp => mockFeature(rp.name, rp.coords)))
              setShowDropdown(true)
            } else if (suggestions.length > 0) {
              setShowDropdown(true)
            }
          }}"""
content = content.replace(old_onFocus, new_onFocus)

# 5. Differentiate rendering (Clock vs Pin icon, and title)
old_render = """            const isHighlighted = idx === highlightIdx
            const mainName = formatPlaceName(feature)
            const subText = formatSubText(feature)
            return ("""
            
new_render = """            const isHighlighted = idx === highlightIdx
            const isRecent = feature.properties.type === 'recent_history'
            const mainName = formatPlaceName(feature)
            const subText = isRecent ? 'Recent Search' : formatSubText(feature)
            return ("""
content = content.replace(old_render, new_render)

old_svg = """                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={isHighlighted ? '#fff' : '#1E4E6E'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                  </span>"""

new_svg = """                  >
                    {isRecent ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={isHighlighted ? '#fff' : '#1E4E6E'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={isHighlighted ? '#fff' : '#1E4E6E'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                    )}
                  </span>"""
content = content.replace(old_svg, new_svg)

# Also fix the subtitle if it's missing (for recent searches)
old_subtitle = """                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div
                      style={{
                        fontSize: 13.5,
                        fontWeight: 700,
                        color: isHighlighted ? '#1E4E6E' : '#1E4E6E',
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
                          fontWeight: 500,
                          color: isHighlighted ? 'rgba(30,78,110,0.8)' : 'var(--ink-soft)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {subText}
                      </div>
                    )}
                  </div>"""
                  
new_subtitle = """                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div
                      style={{
                        fontSize: 13.5,
                        fontWeight: 700,
                        color: isHighlighted ? '#1E4E6E' : '#1E4E6E',
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
                          fontWeight: isRecent ? 700 : 500,
                          color: isHighlighted ? 'rgba(30,78,110,0.8)' : (isRecent ? '#27AE60' : 'var(--ink-soft)'),
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {subText}
                      </div>
                    )}
                  </div>"""
content = content.replace(old_subtitle, new_subtitle)


with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Patched PlaceAutocomplete.tsx")
