import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Users,
  GraduationCap,
  Layers,
  CalendarDays,
  ArrowRight,
  UserPlus,
  Grid3x3,
  BarChart3,
  RefreshCw,
  MapPin,
  Clock3,
} from 'lucide-react'
import client from '../../api/client.js'
import {
  toISODate,
  getMonday,
  weekDates,
  DAY_NAMES,
  formatDateUZ,
} from '../../utils/week.js'
import { useAuth } from '../../context/AuthContext.jsx'

const quickLinks = [
  {
    to: '/admin/users',
    icon: UserPlus,
    title: 'Foydalanuvchilar',
    note: 'Hisoblar va kirish huquqlari',
    color: 'blue',
  },
  {
    to: '/admin/schedule',
    icon: Grid3x3,
    title: 'Darsni rejalashtirish',
    note: 'Guruh, o‘qituvchi va auditoriya',
    color: 'green',
  },
  {
    to: '/admin/report',
    icon: BarChart3,
    title: 'Hisobotlarni ko‘rish',
    note: 'Haftalik yuklama tahlili',
    color: 'orange',
  },
]

export default function Dashboard() {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [revision, setRevision] = useState(0)
  useEffect(()=>{const update=()=>setRevision(n=>n+1);window.addEventListener('oxu-refresh',update);return()=>window.removeEventListener('oxu-refresh',update);},[])
  const today = toISODate(new Date())
  const weekStart = toISODate(getMonday(null))

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    Promise.all([
      client.get('/admin/users', {
        params: { role: 'teacher' },
        signal: controller.signal,
      }),
      client.get('/admin/users', {
        params: { role: 'student' },
        signal: controller.signal,
      }),
      client.get('/admin/groups', { signal: controller.signal }),
      client.get('/admin/lessons', {
        params: { weekStart },
        signal: controller.signal,
      }),
    ])
      .then(([teachers, students, groups, lessons]) => {
        if (!controller.signal.aborted)
          setData({
            teachers: teachers.data.length,
            students: students.data.length,
            groups: groups.data.length,
            lessons: lessons.data,
          })
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError(
            'Ma’lumotlarni yuklab bo‘lmadi. Server ulanishini tekshiring va qayta urinib ko‘ring.',
          )
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [revision, weekStart])

  const todayLessons = (data?.lessons || [])
    .filter((l) => l.date === today)
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
  const days = weekDates(weekStart).map((date, i) => ({
    date,
    label: DAY_NAMES[i],
    count: (data?.lessons || []).filter((l) => l.date === date).length,
  }))
  const max = Math.max(1, ...days.map((d) => d.count))
  const hour = new Date().getHours()
  const firstName = user?.fullName?.split(' ')[0] || 'Admin'
  const cards = [
    {
      icon: Users,
      label: 'O‘qituvchilar',
      value: data?.teachers,
      tone: '#3366ef',
      note: 'Ta’lim beruvchi mutaxassislar',
    },
    {
      icon: GraduationCap,
      label: 'Talabalar',
      value: data?.students,
      tone: '#159b78',
      note: 'Platformadagi talabalar',
    },
    {
      icon: Layers,
      label: 'O‘quv guruhlari',
      value: data?.groups,
      tone: '#8464cf',
      note: 'Barcha ta’lim yo‘nalishlari',
    },
    {
      icon: CalendarDays,
      label: 'Bugungi darslar',
      value: data ? todayLessons.length : null,
      tone: '#d78636',
      note: formatDateUZ(today),
    },
  ]

  return (
    <div className="dashboard">
      <div className="dashboard-heading">
        <div>
          <span className="eyebrow">UNIVERSITET BOSHQARUVI</span>
          <h1>Umumiy ko‘rinish</h1>
          <p>O‘quv jarayonining muhim ko‘rsatkichlari, bir joyda.</p>
        </div>
        <button
          className="btn btn-outline"
          onClick={() => setRevision((r) => r + 1)}
          disabled={loading}
        >
          <RefreshCw size={15} className={loading ? 'refresh-spinning' : ''} />{' '}
          Yangilash
        </button>
      </div>
      <section className="hero dashboard-welcome">
        <div>
          <span className="hero-eyebrow">
            <span className="dot-live" /> OXU DIGITAL
          </span>
          <h2>
            {hour < 12
              ? 'Xayrli tong'
              : hour < 18
                ? 'Xayrli kun'
                : 'Xayrli kech'}
            , {firstName}!
          </h2>
          <p>
            Yangi kun — yangi imkoniyatlar. O‘quv jarayonini
            <br className="desktop-break" /> birgalikda samarali boshqaramiz.
          </p>
          <div className="hero-actions">
            <Link className="btn btn-primary" to="/admin/schedule">
              Dars jadvaliga o‘tish <ArrowRight size={16} />
            </Link>
          </div>
        </div>
        <div className="welcome-art" aria-hidden="true">
          <div className="art-orbit" />
          <div className="art-window">
            <span className="art-window-head">
              <i />
              <i />
              <i />
            </span>
            <CalendarDays size={32} />
            <div className="art-calendar">
              {Array.from({ length: 14 }, (_, i) => (
                <span key={i} className={i === 10 ? 'selected' : ''}>
                  {i + 1}
                </span>
              ))}
            </div>
          </div>
          <span className="art-float">
            <GraduationCap size={25} />
          </span>
        </div>
      </section>
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
      <div className="stats-grid" aria-busy={loading}>
        {cards.map(({ icon: Icon, label, value, tone, note }) => (
          <div className="stat-card" key={label} style={{ '--tone': tone }}>
            <div className="stat-top">
              <span className="stat-label">{label}</span>
              <div className="stat-icon">
                <Icon size={20} />
              </div>
            </div>
            <div className="stat-value">{loading ? '…' : (value ?? '—')}</div>
            <span className="stat-note">{note}</span>
          </div>
        ))}
      </div>
      <div className="dashboard-columns">
        <section className="card agenda-card">
          <div className="dashboard-section-head">
            <div>
              <h3>Bugungi darslar</h3>
              <p>
                {formatDateUZ(today)} ·{' '}
                {data ? `${todayLessons.length} ta dars` : 'Yuklanmoqda'}
              </p>
            </div>
            <Link to="/admin/schedule" className="text-link">
              Barchasi <ArrowRight size={14} />
            </Link>
          </div>
          {loading ? (
            <div className="page-loading">Jadval yuklanmoqda...</div>
          ) : error ? (
            <div className="dashboard-empty">
              Jadval ma’lumotlari mavjud emas.
            </div>
          ) : todayLessons.length ? (
            <div className="agenda-list">
              {todayLessons.slice(0, 5).map((l) => (
                <div className="agenda-row" key={l._id}>
                  <div className="agenda-time">
                    <strong>{l.startTime}</strong>
                    <span>{l.endTime}</span>
                  </div>
                  <div className="agenda-info">
                    <strong>{l.subject?.name || 'Dars'}</strong>
                    <span>{l.teacher?.fullName}</span>
                    <div className="agenda-meta">
                      <span>
                        <Users size={12} />{' '}
                        {(l.groups || []).map((g) => g.name).join(', ')}
                      </span>
                      <span>
                        <MapPin size={12} /> {l.room}-xona
                      </span>
                    </div>
                  </div>
                  <span
                    className={`badge ${l.type === 'Amaliyot' ? 'badge-green' : 'badge-blue'}`}
                  >
                    {l.type}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="dashboard-empty">
              <CalendarDays size={30} />
              <strong>Bugun uchun dars belgilanmagan</strong>
              <span>
                Jadval bo‘limida yangi dars rejalashtirishingiz mumkin.
              </span>
              <Link to="/admin/schedule" className="text-link">
                Jadvalni ochish <ArrowRight size={14} />
              </Link>
            </div>
          )}
        </section>
        <section className="card weekly-card">
          <div className="dashboard-section-head">
            <div>
              <h3>Haftalik faollik</h3>
              <p>Rejalashtirilgan darslar soni</p>
            </div>
            <Clock3 size={18} />
          </div>
          <div className="weekly-total">
            {loading ? '…' : (data?.lessons.length ?? '—')}
            <span>ta dars / hafta</span>
          </div>
          <div
            className="week-chart"
            role="img"
            aria-label={days
              .map((d) => `${d.label}: ${d.count} ta dars`)
              .join('; ')}
          >
            {days.map((d) => (
              <div
                className={`chart-column ${d.date === today ? 'is-today' : ''}`}
                key={d.date}
              >
                <span>{loading ? '—' : d.count}</span>
                <div className="chart-track">
                  <div
                    style={{
                      height: `${loading ? 0 : (d.count / max) * 100}%`,
                    }}
                  />
                </div>
                <span>{d.label.slice(0, 3)}</span>
              </div>
            ))}
          </div>
          <div className="chart-caption">
            <span className="chart-dot" /> Joriy hafta{' '}
            <span>{formatDateUZ(weekStart)}</span>
          </div>
        </section>
      </div>
      <h3 className="section-title">Tezkor amallar</h3>
      <div className="quick-grid">
        {quickLinks.map(({ to, icon: Icon, title, note, color }) => (
          <Link className={`quick-card quick-${color}`} to={to} key={to}>
            <span className="quick-icon">
              <Icon size={21} />
            </span>
            <div>
              <strong>{title}</strong>
              <span>{note}</span>
            </div>
            <ArrowRight size={17} className="quick-arrow" />
          </Link>
        ))}
      </div>
    </div>
  )
}
