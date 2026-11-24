import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

export default function ProtectedRoute({ roles, children }) {
  const { user, loading } = useAuth()

  if (loading) return <div className="page-loading">Yuklanmoqda...</div>
  if (!user) return <Navigate to="/login" replace />
  if (roles && !roles.includes(user.role)) {
    if (user.role === 'admin') return <Navigate to="/admin" replace />
    if (user.role === 'teacher') return <Navigate to="/teacher" replace />
    return <Navigate to="/student" replace />
  }
  return children
}
