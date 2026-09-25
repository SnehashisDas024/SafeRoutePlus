// Hand-drawn clay-style SVG icons (stroke style, like ClayDesk)
import type { CSSProperties } from 'react'

interface IconProps {
  size?: number
  color?: string
  style?: CSSProperties
}

const base = (size: number, color: string, style?: CSSProperties) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none' as const,
  stroke: color,
  strokeWidth: 2.1,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  style,
})

export const IconShield = ({ size = 22, color = 'currentColor', style }: IconProps) => (
  <svg {...base(size, color, style)}>
    <path d="M12 3l7 2.5v5c0 4.6-2.9 8.3-7 10.5-4.1-2.2-7-5.9-7-10.5v-5L12 3z" />
    <path d="M9.5 11.8l1.8 1.8 3.4-3.6" />
  </svg>
)

export const IconHome = ({ size = 22, color = 'currentColor', style }: IconProps) => (
  <svg {...base(size, color, style)}>
    <path d="M4 11l8-7 8 7" />
    <path d="M6 10v9h12v-9" />
    <path d="M10 19v-5h4v5" />
  </svg>
)

export const IconMap = ({ size = 22, color = 'currentColor', style }: IconProps) => (
  <svg {...base(size, color, style)}>
    <path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2z" />
    <path d="M9 4v14M15 6v14" />
  </svg>
)

