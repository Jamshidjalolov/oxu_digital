import { Outlet } from 'react-router-dom'
import MemberShell from '../../components/MemberShell.jsx'

const links = [
  { to: '/teacher', label: 'Haftalik jadval', end: true },
  { to: '/teacher/stats', label: 'Mening statistikam' },
  { to: '/teacher/kpi', label: 'Ilmiy KPI — kabinetim' },
  { to: '/teacher/department-kpi', label: 'Kafedra KPI' },
  { to: '/teacher/documents', label: 'Hujjatlar' },
  { to: '/teacher/profile', label: 'Mening profilim' },
]

export default function TeacherLayout() {
  return <MemberShell links={links} roleLabel="O‘qituvchi" />
}
