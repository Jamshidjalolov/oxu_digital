import { useCallback, useEffect, useState } from 'react'
import client from '../../api/client.js'
import DayPicker from '../../components/DayPicker.jsx'
import WeekNavigator from '../../components/WeekNavigator.jsx'
import LessonCard from '../../components/LessonCard.jsx'
import PageHeader from '../../components/PageHeader.jsx'
import { DAY_NAMES, formatDateUZ, DEFAULT_WEEK, getMonday, toISODate } from '../../utils/week.js'

const SLOTS = [['08:30','09:50'],['10:00','11:20'],['11:30','12:50'],['12:50','14:10'],['14:20','15:40'],['15:50','17:10'],['17:20','18:40'],['18:50','20:10'],['20:20','21:40']]

export default function TeacherSchedule() {
  const [weekStart, setWeekStart] = useState(() => toISODate(getMonday(null)))
  const [data, setData] = useState({ dates: [], byDay: {}, total: 0 })
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(Math.min(5, (new Date().getDay() + 6) % 7))

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await client.get('/teacher/schedule', { params: { weekStart } })
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
        eyebrow="O‘qituvchi paneli"
        title="Haftalik jadval"
        subtitle={`Bu haftada jami ${data.total || 0} ta dars. Davomatni har bir dars kartasidan olishingiz mumkin.`}
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
            <div className="teacher-availability">{SLOTS.map(([start, end], index) => {
              const lesson = (data.byDay[date] || []).find(l => l.pairNumber === index + 1 || (l.startTime < end && l.endTime > start))
              return <div key={start} className={`teacher-slot ${lesson ? 'occupied' : ''}`}><strong>{index + 1}-para</strong><span>{start}–{end}</span><b>{lesson ? 'Band' : 'Bo‘sh'}</b>{lesson && <small>{lesson.subject?.name}<br />{lesson.room ? `${lesson.room}-xona` : ''} {lesson.building}</small>}</div>
            })}</div>
            {(data.byDay[date] || []).map((lesson) => (
              <LessonCard key={lesson._id || lesson.id} lesson={lesson} showAttendanceButton />
            ))}
            {(data.byDay[date] || []).length === 0 && <p className="empty-day">Dars yo'q</p>}
          </section>
        ))
      )}
    </div>
  )
}
