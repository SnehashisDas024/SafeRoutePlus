import React from 'react'
import type { RouteHistoryItem } from '../types'
import { IconWalk, IconCar, IconCheck } from './Icons'

interface RouteHistoryListProps {
  recentRoutes: RouteHistoryItem[]
  frequentRoutes: RouteHistoryItem[]
  selectedRouteId: string | null
  loading?: boolean
  onSelectRoute: (item: RouteHistoryItem) => void
}

export const RouteHistoryList: React.FC<RouteHistoryListProps> = ({
  recentRoutes,
  frequentRoutes,
  selectedRouteId,
  loading = false,
  onSelectRoute,
}) => {
  const [activeTab, setActiveTab] = React.useState<'recent' | 'frequent'>('recent')

  const items = activeTab === 'recent' ? recentRoutes : frequentRoutes

  if (loading && recentRoutes.length === 0 && frequentRoutes.length === 0) {
    return (
      <div className="clay card mt-2" style={{ textAlign: 'center', padding: '16px' }}>
        <span className="tiny" style={{ color: '#888' }}>Loading route history...</span>
      </div>
    )
  }

  if (recentRoutes.length === 0 && frequentRoutes.length === 0) {
    return null
  }

  const formatTimeAgo = (dateStr: string) => {
    try {
      const d = new Date(dateStr)
      const diffSec = Math.floor((Date.now() - d.getTime()) / 1000)
      if (diffSec < 60) return 'just now'
      if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`
      if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`
      return `${Math.floor(diffSec / 86400)}d ago`
    } catch {
      return ''
    }
  }

  return (
    <div className="clay card mt-2">
      <div className="row-between mb-2">
        <h3 style={{ margin: 0, fontSize: 15, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>Saved Routes</span>
        </h3>
        <div className="row" style={{ gap: 4 }}>
          <button
            type="button"
            className={`chip ${activeTab === 'recent' ? 'active' : ''}`}
            style={{ padding: '3px 10px', fontSize: 11.5 }}
            onClick={() => setActiveTab('recent')}
          >
            Recent ({recentRoutes.length})
          </button>
          <button
            type="button"
            className={`chip ${activeTab === 'frequent' ? 'active' : ''}`}
            style={{ padding: '3px 10px', fontSize: 11.5 }}
            onClick={() => setActiveTab('frequent')}
          >
            Frequent ({frequentRoutes.length})
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 220, overflowY: 'auto', paddingRight: 2 }}>
        {items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '12px 0', color: '#999', fontSize: 12 }}>
            No {activeTab} routes yet.
          </div>
        ) : (
          items.map((item) => {
            const isSelected = selectedRouteId === item.id
            const origLabel = item.origin.name || `${item.origin.coordinates[1].toFixed(3)}, ${item.origin.coordinates[0].toFixed(3)}`
            const destLabel = item.destination.name || `${item.destination.coordinates[1].toFixed(3)}, ${item.destination.coordinates[0].toFixed(3)}`

            return (
              <button
                key={item.id}
                type="button"
                className={`clay-btn ${isSelected ? '' : 'ghost'}`}
                style={{
                  justifyContent: 'space-between',
                  fontSize: 12.5,
                  padding: '9px 12px',
                  background: isSelected ? '#DEF2F1' : undefined,
                  border: isSelected ? '2px solid #2B7A78' : undefined,
                  textAlign: 'left',
                }}
                onClick={() => onSelectRoute(item)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden', flex: 1 }}>
                  <span style={{ color: '#2B7A78', flexShrink: 0 }}>
                    {item.mode === 'drive' ? <IconCar size={15} /> : <IconWalk size={15} />}
                  </span>
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <span style={{ fontWeight: 600 }}>{origLabel}</span>
                    <span style={{ color: '#888', margin: '0 4px' }}>→</span>
                    <span style={{ fontWeight: 600 }}>{destLabel}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  {activeTab === 'frequent' && (
                    <span
                      style={{
                        fontSize: 10.5,
                        background: '#E2E8F0',
                        color: '#475569',
                        padding: '1px 6px',
                        borderRadius: 10,
                        fontWeight: 700,
                      }}
                    >
                      {item.use_count}x
                    </span>
                  )}
                  {activeTab === 'recent' && item.last_used_at && (
                    <span style={{ fontSize: 10, color: '#94A3B8' }}>
                      {formatTimeAgo(item.last_used_at)}
                    </span>
                  )}
                  {isSelected && <IconCheck size={14} color="#2B7A78" />}
                </div>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
export default RouteHistoryList
