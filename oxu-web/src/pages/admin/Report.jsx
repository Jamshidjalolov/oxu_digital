import { useEffect, useState } from 'react'
import { BookOpen, CalendarDays } from 'lucide-react'
import client from '../../api/client.js'
import WeekNavigator from '../../components/WeekNavigator.jsx'
import PageHeader from '../../components/PageHeader.jsx'
import { DEFAULT_WEEK } from '../../utils/week.js'

export default function Report() {
  const [weekStart, setWeekStart] = useState(DEFAULT_WEEK)
  const [teachers, setTeachers] = useState([])
  const [teacherId, setTeacherId] = useState('')
  const [lessons, setLessons] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    client
      .get('/admin/users', { params: { role: 'teacher' } })
      .then(({ data }) => setTeachers(data))
      .catch(() => setTeachers([]))
  }, [])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const { data } = await client.get('/admin/lessons', {
          params: { weekStart, teacherId: teacherId || undefined },
        })
        setLessons(data || [])
      } catch {
        setLessons([])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [weekStart, teacherId])

  const perTeacher = teachers
    .map((t) => {
      const id = t.id || t._id
      return { teacher: t, count: lessons.filter((l) => (l.teacher?._id || l.teacher?.id) === id).length }
    })
    .filter((r) => !teacherId || r.count > 0 || (r.teacher.id || r.teacher._id) === teacherId)

  const total = lessons.length
  const rooms = new Set(lessons.map((l) => `${l.building}-${l.room}`)).size

  return (
    <div>
      <PageHeader
        eyebrow="Hisobot"
        title="Haftalik hisobot"
        subtitle="O‘qituvchilar yuklamasi, darslar soni va band xonalar."
      />

      <WeekNavigator weekStart={weekStart} onChange={setWeekStart} />

      <div className="stats-grid">
        <div className="stat-card" style={{ '--tone': '#3c5bdb' }}>
          <div className="stat-icon">
            <CalendarDays size={22} />
          </div>
          <div>
            <div className="stat-value">{total}</div>
            <div className="stat-label">Haftalik darslar (tanlangan)</div>
          </div>
        </div>
        <div className="stat-card" style={{ '--tone': '#7b5cff' }}>
          <div className="stat-icon">
            <BookOpen size={22} />
          </div>
          <div>
            <div className="stat-value">{rooms}</div>
            <div className="stat-label">Band xonalar</div>
          </div>
        </div>
      </div>

      <div className="toolbar">
        <select
          className="form-control"
          style={{ maxWidth: 320 }}
          value={teacherId}
          onChange={(e) => setTeacherId(e.target.value)}
        >
          <option value="">Barcha o'qituvchilar</option>
          {teachers.map((t) => (
            <option key={t.id || t._id} value={t.id || t._id}>
              {t.fullName}
            </option>
          ))}
        </select>
      </div>

      <div className="card" style={{ padding: 8 }}>
        {loading ? (
          <p style={{ padding: 24, color: 'var(--muted)' }}>Yuklanmoqda...</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>O'qituvchi</th>
                  <th>Darslar soni</th>
                </tr>
              </thead>
              <tbody>
                {perTeacher.map(({ teacher, count }) => (
                  <tr key={teacher.id || teacher._id}>
                    <td style={{ fontWeight: 700, color: 'var(--ink)' }}>{teacher.fullName}</td>
                    <td>
                      <span className="badge badge-blue">{count} ta dars</span>
                    </td>
                  </tr>
                ))}
                {perTeacher.length === 0 && (
                  <tr>
                    <td colSpan={2} style={{ textAlign: 'center', color: 'var(--muted)', padding: 28 }}>
                      Ma'lumot yo'q
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
