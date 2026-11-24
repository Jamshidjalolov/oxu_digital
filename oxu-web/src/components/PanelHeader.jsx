import { NavLink } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'

export function initials(name = '') {
  return (
    name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase() || '?'
  )
}

export default function PanelHeader({ links, roleLabel, homeTo }) {
  const { user, logout } = useAuth()

  return (
    <header className="topnav">
      <div className="topnav-inner">
        <NavLink to={homeTo || links[0]?.to || '/'} className="topnav-brand">
          <span className="brand-tile">
            <img src="/oxu-logo.png" alt="OXU" width="34" height="34" />
          </span>
          <span className="brand-text">
            <strong>OXU Digital</strong>
            <small>Osiyo Xalqaro Universiteti</small>
          </span>
        </NavLink>

        <nav className="topnav-links" aria-label="Asosiy navigatsiya">
          {links.map(({ to, label, end }) => (
            <NavLink key={to} to={to} end={end}>
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="topnav-user">
          <div className="topnav-user-text">
            <span className="uname">{user?.fullName}</span>
            <span className="urole">
              {roleLabel}
              {user?.group?.name ? ` · ${user.group.name}` : ''}
            </span>
          </div>
          <span className="avatar-sm" aria-hidden="true">
            {initials(user?.fullName)}
          </span>
          <button className="btn-icon" title="Chiqish" aria-label="Chiqish" onClick={logout}>
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </header>
  )
}
