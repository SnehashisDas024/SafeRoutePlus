import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  IconHome, IconMap, IconCompass, IconSiren, IconReport,
  IconUsers, IconMic, IconGear, IconShield, IconMenu,
} from './Icons'

const NAV_MAIN = [
  { to: '/', icon: IconHome, label: 'Dashboard' },
  { to: '/plan', icon: IconMap, label: 'Plan Route' },
  { to: '/trip', icon: IconCompass, label: 'Active Trip' },
  { to: '/sos', icon: IconSiren, label: 'Emergency SOS' },
  { to: '/report', icon: IconReport, label: 'Trip Report' },
]

const NAV_SETTINGS = [
  { to: '/contacts', icon: IconUsers, label: 'Contacts' },
  { to: '/voice', icon: IconMic, label: 'Voice Words' },
  { to: '/settings', icon: IconGear, label: 'Settings' },
]

const BOTTOM_ITEMS = [
  { to: '/', icon: IconHome, label: 'Home' },
  { to: '/plan', icon: IconMap, label: 'Plan' },
  { to: '/sos', icon: IconSiren, label: 'SOS' },
  { to: '/trip', icon: IconCompass, label: 'Trip' },
  { to: '/contacts', icon: IconUsers, label: 'Contacts' },
]

const PAGE_TITLES: Record<string, { title: string; sub: string }> = {
  '/': { title: 'Safety Dashboard', sub: 'Your live protection overview' },
  '/plan': { title: 'Plan a Safe Route', sub: 'Safety-ranked paths, not just fast ones' },
  '/compare': { title: 'Compare Routes', sub: 'Pick the safest option for your journey' },
  '/trip': { title: 'Active Trip', sub: 'Live monitoring with tiered escalation' },
  '/sos': { title: 'Emergency SOS', sub: 'Immediate help, one hold away' },
  '/report': { title: 'Trip Report', sub: 'Your feedback makes routes safer for everyone' },
  '/contacts': { title: 'Trusted Contacts', sub: 'Who gets alerted, and when' },
  '/voice': { title: 'Voice Safety Words', sub: 'On-device duress & safe words' },
  '/settings': { title: 'Settings', sub: 'System status & how escalation works' },
}

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening'
}

export default function Layout() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const location = useLocation()

  useEffect(() => setDrawerOpen(false), [location.pathname])

  const page = PAGE_TITLES[location.pathname] ?? { title: 'SafeRoute+', sub: '' }
  const isSos = location.pathname === '/sos'

  const NavLinks = ({ items }: { items: typeof NAV_MAIN }) => (
    <>
      {items.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
        >
          <span className="nav-icon"><Icon size={19} /></span>
          {label}
        </NavLink>
      ))}
    </>
  )

  return (
    <div className="app-shell">
      <aside className={`sidebar${drawerOpen ? ' open' : ''}`}>
        <div className="brand">
          <div className="brand-logo"><IconShield size={24} color="#14496B" /></div>
          <div>
            <div className="brand-name">Safe<span>Route+</span></div>
            <div className="brand-sub">Safety companion</div>
          </div>
        </div>

        <NavLinks items={NAV_MAIN} />

        <hr className="nav-divider" />

        <NavLinks items={NAV_SETTINGS} />

        <div className="sidebar-user">
          <div className="row" style={{ gap: 11 }}>
            <div className="avatar">S</div>
            <div>
              <div style={{ fontWeight: 900, fontSize: 14.5 }}>Stay Safe</div>
              <div className="tiny">Protected by SafeRoute+</div>
            </div>
          </div>
          <div className="progress"><div style={{ width: '72%' }} /></div>
          <div className="tiny" style={{ marginTop: 7 }}>72% setup complete</div>
        </div>
      </aside>

      <div className={`drawer-overlay${drawerOpen ? ' show' : ''}`} onClick={() => setDrawerOpen(false)} />

      <div className="main-area">
        <header className="topbar">
          <button className="hamburger clay-ico-btn" onClick={() => setDrawerOpen(true)}>
            <IconMenu size={20} />
          </button>
          <div>
            <h1>{page.title}</h1>
            {page.sub && <div className="subtitle">{greeting()} — {page.sub}</div>}
          </div>
          <div className="topbar-spacer" />
          {!isSos && (
            <NavLink to="/sos" className="clay-btn danger" style={{ padding: '11px 22px' }}>
              <IconSiren size={17} /> SOS
            </NavLink>
          )}
        </header>
        <main className="page-scroll">
          <div className="page" key={location.pathname}>
            <Outlet />
          </div>
        </main>
      </div>

      <nav className="bottom-nav">
        {BOTTOM_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>
            <Icon size={19} />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

