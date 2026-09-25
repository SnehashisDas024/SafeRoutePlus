import type { DemoPair } from '../types'

export const DEMO_PAIRS: DemoPair[] = [
  { 
    id: 'demo-1',
    name: 'Park Street → Salt Lake',
    origin: [88.36, 22.57],
    destination: [88.40, 22.60],
    mode: 'walk' as const
  },
  { 
    id: 'demo-2', 
    name: 'Howrah → New Town',
    origin: [88.34, 22.58],
    destination: [88.47, 22.57],
    mode: 'drive' as const
  },
  { 
    id: 'demo-3',
    name: 'Alipore → Ruby',
    origin: [88.33, 22.52],
    destination: [88.38, 22.54],
    mode: 'walk' as const
  }
]

export function getDemoPair(id: string): DemoPair | undefined {
  return DEMO_PAIRS.find(p => p.id === id)
}