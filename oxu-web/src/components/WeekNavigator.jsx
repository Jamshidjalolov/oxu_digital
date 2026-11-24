import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import { addDays, getMonday, toISODate, formatDateUZ, weekDates } from '../utils/week.js'

export default function WeekNavigator({ weekStart, onChange }) {
  const dates = weekDates(weekStart)
  const isCurrent = toISODate(getMonday(null)) === toISODate(getMonday(weekStart))

  return (
    <div className="week-nav">
      <button className="btn btn-outline" onClick={() => onChange(addDays(weekStart, -7))}>
        <ChevronLeft size={16} /> Oldingi
      </button>
      <div className="week-nav-label">
        <CalendarDays size={18} />
        <div>
          <strong>
            {formatDateUZ(dates[0])} — {formatDateUZ(dates[5])}
          </strong>
          <span>Hafta boshlanishi: {weekStart}</span>
        </div>
      </div>
      <button className="btn btn-outline" disabled={isCurrent} onClick={() => onChange(toISODate(getMonday(null)))}>
        Joriy hafta
      </button>
      <button className="btn btn-outline" onClick={() => onChange(addDays(weekStart, 7))}>
        Keyingi <ChevronRight size={16} />
      </button>
    </div>
  )
}
