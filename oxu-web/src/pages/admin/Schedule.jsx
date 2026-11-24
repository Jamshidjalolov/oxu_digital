import { useCallback, useEffect, useState } from 'react'
import { CalendarDays, CheckCircle2, Clock, MapPin, Plus, Repeat, Users, X } from 'lucide-react'
import client from '../../api/client.js'
import { useConfirm } from '../../components/ConfirmProvider.jsx'
import WeekNavigator from '../../components/WeekNavigator.jsx'
import PageHeader from '../../components/PageHeader.jsx'
import { DAY_NAMES, formatDateUZ, toISODate, addDays, DEFAULT_WEEK } from '../../utils/week.js'

const PAIRS = [1, 2, 3, 4, 5, 6, 7, 8, 9]
const PAIR_TIMES = [
  { pairNumber: 1, startTime: '08:30', endTime: '09:50' },
  { pairNumber: 2, startTime: '10:00', endTime: '11:20' },
  { pairNumber: 3, startTime: '11:30', endTime: '12:50' },
  { pairNumber: 4, startTime: '12:50', endTime: '14:10' },
  { pairNumber: 5, startTime: '14:20', endTime: '15:40' },
  { pairNumber: 6, startTime: '15:50', endTime: '17:10' },
  { pairNumber: 7, startTime: '17:20', endTime: '18:40' },
  { pairNumber: 8, startTime: '18:50', endTime: '20:10' },
  { pairNumber: 9, startTime: '20:20', endTime: '21:40' },
]
const LESSON_TYPES = ["Ma'ruza", 'Amaliyot', 'Laboratoriya']

const emptyForm = {
  date: '',
  pairNumber: 1,
  teacherId: '',
  subjectId: '',
  groupIds: [],
  type: 'Amaliyot',
  room: '',
  building: '',
  repeat: true,
}
const emptyOptions = { teachers: [], groups: [], slot: null }

const idOf = (doc) => doc?._id || doc?.id || ''

