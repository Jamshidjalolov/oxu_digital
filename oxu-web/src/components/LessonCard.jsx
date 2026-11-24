import { MapPin, ClipboardCheck } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function LessonCard({ lesson, showAttendanceButton = false, rightBadge = null }) {
  const typeBadge =
    lesson.type === 'Ma’ruza' || lesson.type === "Ma'ruza"
      ? 'badge-blue'
      : lesson.type === 'Amaliyot'
        ? 'badge-green'
        : 'badge-yellow'

  return (
    <div className="lesson-card">
      <div className="lesson-time">
        <span className="pair">{lesson.pairNumber}-para</span>
        <span className="hours">
          {lesson.startTime} — {lesson.endTime}
        </span>
      </div>
      <div className="lesson-body">
        <div>
          <div className="lesson-subject">{lesson.subject?.name}</div>
          <div className="lesson-meta">
            {(lesson.groups || []).map((g) => (
              <span key={g._id || g.id || g.name} className="group-chip">
                {g.name}
              </span>
            ))}
            <span className={`badge ${typeBadge}`}>{lesson.type}</span>
          </div>
          <div className="lesson-room">
            <MapPin size={14} />
            {lesson.room}-xona, {lesson.building}
          </div>
        </div>
        {showAttendanceButton && (
          <Link to={`/teacher/lesson/${lesson._id || lesson.id}/attendance`} className="btn btn-success">
            <ClipboardCheck size={16} /> Davomat
          </Link>
        )}
        {rightBadge}
      </div>
    </div>
  )
}
