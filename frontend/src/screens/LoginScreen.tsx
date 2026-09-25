import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { IconShield } from '../components/Icons'

export default function LoginScreen() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('http://localhost:8000/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Login failed')
      
      localStorage.setItem('authToken', data.token)
      localStorage.setItem('userId', data.user_id)
      navigate('/dashboard')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column', 
      alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-gradient)'
    }}>
      <div className="clay card" style={{ maxWidth: 400, width: '90%', padding: '40px 30px', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', background: '#e0eaf5', padding: 15, borderRadius: 20, marginBottom: 20 }}>
          <IconShield size={40} color="#1E4E6E" />
        </div>
        <h1 style={{ color: '#1E4E6E', margin: '0 0 10px 0', fontSize: 24, fontWeight: 900 }}>Welcome Back</h1>
        <p className="muted" style={{ marginBottom: 30 }}>Sign in to continue your safe journeys.</p>

        {error && <div className="clay-inset" style={{ color: '#D32F2F', background: '#ffebee', padding: 10, marginBottom: 20, fontSize: 13, borderRadius: 8 }}>{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
          <input
            type="email"
            className="clay-inset"
            placeholder="Email Address"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            style={{ padding: 12, border: 'none', borderRadius: 12, fontSize: 14, width: '100%' }}
          />
          <input
            type="password"
            className="clay-inset"
            placeholder="Password"
            required
            value={password}
            onChange={e => setPassword(e.target.value)}
            style={{ padding: 12, border: 'none', borderRadius: 12, fontSize: 14, width: '100%' }}
          />
          <button 
            type="submit" 
            className="clay-btn" 
            disabled={loading}
            style={{ padding: 14, background: '#1E4E6E', color: '#fff', fontSize: 16, marginTop: 10 }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p style={{ marginTop: 25, fontSize: 13, color: '#666' }}>
          Don't have an account? <Link to="/signup" style={{ color: '#1E4E6E', fontWeight: 700, textDecoration: 'none' }}>Sign up</Link>
        </p>
      </div>
    </div>
  )
}
