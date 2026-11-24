import { NavLink, Outlet } from 'react-router-dom'
import { LayoutDashboard, Users, Layers, CalendarDays, BarChart3, LogOut, Building2 } from 'lucide-react'
import { useAuth } from '../../context/AuthContext.jsx'
import { initials } from '../../components/PanelHeader.jsx'
import { formatDateUZ, toISODate } from '../../utils/week.js'

const navSections = [
  {
    label: 'Asosiy',
    items: [{ to: '/admin', end: true, icon: LayoutDashboard, label: 'Bosh sahifa', short: 'Asosiy' }],
  },
  {
    label: 'Boshqaruv',
    items: [
      { to: '/admin/users', icon: Users, label: 'Foydalanuvchilar', short: 'Hisoblar' },
      { to: '/admin/groups-subjects', icon: Layers, label: 'Guruhlar va fanlar', short: 'Guruhlar' },
      { to: '/admin/departments', icon: Building2, label: 'Kafedralar', short: 'Kafedra' },
      { to: '/admin/documents', icon: Building2, label: 'Ilmiy hujjatlar', short: 'Hujjatlar' },
    ],
  },
  {
    label: 'Rejalashtirish',
    items: [
      { to: '/admin/schedule', icon: CalendarDays, label: 'Dars jadvali', short: 'Jadval' },
      { to: '/admin/report', icon: BarChart3, label: 'Hisobot', short: 'Hisobot' },
      { to: '/admin/profile', icon: Users, label: 'Mening profilim', short: 'Profil' },
    ],
  },
]

export default function AdminLayout() {
  const { user, logout } = useAuth()

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <span className="brand-tile">
            <img src="/oxu-logo.png" alt="OXU" width="40" height="40" />
          </span>
          <div className="admin-brand-text">
            <h2>OXU Digital</h2>
            <span>Osiyo Xalqaro Universiteti</span>
          </div>
        </div>

        <nav className="admin-nav">
          {navSections.map((section) => (
            <div className="admin-nav-section" key={section.label}>
              <span className="admin-nav-label">{section.label}</span>
              {section.items.map(({ to, end, icon: Icon, label, short }) => (
                <NavLink key={label} to={to} end={end} aria-label={label} title={label}>
                  <Icon size={18} />
                  <span className="nav-full">{label}</span>
                  <span className="nav-short">{short}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="admin-sidebar-footer">
          <div className="admin-user">
            <span className="avatar-sm" aria-hidden="true">
              {initials(user?.fullName)}
            </span>
            <div className="admin-user-text">
              <strong>{user?.fullName}</strong>
              <span>Administrator</span>
            </div>
          </div>
          <button className="admin-logout" onClick={logout}>
            <LogOut size={16} />
            <span>Chiqish</span>
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <div className="admin-topbar-left">
            <span className="admin-topbar-brand">
              <span className="brand-tile admin-topbar-tile">
                <img src="/oxu-logo.png" alt="OXU" width="26" height="26" />
              </span>
              OXU Digital
            </span>
            <span className="admin-topbar-title">
              <span className="dot-live" aria-hidden="true" />
              Boshqaruv paneli
            </span>
          </div>
          <div className="admin-topbar-meta">
            <span className="meta-chip">
              <CalendarDays size={14} aria-hidden="true" />
              {formatDateUZ(toISODate(new Date()))}
            </span>
          </div>
        </header>

        <div className="admin-content">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
