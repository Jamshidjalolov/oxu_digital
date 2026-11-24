import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, XCircle, Clock } from 'lucide-react'
import client from '../../api/client.js'
import DayPicker from '../../components/DayPicker.jsx'
import WeekNavigator from '../../components/WeekNavigator.jsx'
import LessonCard from '../../components/LessonCard.jsx'
import PageHeader from '../../components/PageHeader.jsx'
import { DAY_NAMES, formatDateUZ, DEFAULT_WEEK, getMonday, toISODate } from '../../utils/week.js'

function StatusBadge({ myStatus }) {
  if (myStatus === 'present')
    return (
      <span className="badge badge-green">
        <CheckCircle2 size={13} /> Qatnashdi
      </span>
    )
  if (myStatus === 'absent')
    return (
      <span className="badge badge-red">
        <XCircle size={13} /> Qatnashmadi
      </span>
    )
  return (
    <span className="badge badge-gray">
      <Clock size={13} /> Kutilmoqda
    </span>
  )
}

export default function StudentSchedule() {
  const [weekStart, setWeekStart] = useState(() => toISODate(getMonday(null)))
  const [data, setData] = useState({ dates: [], byDay: {}, total: 0 })
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(Math.min(5, (new Date().getDay() + 6) % 7))

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await client.get('/student/schedule', { params: { weekStart } })
      setData(data)
    } finally {
      setLoading(false)
    }
  }, [weekStart])

  useEffect(() => {
    load()
    const refresh = () => load()
    window.addEventListener('oxu-refresh',refresh)
    return () => window.removeEventListener('oxu-refresh',refresh)
  }, [load])

  return (
    <div>
      <PageHeader
        eyebrow="Talaba paneli"
        title="Haftalik jadval"
        subtitle={`Bu haftada jami ${data.total || 0} ta dars. Har bir darsda davomat holati ko‘rsatiladi.`}
      />

      <WeekNavigator weekStart={weekStart} onChange={setWeekStart} />
      <DayPicker dates={data.dates} byDay={data.byDay} selected={selected} onChange={setSelected} />

      {loading ? (
        <p style={{ color: '#6b7280' }}>Yuklanmoqda...</p>
      ) : (
        data.dates.map((date, i) => (i === selected &&
          <section className="day-section" key={date}>
            <h3 className="day-section-title">
              {DAY_NAMES[i]} <span className="date">{formatDateUZ(date)}</span>
            </h3>
            {(data.byDay[date] || []).map((lesson) => (
              <LessonCard
                key={lesson._id || lesson.id}
                lesson={lesson}
                rightBadge={<StatusBadge myStatus={lesson.myStatus} />}
              />
            ))}
            {(data.byDay[date] || []).length === 0 && <p className="empty-day">Dars yo'q</p>}
          </section>
        ))
      )}
    </div>
  )
}
