import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import LandingPage from './landing/LandingPage'
import LoginScreen from './screens/LoginScreen'
import SignupScreen from './screens/SignupScreen'
import DashboardScreen from './screens/DashboardScreen'
import PlanScreen from './screens/PlanScreen'
import RouteCompareScreen from './screens/RouteCompareScreen'
import ActiveTripScreen from './screens/ActiveTripScreen'
import SOSScreen from './screens/SOSScreen'
import ReportScreen from './screens/ReportScreen'
import ContactsScreen from './screens/ContactsScreen'
import VoiceSetupScreen from './screens/VoiceSetupScreen'
import SettingsScreen from './screens/SettingsScreen'
import LiveShareScreen from './screens/LiveShareScreen'

export default function App() {
  return (
    <Routes>
      <Route path="/share/:token" element={<LiveShareScreen />} />
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginScreen />} />
      <Route path="/signup" element={<SignupScreen />} />

      <Route path="/landing" element={<LandingPage />} />
      <Route element={<Layout />}>
        <Route path="/dashboard" element={<DashboardScreen />} />
        <Route path="/plan" element={<PlanScreen />} />
        <Route path="/compare" element={<RouteCompareScreen />} />
        <Route path="/trip" element={<ActiveTripScreen />} />
        <Route path="/trip/:tripId" element={<ActiveTripScreen />} />
        <Route path="/sos" element={<SOSScreen />} />
        <Route path="/report" element={<ReportScreen />} />
        <Route path="/contacts" element={<ContactsScreen />} />
        <Route path="/voice" element={<VoiceSetupScreen />} />
        <Route path="/settings" element={<SettingsScreen />} />
      </Route>
    </Routes>
  )
}