export const IconCompass = ({ size = 22, color = 'currentColor', style }: IconProps) => (
  <svg {...base(size, color, style)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M15.5 8.5l-2 5-5 2 2-5 5-2z" />
  </svg>
)

export const IconSiren = ({ size = 22, color = 'currentColor', style }: IconProps) => (
  <svg {...base(size, color, style)}>
    <path d="M6 18v-5a6 6 0 0112 0v5" />
    <path d="M4 18h16v2H4z" />
    <path d="M12 4V2M5 6L3.5 4.5M19 6l1.5-1.5" />
  </svg>
)

export const IconReport = ({ size = 22, color = 'currentColor', style }: IconProps) => (
  <svg {...base(size, color, style)}>
    <path d="M6 2h9l4 4v16H6z" />
    <path d="M15 2v4h4" />
    <path d="M9 12h6M9 16h4" />
  </svg>
)

export const IconUsers = ({ size = 22, color = 'currentColor', style }: IconProps) => (
  <svg {...base(size, color, style)}>
    <circle cx="9" cy="8" r="3.4" />
    <path d="M3.5 20c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
    <path d="M16 5.5a3 3 0 010 5.6" />
    <path d="M17.5 15.5c1.8.6 3 2.2 3 4.5" />
  </svg>
)

export const IconMic = ({ size = 22, color = 'currentColor', style }: IconProps) => (
  <svg {...base(size, color, style)}>
    <rect x="9.5" y="3" width="5" height="10" rx="2.5" />
    <path d="M6 11a6 6 0 0012 0" />
    <path d="M12 17v4M9 21h6" />
  </svg>
)

export const IconGear = ({ size = 22, color = 'currentColor', style }: IconProps) => (
  <svg {...base(size, color, style)}>
    <circle cx="12" cy="12" r="3.2" />
    <path d="M12 2.5l1.2 2.7 2.9-.6 1 2.8 2.8 1-.6 2.9 2.2 2-2.2 2 .6 2.9-2.8 1-1 2.8-2.9-.6L12 21.5l-1.2-2.7-2.9.6-1-2.8-2.8-1 .6-2.9-2.2-2 2.2-2-.6-2.9 2.8-1 1-2.8 2.9.6L12 2.5z" />
  </svg>
)

export const IconBell = ({ size = 22, color = 'currentColor', style }: IconProps) => (
  <svg {...base(size, color, style)}>
    <path d="M6 16v-5a6 6 0 1112 0v5l1.5 2.5H4.5L6 16z" />
    <path d="M10 21a2.2 2.2 0 004 0" />
  </svg>
)

export const IconSearch = ({ size = 20, color = 'currentColor', style }: IconProps) => (
  <svg {...base(size, color, style)}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M16 16l4.5 4.5" />
  </svg>
)

export const IconPin = ({ size = 22, color = 'currentColor', style }: IconProps) => (
  <svg {...base(size, color, style)}>
    <path d="M12 21s6.5-5.5 6.5-11a6.5 6.5 0 10-13 0C5.5 15.5 12 21 12 21z" />
    <circle cx="12" cy="10" r="2.4" />
  </svg>
)

export const IconRoute = ({ size = 22, color = 'currentColor', style }: IconProps) => (
  <svg {...base(size, color, style)}>
    <circle cx="6" cy="18" r="2.5" />
    <circle cx="18" cy="6" r="2.5" />
    <path d="M8.5 18H15a3.5 3.5 0 000-7H9a3.5 3.5 0 010-7h6.5" />
  </svg>
)

export const IconClock = ({ size = 22, color = 'currentColor', style }: IconProps) => (
  <svg {...base(size, color, style)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3.5 2" />
  </svg>
)

export const IconSpark = ({ size = 22, color = 'currentColor', style }: IconProps) => (
  <svg {...base(size, color, style)}>
    <path d="M12 2l2.2 6.2L20 10l-5.8 1.8L12 18l-2.2-6.2L4 10l5.8-1.8L12 2z" />
  </svg>
)

export const IconCheck = ({ size = 22, color = 'currentColor', style }: IconProps) => (
  <svg {...base(size, color, style)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8.5 12.2l2.4 2.4 4.6-4.8" />
  </svg>
)

export const IconMenu = ({ size = 22, color = 'currentColor', style }: IconProps) => (
  <svg {...base(size, color, style)}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
)

export const IconClose = ({ size = 18, color = 'currentColor', style }: IconProps) => (
  <svg {...base(size, color, style)}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
)

export const IconWalk = ({ size = 22, color = 'currentColor', style }: IconProps) => (
  <svg {...base(size, color, style)}>
    <circle cx="13" cy="4.5" r="1.9" />
    <path d="M10 20l2-5.5-2.5-3 1-4.5 3 2 3 1" />
    <path d="M12 11.5L9.5 15l-3 1.5M12 14.5l2 2 .5 4" />
  </svg>
)

export const IconCar = ({ size = 22, color = 'currentColor', style }: IconProps) => (
  <svg {...base(size, color, style)}>
    <path d="M5 16l1.2-5a2 2 0 012-1.5h6.6a2 2 0 012 1.5L18 16" />
    <path d="M4 16h16v3h-2.5M4 19h2.5" />
    <circle cx="8" cy="18.5" r="1.4" />
    <circle cx="16" cy="18.5" r="1.4" />
  </svg>
)

export const IconStar = ({ size = 20, color = 'currentColor', style }: IconProps) => (
  <svg {...base(size, color, style)}>
    <path d="M12 3.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8-5.3-2.8-5.3 2.8 1-5.8L3.5 9.7l5.9-.9L12 3.5z" />
  </svg>
)

export const IconPencil = ({ size = 20, color = 'currentColor', style }: IconProps) => (
  <svg {...base(size, color, style)}>
    <path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 013 3L8 19l-4 1z" />
  </svg>
)

export const IconTrash = ({ size = 20, color = 'currentColor', style }: IconProps) => (
  <svg {...base(size, color, style)}>
    <path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13M10 11v5M14 11v5" />
  </svg>
)

export const IconSave = ({ size = 20, color = 'currentColor', style }: IconProps) => (
  <svg {...base(size, color, style)}>
    <path d="M5 4h11l3 3v13H5V4z" />
    <path d="M8 4v5h7V4M8 20v-6h8v6" />
  </svg>
)

export const IconPlus = ({ size = 20, color = 'currentColor', style }: IconProps) => (
  <svg {...base(size, color, style)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
)

export const IconPerson = ({ size = 22, color = 'currentColor', style }: IconProps) => (
  <svg {...base(size, color, style)}>
    <circle cx="12" cy="8" r="3.6" />
    <path d="M5 20c0-3.4 3-5.6 7-5.6s7 2.2 7 5.6" />
  </svg>
)

export const IconVolume = ({ size = 20, color = 'currentColor', style }: IconProps) => (
  <svg {...base(size, color, style)}>
    <path d="M4 10v4h3.5L12 18V6l-4.5 4H4z" />
    <path d="M15.5 9.5a4 4 0 010 5M18 7.5a7 7 0 010 9" />
  </svg>
)

export const IconVolumeOff = ({ size = 20, color = 'currentColor', style }: IconProps) => (
  <svg {...base(size, color, style)}>
    <path d="M4 10v4h3.5L12 18V6l-4.5 4H4z" />
    <path d="M16 10l5 5M21 10l-5 5" />
  </svg>
)

export const IconLock = ({ size = 20, color = 'currentColor', style }: IconProps) => (
  <svg {...base(size, color, style)}>
    <rect x="5.5" y="10.5" width="13" height="9.5" rx="2.5" />
    <path d="M8.5 10.5V8a3.5 3.5 0 017 0v2.5" />
  </svg>
)

export const IconAlert = ({ size = 20, color = 'currentColor', style }: IconProps) => (
  <svg {...base(size, color, style)}>
    <path d="M12 4L2.8 19.5h18.4L12 4z" />
    <path d="M12 10.5v4M12 17.4v.2" />
  </svg>
)

export const IconSatellite = ({ size = 20, color = 'currentColor', style }: IconProps) => (
  <svg {...base(size, color, style)}>
    <path d="M9 11l4-4 4 4-4 4-4-4z" />
    <path d="M13 7l3.5-3.5L21 8l-3.5 3.5" />
    <path d="M7 15l-3 3M4.5 14.5L7 17M6.5 12.5L9 15" />
  </svg>
)

export const IconPlug = ({ size = 20, color = 'currentColor', style }: IconProps) => (
  <svg {...base(size, color, style)}>
    <path d="M9 3v6M15 3v6" />
    <path d="M6.5 9h11v2.5a5.5 5.5 0 01-11 0V9z" />
    <path d="M12 17v4" />
  </svg>
)

export const IconTag = ({ size = 20, color = 'currentColor', style }: IconProps) => (
  <svg {...base(size, color, style)}>
    <path d="M3.5 12.5l8-8H20v8.5l-8 8-8.5-8.5z" />
    <circle cx="16" cy="8" r="1.3" />
  </svg>
)

export const IconSend = ({ size = 20, color = 'currentColor', style }: IconProps) => (
  <svg {...base(size, color, style)}>
    <path d="M3.5 12L21 4l-7.5 17-3-7-7-2z" />
    <path d="M10.5 14L21 4" />
  </svg>
)

export const IconPlay = ({ size = 20, color = 'currentColor', style }: IconProps) => (
  <svg {...base(size, color, style)}>
    <path d="M8 5.5l11 6.5-11 6.5v-13z" />
  </svg>
)

export const IconRefresh = ({ size = 20, color = 'currentColor', style }: IconProps) => (
  <svg {...base(size, color, style)}>
    <path d="M20 12a8 8 0 11-2.3-5.6" />
    <path d="M20 3.5V8h-4.5" />
  </svg>
)

export const IconFlag = ({ size = 20, color = 'currentColor', style }: IconProps) => (
  <svg {...base(size, color, style)}>
    <path d="M6 21V4M6 5h11l-2.5 4L17 13H6" />
  </svg>
)

export const IconSignal = ({ size = 20, color = 'currentColor', style }: IconProps) => (
  <svg {...base(size, color, style)}>
    <path d="M5 18v-3M10 18v-7M15 18V8M20 18V4" />
  </svg>
)

export const IconLadder = ({ size = 20, color = 'currentColor', style }: IconProps) => (
  <svg {...base(size, color, style)}>
    <path d="M8 3v18M16 3v18M8 7h8M8 12h8M8 17h8" />
  </svg>
)

/* ---- Embedded hero art: women-safety companion (guardian shield + journey path + heart pin) ---- */

export const HeroSafetyArt = ({ size = 190 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 120 120" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="hsa-g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#C9E8FA" />
        <stop offset="1" stopColor="#6FB6E8" />
      </linearGradient>
    </defs>
    {/* guardian shield */}
    <path
      d="M60 10l38 13v28c0 26-16 44-38 55C38 95 22 77 22 51V23l38-13z"
      fill="url(#hsa-g)"
      stroke="#1E4E6E"
      strokeWidth="4"
      strokeLinejoin="round"
    />
    {/* dotted journey path inside the shield */}
    <path
      d="M36 78c9-2 10-13 19-15s13 5 21 1 8-15 6-26"
      stroke="#1E4E6E"
      strokeWidth="3.4"
      strokeLinecap="round"
      strokeDasharray="0.5 8"
    />
    {/* start dot */}
    <circle cx="36" cy="78" r="5" fill="#FFFBEF" stroke="#1E4E6E" strokeWidth="3" />
    {/* destination pin with heart */}
    <path
      d="M84 22c6.2 0 11 4.8 11 11 0 8.4-11 16.5-11 16.5S73 41.4 73 33c0-6.2 4.8-11 11-11z"
      fill="#FFFBEF"
      stroke="#1E4E6E"
      strokeWidth="3.4"
      strokeLinejoin="round"
    />
    <path
      d="M84 36.5s-4.6-3-4.6-5.8c0-1.6 1.3-2.8 2.7-2.8 1 0 1.6.5 1.9 1.1.3-.6.9-1.1 1.9-1.1 1.4 0 2.7 1.2 2.7 2.8 0 2.8-4.6 5.8-4.6 5.8z"
      fill="#1E4E6E"
    />
  </svg>
)
