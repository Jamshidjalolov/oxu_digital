import { NavLink, Outlet } from 'react-router-dom'
import { CalendarDays, BarChart3, LogOut, GraduationCap } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { initials } from './PanelHeader.jsx'
export default function MemberShell({ links, roleLabel }) {
 const { user,logout }=useAuth()
 return <div className="member-shell"><aside className="member-sidebar"><NavLink to={links[0].to} className="member-brand"><img src="/oxu-logo.png" alt="OXU"/><div><strong>OXU Digital</strong><small>Osiyo Xalqaro Universiteti</small></div></NavLink><span className="member-nav-caption">SHAXSIY KABINET</span><nav>{links.map((l,i)=>{const Icon=i?BarChart3:CalendarDays;return <NavLink key={l.to} to={l.to} end={l.end}><Icon size={19}/>{l.label}</NavLink>})}</nav><div className="member-sidebar-note"><GraduationCap size={27}/><strong>Bilim sari har kuni</strong><p>Jadval va natijalaringiz bir joyda.</p></div><div className="member-account"><span>{initials(user?.fullName)}</span><div><strong>{user?.fullName}</strong><small>{roleLabel}{user?.group?.name?` · ${user.group.name}`:''}</small></div></div><button className="member-logout" onClick={logout}><LogOut size={16}/> Hisobdan chiqish</button></aside><main className="member-main"><header className="member-top"><div><span className="dot-live"/> {roleLabel} paneli</div><span>{new Intl.DateTimeFormat('uz-UZ',{dateStyle:'long'}).format(new Date())}</span></header><div className="member-content"><Outlet/></div></main></div>
}
