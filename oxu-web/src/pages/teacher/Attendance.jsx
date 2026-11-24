import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import {
  Users,
  CheckCircle2,
  XCircle,
  Check,
  X,
  Search,
  ArrowLeft,
  Save,
  Lock,
  Ban,
} from 'lucide-react'
import client from '../../api/client.js'
import PageHeader from '../../components/PageHeader.jsx'
import { formatDateUZ } from '../../utils/week.js'

export default function Attendance() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [lesson, setLesson] = useState(null)
  const [students, setStudents] = useState([])
  const [marks, setMarks] = useState({}) // studentId -> 'present' | 'absent'
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [locked, setLocked] = useState(false)
  const [past, setPast] = useState(false)
  const [toast, setToast] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!lesson || locked) return
    const update = () => { const now = Date.now(); setPast(!(now >= Date.parse(`${lesson.date}T${lesson.startTime}:00+05:00`) && now < Date.parse(`${lesson.date}T${lesson.endTime}:00+05:00`))) }
    update()
    const timer = setInterval(update, 1000)
    return () => clearInterval(timer)
  }, [lesson, locked])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError('')
      setLesson(null)
      setLocked(false)
      setPast(false)
      try {
        const { data } = await client.get(`/teacher/lessons/${id}/attendance`)
        setLesson(data.lesson)
        setStudents(data.students || [])
        setLocked(Boolean(data.attendanceLocked))
        setPast(data.attendanceAllowed === false)
        const initial = {}
        for (const s of data.students || []) {
          if (s.status === 'present' || s.status === 'absent') initial[s.id || s._id] = s.status
        }
        setMarks(initial)
      } catch (err) {
        setError(err.response?.data?.message || 'Davomatni yuklab bo‘lmadi')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  const stats = useMemo(() => {
    const values = Object.values(marks)
    const present = values.filter((v) => v === 'present').length
    const absent = values.filter((v) => v === 'absent').length
    const total = students.length
    const marked = present + absent
    const percentage = total > 0 ? Math.round((present / total) * 100) : 0
    return { total, present, absent, marked, percentage }
  }, [marks, students])

  const filtered = students.filter((s) =>
    s.fullName.toLowerCase().includes(search.trim().toLowerCase()),
  )

  const toggle = (studentId, status) => {
    if (locked || past) return
    setMarks((m) => {
      if (m[studentId] === status) {
        const next = { ...m }
        delete next[studentId]
        return next
      }
      return { ...m, [studentId]: status }
    })
  }

  const save = async () => {
    if (locked || past) return
    setBusy(true)
    setError('')
    try {
      const records = Object.entries(marks).map(([studentId, status]) => ({ studentId, status }))
      await client.put(`/teacher/lessons/${id}/attendance`, { records })
      setLocked(true)
      setToast('Davomat saqlandi va qulflandi')
      setTimeout(() => {
        navigate('/teacher')
      }, 900)
    } catch (err) {
      if (err.response?.status === 409) setLocked(true)
      setError(err.response?.data?.message || 'Davomatni saqlab bo‘lmadi')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <div className="page-loading">Yuklanmoqda...</div>

  return (
    <div className="panel-container">
      <PageHeader
        eyebrow="Davomat"
        title={lesson?.subject?.name}
        subtitle={
          lesson
            ? `${formatDateUZ(lesson.date)} · ${lesson.pairNumber}-para · ${lesson.startTime}—${lesson.endTime} · ${lesson.room}-xona, ${lesson.building}`
            : undefined
        }
        actions={
          <Link to="/teacher" className="btn btn-outline">
            <ArrowLeft size={16} /> Jadvalga qaytish
          </Link>
        }
      />

      {error && <div className="form-error" role="alert">{error}</div>}

      {locked && (
        <div className="att-lock" role="status">
          <Lock size={18} />
          <div>
            <strong>Davomat olingan</strong>
            Bu dars uchun davomat faqat bir marta olinadi va keyin o‘zgartirilmaydi.
          </div>
        </div>
      )}

      {!locked && past && (
        <div className="att-past" role="status">
          <Ban size={18} />
          <div>
            <strong>Davomat vaqti ochilmagan yoki tugagan</strong>
            Davomat faqat dars kuni {lesson?.startTime}–{lesson?.endTime} oralig‘ida olinadi (Toshkent vaqti).
          </div>
        </div>
      )}

      <div className="att-stats-card">
        <div className="att-stats-row">
          <div className="att-stat">
            <Users size={26} />
            <div>
              <div className="val">{stats.total}</div>
              <div className="lbl">Barchasi</div>
            </div>
          </div>
          <div className="att-stat">
            <CheckCircle2 size={26} />
            <div>
              <div className="val">{stats.present}</div>
              <div className="lbl">Qatnashdi</div>
            </div>
          </div>
          <div className="att-stat">
            <XCircle size={26} />
            <div>
              <div className="val">{stats.absent}</div>
              <div className="lbl">Qatnashmadi</div>
            </div>
          </div>
        </div>
        <div className="att-progress">
          <div className="att-progress-fill" style={{ width: `${stats.percentage}%` }} />
        </div>
        <div className="att-progress-label">
          <span>Belgilangan: {stats.marked}/{stats.total}</span>
          <span>{stats.percentage}% qatnashdi</span>
        </div>
      </div>

      <div className="search-input" style={{ marginBottom: 16 }}>
        <Search size={16} />
        <input
          className="form-control"
          placeholder="Talaba nomi bo'yicha qidiring"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {filtered.map((s) => {
        const sid = s.id || s._id
        const initial = s.fullName.split(' ').filter(Boolean).slice(-1)[0]?.[0] || s.fullName[0]
        return (
          <div className="student-row" key={sid}>
            <div className="student-info">
              <div className="avatar-circle">{initial}</div>
              <div className="student-name">{s.fullName}</div>
            </div>
            <div className="att-actions">
              <button
                className={`att-btn present ${marks[sid] === 'present' ? 'active' : ''}`}
                onClick={() => toggle(sid, 'present')}
                disabled={busy || locked || past}
                aria-pressed={marks[sid] === 'present'}
                aria-label={`${s.fullName}: Qatnashdi`}
                title="Qatnashdi"
              >
                <Check size={20} />
              </button>
              <button
                className={`att-btn absent ${marks[sid] === 'absent' ? 'active' : ''}`}
                onClick={() => toggle(sid, 'absent')}
                disabled={busy || locked || past}
                aria-pressed={marks[sid] === 'absent'}
                aria-label={`${s.fullName}: Qatnashmadi`}
                title="Qatnashmadi"
              >
                <X size={20} />
              </button>
            </div>
          </div>
        )
      })}

      {filtered.length === 0 && <p className="empty-day">Talabalar topilmadi</p>}

      <div className="att-footer">
        {!locked && !past && stats.total > 0 && stats.marked < stats.total && (
          <p className="att-hint">
            Yakunlash uchun barcha talabalarni belgilang ({stats.marked}/{stats.total})
          </p>
        )}
        <button
          className="btn btn-primary"
          onClick={save}
          disabled={busy || !lesson || locked || past || stats.total === 0 || stats.marked !== stats.total}
        >
          {locked ? <Lock size={16} /> : past ? <Ban size={16} /> : <Save size={16} />}{' '}
          {locked ? 'Davomat olingan' : past ? 'Davomat vaqti yopiq' : busy ? 'Saqlanmoqda...' : 'Yakunlash'}
        </button>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
