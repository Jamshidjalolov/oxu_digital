import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import Login from './pages/Login.jsx'
import AdminLayout from './pages/admin/AdminLayout.jsx'
import AdminDashboard from './pages/admin/Dashboard.jsx'
import AdminUsers from './pages/admin/Users.jsx'
import AdminGroupsSubjects from './pages/admin/GroupsSubjects.jsx'
import AdminSchedule from './pages/admin/Schedule.jsx'
import AdminReport from './pages/admin/Report.jsx'
import TeacherLayout from './pages/teacher/TeacherLayout.jsx'
import TeacherSchedule from './pages/teacher/TeacherSchedule.jsx'
import Attendance from './pages/teacher/Attendance.jsx'
import TeacherStats from './pages/teacher/TeacherStats.jsx'
import TeacherKpi from './pages/teacher/TeacherKpi.jsx'
import DepartmentKpi from './pages/teacher/DepartmentKpi.jsx'
import TeacherDocuments from './pages/teacher/Documents.jsx'
import AdminDocuments from './pages/admin/Documents.jsx'
import DepartmentLayout from './pages/department/DepartmentLayout.jsx'
import DepartmentDocuments from './pages/department/DepartmentDocuments.jsx'
import StudentLayout from './pages/student/StudentLayout.jsx'
import StudentSchedule from './pages/student/StudentSchedule.jsx'
import MyAttendance from './pages/student/MyAttendance.jsx'
import Profile from './pages/Profile.jsx'
import SubjectCreate from './pages/admin/SubjectCreate.jsx'
import AdminDepartments from './pages/admin/Departments.jsx'

function HomeRedirect() {
  const { user, loading } = useAuth()
  if (loading) return <div className="page-loading">Yuklanmoqda...</div>
  if (!user) return <Navigate to="/login" replace />
  if (user.role === 'admin') return <Navigate to="/admin" replace />
  if (user.role === 'department_head') return <Navigate to="/department-head" replace />
  if (user.role === 'teacher') return <Navigate to="/teacher" replace />
  return <Navigate to="/student" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/login" element={<Login />} />

      <Route
        path="/admin"
        element={
          <ProtectedRoute roles={['admin']}>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="departments" element={<AdminDepartments />} />
        <Route path="groups-subjects" element={<AdminGroupsSubjects />} />
        <Route path="schedule" element={<AdminSchedule />} />
        <Route path="report" element={<AdminReport />} />
        <Route path="documents" element={<AdminDocuments />} />
        <Route path="profile" element={<Profile />} />
        <Route path="subjects/new" element={<SubjectCreate />} />
      </Route>

      <Route
        path="/teacher"
        element={
          <ProtectedRoute roles={['teacher', 'admin']}>
            <TeacherLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<TeacherSchedule />} />
        <Route path="stats" element={<TeacherStats />} />
        <Route path="kpi" element={<TeacherKpi />} />
        <Route path="department-kpi" element={<DepartmentKpi />} />
        <Route path="documents" element={<TeacherDocuments />} />
        <Route path="profile" element={<Profile />} />
      </Route>
      <Route
        path="/teacher/lesson/:id/attendance"
        element={
          <ProtectedRoute roles={['teacher', 'department_head', 'admin']}>
            <Attendance />
          </ProtectedRoute>
        }
      />

      <Route
        path="/student"
        element={
          <ProtectedRoute roles={['student']}>
            <StudentLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<StudentSchedule />} />
        <Route path="attendance" element={<MyAttendance />} />
        <Route path="profile" element={<Profile />} />
      </Route>
      <Route path="/department-head" element={<ProtectedRoute roles={['department_head']}><DepartmentLayout /></ProtectedRoute>}>
        <Route index element={<DepartmentKpi />} />
        <Route path="schedule" element={<TeacherSchedule />} />
        <Route path="workload" element={<TeacherStats />} />
        <Route path="profile" element={<Profile />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
