import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import LandingIcon from './LandingIcon'
import './LandingPage.css'

const features = [
  { icon: 'route' as const, title: 'Safety-Scored Routes', text: 'Choose paths designed around your peace of mind.' },
  { icon: 'eye' as const, title: 'Live Journey Guardian', text: 'A gentle watchful eye while you are on the move.' },
  { icon: 'bell' as const, title: 'Discreet SOS', text: 'Reach help quickly and quietly whenever you need it.' },
  { icon: 'users' as const, title: 'Trusted Contact Alerts', text: 'Keep your circle informed with thoughtful updates.' },
]

const steps = [
  { icon: 'mapPin' as const, title: 'Plan your route', text: 'Compare routes with safety in view.' },
  { icon: 'shield' as const, title: 'Travel with live protection', text: 'Stay connected from doorstep to destination.' },
  { icon: 'bell' as const, title: 'Instant help if needed', text: 'Send a discreet alert in a single moment.' },
]

function Brand() {
  return <Link className="landing-brand" to="/landing" aria-label="SafeRoute+ home"><span className="landing-logo"><LandingIcon name="shield" size={25} /></span><span><strong>SafeRoute<span>+</span></strong><small>Safety companion</small></span></Link>
}

export default function LandingPage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = 2
  }, [])

  return <main className="landing-page">
    <nav className="landing-nav" aria-label="Main navigation">
      <Brand />
      <div className="landing-nav-links"><a href="#features">Features</a><a href="#how-it-works">How It Works</a><a href="#safety">Safety</a><a href="#contact">Contact</a></div>
      <Link className="landing-button landing-button--small" to="/plan">Get Started <LandingIcon name="arrow" size={17} /></Link>
    </nav>

    <section className="landing-hero" aria-labelledby="landing-title">
      <div className="landing-hero-copy">
        <p className="landing-badge">✨ Every journey, safer</p>
        <h1 id="landing-title">Safety that moves <em>with you</em></h1>
        <p className="landing-lede">Feel more confident at every turn with thoughtful route guidance and quiet support that travels with you.</p>
        <div className="landing-actions">
          <Link className="landing-button" to="/plan"><LandingIcon name="route" size={20} />Plan My Safe Route</Link>
          <a className="landing-button landing-button--secondary" href="#how-it-works"><LandingIcon name="play" size={19} />See How It Works</a>
        </div>
        <p className="landing-journeys"><span><LandingIcon name="check" size={15} /></span><b>10,000+</b> journeys protected with care</p>
      </div>
      <div className="landing-video-shell">
        <div className="landing-video-frame">
          <video ref={videoRef} src="/videos/landing.mp4" autoPlay muted loop playsInline onLoadedMetadata={(event) => { event.currentTarget.playbackRate = 2 }} aria-label="SafeRoute+ app demonstration" />
        </div>
        <span className="landing-video-note"><i /> Live safety, at a glance</span>
      </div>
    </section>

    <section className="landing-section" id="features" aria-labelledby="features-title">
      <div className="landing-section-heading"><p>Designed for your everyday</p><h2 id="features-title">Quiet confidence, built in</h2></div>
      <div className="landing-feature-grid">{features.map((feature) => <article className="landing-feature" key={feature.title}><span className="landing-icon-tile"><LandingIcon name={feature.icon} /></span><h3>{feature.title}</h3><p>{feature.text}</p></article>)}</div>
    </section>

    <section className="landing-section landing-steps-section" id="how-it-works" aria-labelledby="steps-title">
      <div className="landing-section-heading landing-section-heading--center"><p>A simple safety ritual</p><h2 id="steps-title">Protection in three gentle steps</h2></div>
      <div className="landing-steps">{steps.map((step, index) => <article className="landing-step" key={step.title}><span className="landing-step-number">0{index + 1}</span><span className="landing-step-icon"><LandingIcon name={step.icon} size={26} /></span><h3>{step.title}</h3><p>{step.text}</p></article>)}</div>
    </section>

    <section className="landing-trust" id="safety" aria-labelledby="trust-title">
      <div><p className="landing-eyebrow">Safety, without the noise</p><h2 id="trust-title">A calmer way to get there</h2><p>SafeRoute+ gives you meaningful context before you leave and caring support while you travel—so safety can feel natural, never overwhelming.</p></div>
      <div className="landing-trust-stats"><div><b>100%</b><span>route visibility</span></div><div><b>0</b><span>setup friction</span></div><div><b>24/7</b><span>ready support</span></div></div>
    </section>

    <section className="landing-sos" aria-label="Emergency support"><p>Help should always be close</p><h2>Here when every second matters.</h2><Link className="landing-button landing-button--sos" to="/sos"><LandingIcon name="bell" size={20} />Emergency SOS</Link></section>

    <footer className="landing-footer" id="contact"><Brand /><div><a href="#features">Features</a><a href="#how-it-works">How It Works</a><a href="#safety">Safety</a><a href="mailto:hello@saferoute.plus">Contact</a></div><p>© 2026 SafeRoute+. Made for safer journeys.</p></footer>
  </main>
}
