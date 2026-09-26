type IconName = 'shield' | 'route' | 'play' | 'mapPin' | 'eye' | 'bell' | 'users' | 'arrow' | 'check'

export default function LandingIcon({ name, size = 22 }: { name: IconName; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true }
  if (name === 'shield') return <svg {...common}><path d="M12 3 20 6v5c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10V6l8-3Z" /><path d="m8.7 12 2.1 2.1 4.6-4.7" /></svg>
  if (name === 'route') return <svg {...common}><circle cx="6" cy="18" r="2.5" /><circle cx="18" cy="6" r="2.5" /><path d="M8.5 18h2.2a3.3 3.3 0 0 0 3.3-3.3v-5A3.3 3.3 0 0 1 17.3 6H18" /></svg>
  if (name === 'play') return <svg {...common}><path d="m9 5 10 7-10 7V5Z" /></svg>
  if (name === 'mapPin') return <svg {...common}><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></svg>
  if (name === 'eye') return <svg {...common}><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="2.7" /></svg>
  if (name === 'bell') return <svg {...common}><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>
  if (name === 'users') return <svg {...common}><path d="M16 20v-1.5a4.5 4.5 0 0 0-4.5-4.5h-3A4.5 4.5 0 0 0 4 18.5V20" /><circle cx="10" cy="7" r="3" /><path d="M17 11a3 3 0 1 0-1.5-5.6M20 20v-1.5a4.5 4.5 0 0 0-2.6-4.1" /></svg>
  if (name === 'arrow') return <svg {...common}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
  return <svg {...common}><path d="m5 12 4 4L19 6" /></svg>
}
