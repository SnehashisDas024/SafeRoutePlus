import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/layout/Layout'
import InstallPrompt from './components/layout/InstallPrompt'
import React, { Suspense } from 'react'

// Lazy-loaded screen components
const PlanScreen = React.lazy(() => import('./screens/PlanScreen'))
const RouteCompareScreen = React.lazy(() => import('./screens/RouteCompareScreen'))
const ActiveTripScreen = React.lazy(() => import('./screens/ActiveTripScreen'))
const ReportScreen = React.lazy(() => import('./screens/ReportScreen'))
const ContactsScreen = React.lazy(() => import('./screens/ContactsScreen'))
const VoiceSetupScreen = React.lazy(() => import('./screens/VoiceSetupScreen'))
const SettingsScreen = React.lazy(() => import('./screens/SettingsScreen'))
const DashboardScreen = React.lazy(() => import('./screens/DashboardScreen'))
const LiveShareScreen = React.lazy(() => import('./screens/LiveShareScreen'))
const SOSScreen = React.lazy(() => import('./screens/SOSScreen'))

function LoadingFallback() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: '#f5f5f5'
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          border: '3px solid #1976d2',
          borderTopColor: 'transparent',
          borderRadius: '50%',
          width: '40px',
          height: '40px',
          margin: '0 auto 16px',
          animation: 'spin 1s linear infinite'
        }} />
        <p style={{ color: '#666' }}>Loading...</p>
      </div>
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<LoadingFallback />}>
        <Layout>
          <Routes>
            <Route path="/" element={<Navigate to="/plan" replace />} />
            <Route path="/plan" element={<PlanScreen />} />
            <Route path="/compare" element={<RouteCompareScreen />} />
            <Route path="/trip/:id" element={<ActiveTripScreen />} />
            <Route path="/trip/:id/report" element={<ReportScreen />} />
            <Route path="/report" element={<ReportScreen />} />
            <Route path="/contacts" element={<ContactsScreen />} />
            <Route path="/voice-setup" element={<VoiceSetupScreen />} />
            <Route path="/settings" element={<SettingsScreen />} />
            <Route path="/dashboard" element={<DashboardScreen />} />
            <Route path="/share/:token" element={<LiveShareScreen />} />
            <Route path="/sos" element={<SOSScreen />} />
          </Routes>
        </Layout>
      </Suspense>
      <InstallPrompt />
    </BrowserRouter>
  )
}

export default App