export default function Schedule() {
  const confirm = useConfirm()
  const [weekStart, setWeekStart] = useState(DEFAULT_WEEK)
  const [workload, setWorkload] = useState({ dates: [], grid: [] })
  const [lessonMap, setLessonMap] = useState({}) // "${teacherId}_${date}_${pair}" -> lesson
  const [loading, setLoading] = useState(true)
  const [subjects, setSubjects] = useState([])
  const [modalOpen, setModalOpen] = useState(false)
  const [options, setOptions] = useState(emptyOptions)
  const [optionsLoading, setOptionsLoading] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [detail, setDetail] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [dayIndex, setDayIndex] = useState(Math.min(5, (new Date().getDay() + 6) % 7))
  const visibleDates = workload.dates.slice(dayIndex, dayIndex + 1)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [wl, lessons] = await Promise.all([
        client.get('/admin/workload', { params: { weekStart } }),
        client.get('/admin/lessons', { params: { weekStart } }),
      ])
      setWorkload(wl.data)
      const map = {}
      for (const l of lessons.data || []) {
        const tid = l.teacher?._id || l.teacher?.id || l.teacherId
        if (tid) map[`${tid}_${l.date}_${l.pairNumber}`] = l
      }
      setLessonMap(map)
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

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(''), 7000)
    return () => clearTimeout(timer)
  }, [notice])

  const minDate = addDays(toISODate(new Date()), 1)
  const dateOptions = (workload.dates.length ? workload.dates : [weekStart])
    .map((date, i) => ({ date, dayName: DAY_NAMES[i] || '' }))
    .filter((option) => option.date >= minDate)

  // ---------- Modal ----------
  const openCreate = async (preset = {}) => {
    setError('')
    setDetail(null)
    setForm({
      ...emptyForm,
      date: preset.date || dateOptions[0]?.date || '',
      pairNumber: preset.pairNumber || 1,
      teacherId: preset.teacherId || '',
    })
    setModalOpen(true)
    if (!subjects.length) {
      try {
        const { data } = await client.get('/admin/subjects')
        setSubjects(data)
      } catch {
        setError("Fanlar ro'yxatini yuklab bo'lmadi")
      }
    }
  }

  const closeModal = () => {
    if (busy) return
    setModalOpen(false)
    setOptions(emptyOptions)
  }

  // Bo'sh o'qituvchi va guruhlar tanlangan sana + para uchun yuklanadi
  useEffect(() => {
    if (!modalOpen || !form.date) {
      setOptions(emptyOptions)
      return
    }
    let alive = true
    setOptionsLoading(true)
    setError('')
    client
      .get('/admin/slot-options', { params: { date: form.date, pairNumber: form.pairNumber } })
      .then(({ data }) => {
        if (!alive) return
        const teachers = data.teachers || []
        const groups = data.groups || []
        setOptions({ teachers, groups, slot: data.slot, rooms: data.rooms || [], busyLessons: data.busyLessons || [], unassignedTeachers: data.unassignedTeachers || [] })
        setForm((f) => {
          const teacherOk = teachers.some((t) => idOf(t) === f.teacherId)
          return {
            ...f,
            teacherId: teacherOk ? f.teacherId : '',
            subjectId: teacherOk ? f.subjectId : '',
            groupIds: f.groupIds.filter((id) => groups.some((g) => idOf(g) === id)),
          }
        })
      })
      .catch((err) => {
        if (alive) setError(err.response?.data?.message || "Bo'sh vaqtlarni yuklab bo'lmadi")
      })
      .finally(() => {
        if (alive) setOptionsLoading(false)
      })
    return () => {
      alive = false
    }
  }, [modalOpen, form.date, form.pairNumber])

  const selectedTeacher = options.teachers.find((t) => idOf(t) === form.teacherId)
  const teacherSubjects = (selectedTeacher?.subjects || []).map((s) => ({ id: idOf(s), name: s.name }))
  const subjectChoices = teacherSubjects

  const pickTeacher = (value) => {
    const teacher = options.teachers.find((t) => idOf(t) === value)
    const allowed = (teacher?.subjects || []).map((s) => idOf(s))
    setForm((f) => ({
      ...f,
      teacherId: value,
      subjectId: allowed.includes(f.subjectId) ? f.subjectId : allowed.length === 1 ? allowed[0] : '',
    }))
  }

  const setType = (value) => {
    setForm((f) => ({
      ...f,
      type: value,
      groupIds: value === "Ma'ruza" ? f.groupIds : f.groupIds.slice(0, 1),
    }))
  }

  const toggleGroup = (id) => {
    setForm((f) => {
      if (f.type !== "Ma'ruza") return { ...f, groupIds: f.groupIds.includes(id) ? [] : [id] }
      return {
        ...f,
        groupIds: f.groupIds.includes(id) ? f.groupIds.filter((x) => x !== id) : [...f.groupIds, id],
      }
    })
  }

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.date) return setError('Sanani tanlang')
    if (form.date < minDate) return setError('Darsni kamida bir kun oldin biriktirish mumkin')
    if (!form.teacherId) return setError("Bo'sh o'qituvchini tanlang")
    if (!form.subjectId) return setError('Fanni tanlang')
    if (!form.groupIds.length) return setError('Guruhni tanlang')
    if (form.type !== "Ma'ruza" && form.groupIds.length > 1) return setError('Amaliyot darsida faqat bitta guruh bo‘ladi')
    const slot = options.slot || PAIR_TIMES[form.pairNumber - 1]
    setBusy(true)
    try {
      const { data } = await client.post('/admin/lessons', {
        teacherId: form.teacherId,
        subjectId: form.subjectId,
        groupIds: form.groupIds,
        date: form.date,
        startTime: slot.startTime,
        endTime: slot.endTime,
        pairNumber: Number(form.pairNumber),
        room: form.room,
        building: form.building,
        type: form.type,
        repeat: form.repeat,
      })
      setModalOpen(false)
      setNotice(
        data.created > 1
          ? `Dars jadvalga qo‘shildi va keyingi ${data.created - 1} haftaga avtomatik takrorlandi.`
          : 'Dars jadvalga qo‘shildi.',
      )
      load()
    } catch (err) {
      setError(err.response?.data?.message || "Dars qo'shishda xatolik")
    } finally {
      setBusy(false)
    }
  }

  const remove = async (lesson, wholeSeries) => {
    if (!await confirm({ title: wholeSeries ? 'Barcha takroriy darslarni o‘chirish?' : 'Darsni o‘chirish?', message: wholeSeries ? 'Haqiqatan ham ushbu seriyadagi barcha darslarni o‘chirmoqchimisiz?' : 'Haqiqatan ham ushbu darsni jadvaldan o‘chirmoqchimisiz?', action: 'Ha, o‘chirish', danger: true })) return
    setBusy(true)
    try {
      await client.delete(`/admin/lessons/${idOf(lesson)}`, { params: wholeSeries ? { series: 1 } : {} })
      setDetail(null)
      setNotice(wholeSeries ? 'Butun takrorlanuvchi seriya o‘chirildi.' : 'Dars o‘chirildi.')
      load()
    } catch (err) {
      setError(err.response?.data?.message || 'O‘chirishda xatolik')
    } finally {
      setBusy(false)
    }
  }

  const today = toISODate(new Date())
  const slotTime = options.slot || PAIR_TIMES[form.pairNumber - 1]

  return (
    <div className="schedule-page">
      <PageHeader
        eyebrow="Rejalashtirish"
        title="Dars jadvali va bandlik"
        subtitle="Bo‘sh katakni bosing — o‘sha parada bo‘sh o‘qituvchilar ro‘yxati chiqadi. Dars keyingi haftalarga avtomatik takrorlanadi."
        actions={
          <button className="btn btn-primary" onClick={() => openCreate()}>
            <Plus size={16} /> Dars qo‘shish
          </button>
        }
      />

      {notice && (
        <div className="form-success" role="status">
          <CheckCircle2 size={16} aria-hidden="true" /> {notice}
        </div>
      )}
      {!modalOpen && !detail && error && <div className="form-error" role="alert">{error}</div>}

      <WeekNavigator weekStart={weekStart} onChange={(week) => { setWeekStart(week); setDayIndex(Math.min(5, (new Date().getDay() + 6) % 7)) }} />

      <div className="grid-legend">
        <div className="legend-item">
          <span className="legend-swatch legend-add">+</span> Bo‘sh — bosing va dars qo‘shing
        </div>
        <div className="legend-item">
          <span className="legend-swatch" style={{ background: '#dc2626', borderColor: '#dc2626' }} /> Band dars
        </div>
        <div className="legend-item">
          <span className="legend-swatch" style={{ background: '#facc15', borderColor: '#facc15' }} /> Bugun darsi bor (F.I.Sh)
        </div>
        <div className="legend-item">
          <span className="legend-swatch legend-repeat">↻</span> Har hafta takrorlanadigan dars
        </div>
      </div>
      <div className="schedule-days" aria-label="Hafta kunlari">
        {workload.dates.map((date, index) => <button key={date} className={index === dayIndex ? 'selected' : ''} aria-pressed={index === dayIndex} onClick={() => setDayIndex(index)}><strong>{DAY_NAMES[index]}</strong><span>{formatDateUZ(date).slice(0, 5)}</span></button>)}
      </div>

      <div className="schedule-table-wrap">
        {loading ? (
          <p style={{ padding: 24, color: 'var(--muted)' }}>Yuklanmoqda...</p>
        ) : (
          <table className="schedule-grid">
            <thead>
              <tr>
                <th className="teacher-col" rowSpan={2}>
                  O‘qituvchi
                </th>
                {visibleDates.map((d) => (
                  <th key={d} colSpan={9}>
                    <strong>{DAY_NAMES[dayIndex]}</strong><span className="schedule-day-date">{formatDateUZ(d)}</span>
                  </th>
                ))}
              </tr>
              <tr>
                {visibleDates.map((d) =>
                  PAIRS.map((p) => (
                    <th key={`${d}_${p}`} className="pair-head">
                      <span>{p}</span><small>{PAIR_TIMES[p - 1].startTime}</small>
                    </th>
                  )),
                )}
              </tr>
            </thead>
            <tbody>
              {workload.grid.map((row) => {
                const busyToday = workload.dates.includes(today) && PAIRS.some((p) => row.cells[`${today}_${p}`])
                return (
                  <tr key={row.teacherId} className={busyToday ? 'teacher-busy' : ''}>
                    <td className="teacher-col"><span className="schedule-avatar">{row.fullName.split(' ').slice(0, 2).map(n => n[0]).join('')}</span><span className="schedule-teacher-name">{row.fullName}<small>O‘qituvchi</small></span></td>
                    {visibleDates.map((d) =>
                      PAIRS.map((p) => {
                        const key = `${d}_${p}`
                        const isBusy = !!row.cells[key]
                        const lesson = lessonMap[`${row.teacherId}_${d}_${p}`]
                        const label = isBusy
                          ? `${lesson?.subject?.name || 'Dars'} · ${(lesson?.groups || []).map((g) => g.name).join(', ')} — batafsil`
                          : `${row.fullName} · ${formatDateUZ(d)} · ${p}-para bo‘sh — dars qo‘shish`
                        return (
                          <td
                            key={key}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.currentTarget.click() } }}
                            aria-label={label}
                            className={`pair-cell ${isBusy ? 'busy' : 'free'}${lesson?.seriesId ? ' has-series' : ''}`}
                            title={label}
                            onClick={() => {
                              if (isBusy && lesson) setDetail(lesson)
                              else if (d >= minDate) openCreate({ date: d, pairNumber: p, teacherId: row.teacherId })
                              else setError('Darsni kamida bir kun oldin biriktirish mumkin')
                            }}
                          >
                            {isBusy ? <span className="slot-content"><strong>{lesson?.subject?.name || 'Band'}</strong><small>{lesson?.room ? `${lesson.room}-xona` : 'Dars'}</small><span className="slot-status">Band</span></span> : <span className="slot-open"><Plus size={15} /><small>Bo‘sh</small></span>}
                          </td>
                        )
                      }),
                    )}
                  </tr>
                )
              })}
              {workload.grid.length === 0 && (
                <tr>
                  <td colSpan={55} style={{ padding: 24, color: 'var(--muted)', textAlign: 'center' }}>
                    O‘qituvchilar topilmadi
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {detail && (
        <div className="modal-overlay" onClick={() => !busy && setDetail(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <span className="eyebrow">{detail.type || 'Dars'}</span>
                <h3>{detail.subject?.name || 'Dars'}</h3>
              </div>
              <button className="modal-close" onClick={() => setDetail(null)} aria-label="Yopish">
                <X size={20} />
              </button>
            </div>
            <div className="lesson-facts">
              <div>
                <Clock size={16} aria-hidden="true" />
                <span>Vaqt</span>
                <strong>{detail.pairNumber}-para · {detail.startTime}–{detail.endTime}</strong>
              </div>
              <div>
                <CalendarDays size={16} aria-hidden="true" />
                <span>Sana</span>
                <strong>{formatDateUZ(detail.date)}</strong>
              </div>
              <div>
                <Users size={16} aria-hidden="true" />
                <span>O‘qituvchi</span>
                <strong>{detail.teacher?.fullName || '—'}</strong>
              </div>
              <div>
                <Users size={16} aria-hidden="true" />
                <span>Guruhlar</span>
                <strong>{(detail.groups || []).map((g) => g.name).join(', ') || '—'}</strong>
              </div>
              <div>
                <MapPin size={16} aria-hidden="true" />
                <span>Xona</span>
                <strong>{[detail.room, detail.building].filter(Boolean).join(', ') || '—'}</strong>
              </div>
              <div>
                <Repeat size={16} aria-hidden="true" />
                <span>Takrorlanish</span>
                <strong>{detail.seriesId ? 'Har hafta' : 'Bir marta'}</strong>
              </div>
            </div>
            {error && <div className="form-error" role="alert">{error}</div>}
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setDetail(null)} disabled={busy}>
                Yopish
              </button>
              {detail.seriesId && (
                <button className="btn btn-danger" onClick={() => remove(detail, true)} disabled={busy}>
                  Butun seriyani o‘chirish
                </button>
              )}
              <button className="btn btn-danger" onClick={() => remove(detail, false)} disabled={busy}>
                {busy ? 'O‘chirilmoqda...' : 'Faqat shu kunni o‘chirish'}
              </button>
            </div>
          </div>
        </div>
      )}

      {modalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <span className="eyebrow">Yangi dars</span>
                <h3>Dars qo‘shish</h3>
              </div>
              <button className="modal-close" onClick={closeModal} aria-label="Yopish" disabled={busy}>
                <X size={20} />
              </button>
            </div>

            {error && <div className="form-error">{error}</div>}

            <form onSubmit={submit}>
              <div className="form-row">
                <div className="form-group">
                  <label>Sana</label>
                  {dateOptions.length === 0 ? (
                    <p className="slot-hint">Bu haftada bo‘sh kun yo‘q — keyingi haftaga o‘ting.</p>
                  ) : (
                    <select className="form-control" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} required>
                      {dateOptions.map((option) => (
                        <option key={option.date} value={option.date}>
                          {option.dayName} {formatDateUZ(option.date)}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div className="form-group">
                  <label>Para</label>
                  <select
                    className="form-control"
                    value={form.pairNumber}
                    onChange={(e) => setForm((f) => ({ ...f, pairNumber: Number(e.target.value) }))}
                  >
                    {PAIR_TIMES.map((slot) => (
                      <option key={slot.pairNumber} value={slot.pairNumber}>
                        {slot.pairNumber}-para · {slot.startTime}–{slot.endTime}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <p className="slot-state" role="status">
                {optionsLoading
                  ? 'Bo‘sh o‘qituvchilar yuklanmoqda...'
                  : options.teachers.length
                    ? `${slotTime.startTime}–${slotTime.endTime} · ${options.teachers.length} ta o‘qituvchi bo‘sh`
                    : options.unassignedTeachers?.length ? 'Bo‘sh o‘qituvchilar bor, lekin ularga hali fan biriktirilmagan.' : options.busyLessons?.length ? 'Bu parada dars biriktirish uchun bo‘sh o‘qituvchi yo‘q.' : 'Dars biriktirishga tayyor o‘qituvchi topilmadi.'}
              </p>

              {!optionsLoading && <div className="slot-availability" aria-live="polite">
                <h4>{form.pairNumber}-para · {slotTime.startTime}–{slotTime.endTime}</h4>
                <p>{options.busyLessons?.length || 0} ta band dars · {options.teachers.length} ta fan biriktirilgan bo‘sh o‘qituvchi</p>
                {!!options.busyLessons?.length && <div className="slot-bookings">{options.busyLessons.map(lesson => <article key={idOf(lesson)}><strong>{lesson.teacher?.fullName || 'O‘qituvchi'}</strong><span>{lesson.subject?.name} · {lesson.startTime}–{lesson.endTime}</span><span><MapPin size={12} /> {lesson.building || 'Bino ko‘rsatilmagan'} · {lesson.room ? `${lesson.room}-xona` : 'Xona ko‘rsatilmagan'}</span><small>{(lesson.groups || []).map(g => g.name).join(', ')}</small></article>)}</div>}
                {!options.busyLessons?.length && <p className="slot-clear">Bu sana va parada band dars yo‘q.</p>}
                {!!options.unassignedTeachers?.length && <div className="slot-unassigned"><strong>Fan biriktirish kerak:</strong><p>{options.unassignedTeachers.map(t => t.fullName).join('; ')}</p><a href="/admin/users">Foydalanuvchilarda fan biriktirish →</a></div>}
              </div>}

              <div className="form-group">
                <label>O‘qituvchi <span className="req">*</span></label>
                <select
                  className="form-control"
                  value={form.teacherId}
                  onChange={(e) => pickTeacher(e.target.value)}
                  disabled={optionsLoading || options.teachers.length === 0}
                  required
                >
                  <option value="">{optionsLoading ? 'Yuklanmoqda...' : 'Bo‘sh o‘qituvchini tanlang'}</option>
                  {options.teachers.map((t) => (
                    <option key={idOf(t)} value={idOf(t)}>
                      {t.fullName}
                      {t.subjects?.length ? ` — ${t.subjects.map((s) => s.name).join(', ')}` : ''}
                    </option>
                  ))}
                </select>
                <p className="field-hint">Faqat shu parada darsi yo‘q o‘qituvchilar ko‘rsatiladi.</p>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Fan <span className="req">*</span></label>
                  <select
                    className="form-control"
                    value={form.subjectId}
                    onChange={(e) => setForm((f) => ({ ...f, subjectId: e.target.value }))}
                    required
                    disabled={!form.teacherId}
                  >
                    <option value="">{form.teacherId ? 'Fanni tanlang' : 'Avval o‘qituvchini tanlang'}</option>
                    {subjectChoices.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Dars turi</label>
                  <select className="form-control" value={form.type} onChange={(e) => setType(e.target.value)}>
                    {LESSON_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>
                  Guruhlar
                  <span className={`badge ${form.type === "Ma'ruza" ? 'badge-blue' : 'badge-green'}`}>
                    {form.type === "Ma'ruza" ? 'Bir nechta' : 'Bitta'}
                  </span>
                </label>
                <div className="chip-grid">
                  {options.groups.map((g) => {
                    const checked = form.groupIds.includes(idOf(g))
                    return (
                      <label key={idOf(g)} className={`chip-check${checked ? ' active' : ''}`}>
                        <input type="checkbox" checked={checked} onChange={() => toggleGroup(idOf(g))} />
                        {g.name}
                      </label>
                    )
                  })}
                </div>
                {options.groups.length === 0 && !optionsLoading && (
                  <p className="slot-hint">Bu parada barcha guruhlar band.</p>
                )}
                <p className="field-hint">
                  {form.type === "Ma'ruza"
                    ? 'Ma’ruzada bir parada bir nechta guruhni tanlash mumkin.'
                    : 'Amaliyot va laboratoriyada bir parada faqat bitta guruh bo‘ladi.'}
                </p>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Xona</label>
                  <input required className="form-control" placeholder="204" value={form.room} onChange={(e) => setForm((f) => ({ ...f, room: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Bino</label>
                  <input required className="form-control" placeholder="Kampus 1 (1-bino)" value={form.building} onChange={(e) => setForm((f) => ({ ...f, building: e.target.value }))} />
                </div>
              </div>

              <div className="slot-availability"><h4>Xonalar · {form.pairNumber}-para</h4><p>Faqat ro‘yxatga kiritilgan xonalar ko‘rsatiladi.</p><div className="chip-grid">{(options.rooms || []).map(room => <button type="button" key={room._id} disabled={room.busy || optionsLoading} className={`btn btn-sm ${room.busy ? 'btn-danger' : 'btn-outline'}`} onClick={() => setForm(f => ({ ...f, room: room.name, building: room.building }))}>{room.building} · {room.name} — {room.busy ? 'Band' : 'Bo‘sh'}</button>)}</div>{!options.rooms?.length && <p>Xona ro‘yxati bo‘sh. “Guruhlar va fanlar” bo‘limida xonalarni kiriting.</p>}</div>
              <label className="checkbox-row repeat-row">
                <input type="checkbox" checked={form.repeat} onChange={(e) => setForm((f) => ({ ...f, repeat: e.target.checked }))} />
                <span>
                  <strong>Har hafta takrorlansin</strong> — keyingi 16 hafta jadvaliga avtomatik yoziladi
                </span>
              </label>

              <button
                className="btn btn-primary btn-block"
                disabled={busy || optionsLoading || !form.date || !form.teacherId || !form.subjectId || form.groupIds.length === 0}
              >
                {busy ? 'Saqlanmoqda...' : 'Darsni saqlash'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
