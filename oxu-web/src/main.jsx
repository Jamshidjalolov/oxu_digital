import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import NotificationCenter from './components/NotificationCenter.jsx'
import './index.css'
import './modern.css'
import './schedule-premium.css'
import './login-premium.css'
import './confirmation.css'
import './availability.css'
import './member.css'
import './profile.css'
import './subject.css'
import './teacher-workload.css'
import './teacher-kpi.css'
import './documents.css'
import './admin-documents.css'
import './department-kpi.css'
import ConfirmProvider from './components/ConfirmProvider.jsx'
import Realtime from './components/Realtime.jsx'

function AuthenticatedApp() {
  const { user, token, loading } = useAuth()
  return (
    <>
      <App />
      <Realtime />
      {!loading && user && token && <NotificationCenter key={`${user._id || user.id || ''}:${token}`} />}
    </>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ConfirmProvider><AuthProvider>
        <AuthenticatedApp />
      </AuthProvider></ConfirmProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
