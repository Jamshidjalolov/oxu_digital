import { Outlet } from 'react-router-dom'
import MemberShell from '../../components/MemberShell.jsx'

const links = [
  { to: '/student', label: 'Haftalik jadval', end: true },
  { to: '/student/attendance', label: 'Mening davomatim' },
  { to: '/student/profile', label: 'Mening profilim' },
]

export default function StudentLayout() {
  return <MemberShell links={links} roleLabel="Talaba" />
}
