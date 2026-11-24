import { useEffect, useState } from 'react'
import { Plus, Trash2, Layers, BookOpen, GraduationCap, Sparkles } from 'lucide-react'
import client from '../../api/client.js'
import { useConfirm } from '../../components/ConfirmProvider.jsx'
import PageHeader from '../../components/PageHeader.jsx'
import RoomCatalog from '../../components/RoomCatalog.jsx'
import {Link} from 'react-router-dom'

export default function GroupsSubjects() {
  const confirm = useConfirm()
  const [groups, setGroups] = useState([])
  const [subjects, setSubjects] = useState([])
  const [groupName, setGroupName] = useState('')
  const [course, setCourse] = useState('')
  const [catalog, setCatalog] = useState({ departments: [], directions: [] })
  const [groupForm, setGroupForm] = useState({ faculty:'', department:'', direction:'', directionSourceId:'', educationType:'Kunduzgi', admissionYear:new Date().getFullYear(), semester:1, capacity:30 })
  const [subjectName, setSubjectName] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const [g, s, c] = await Promise.all([client.get('/admin/groups'), client.get('/admin/subjects'), client.get('/admin/academic-catalog')])
      setGroups(g.data)
      setSubjects(s.data)
      setCatalog(c.data || { departments: [], directions: [] })
      setError('')
    } catch (err) { setError(err.response?.data?.message || 'Yuklashda xatolik') }
    finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const addGroup = async (e) => {
    e.preventDefault()
    if (!groupName.trim()) return
    try { await client.post('/admin/groups', { name: groupName.trim(), course: Number(course), ...groupForm, directionSourceId: groupForm.directionSourceId }) }
    catch (err) { setError(err.response?.data?.message || 'Qo‘shishda xatolik'); return }
    setGroupName('')
    setCourse('')
    setGroupForm({ faculty:'', department:'', direction:'', directionSourceId:'', educationType:'Kunduzgi', admissionYear:new Date().getFullYear(), semester:1, capacity:30 })
    load()
  }

  const addSubject = async (e) => {
    e.preventDefault()
    if (!subjectName.trim()) return
    try { await client.post('/admin/subjects', { name: subjectName.trim() }) }
    catch (err) { setError(err.response?.data?.message || 'Qo‘shishda xatolik'); return }
    setSubjectName('')
    load()
  }

  const removeGroup = async (g) => {
    if (!await confirm({ title: 'Guruhni o‘chirish?', message: `Haqiqatan ham ${g.name} guruhini o‘chirmoqchimisiz?`, action: 'Ha, o‘chirish', danger: true })) return
    try { await client.delete(`/admin/groups/${g.id || g._id}`) }
    catch (err) { setError(err.response?.data?.message || 'O‘chirishda xatolik'); return }
    load()
  }

  const removeSubject = async (s) => {
    if (!await confirm({ title: 'Fanni o‘chirish?', message: `Haqiqatan ham ${s.name} fanini o‘chirmoqchimisiz?`, action: 'Ha, o‘chirish', danger: true })) return
    try { await client.delete(`/admin/subjects/${s.id || s._id}`) }
    catch (err) { setError(err.response?.data?.message || 'O‘chirishda xatolik'); return }
    load()
  }

  return (
    <div>
      <PageHeader
        eyebrow="Boshqaruv"
        title="Guruhlar va fanlar"
        subtitle="Guruhlar hamda o‘quv fanlarini boshqaring — jadval shu ro‘yxatlarga tayanadi."
      />
      {error && <div className="form-error" role="alert">{error}</div>}
      <RoomCatalog />
      <Link className="btn btn-primary" style={{marginBottom:20}} to="/admin/subjects/new"><Plus size={16}/> Batafsil fan qo‘shish</Link>

      {loading ? (
        <div className="page-loading">Yuklanmoqda...</div>
      ) : (
        <div className="two-col">
          <div className="card">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Layers size={18} color="#2563eb" /> Guruhlar
            </h3>
            <form className="group-create-form" onSubmit={addGroup}>
              <div className="group-form-grid">
              <select aria-label="Fakultet" className="form-control" value={groupForm.faculty} onChange={e => setGroupForm({...groupForm,faculty:e.target.value})} required><option value="">Fakultetni tanlang</option><option>Axborot texnologiyalari fakulteti</option><option>Iqtisodiyot fakulteti</option><option>Tibbiyot fakulteti</option><option>Pedagogika fakulteti</option></select>
              <select aria-label="Kafedra" className="form-control" value={groupForm.department} onChange={e => setGroupForm({...groupForm,department:e.target.value})} required><option value="">Kafedrani tanlang</option>{catalog.departments.map(d=><option key={d.name}>{d.name}</option>)}</select>
              <select aria-label="Yo'nalish" className="form-control" value={groupForm.directionSourceId} onChange={e => {const d=catalog.directions.find(x=>x.sourceId===e.target.value);setGroupForm({...groupForm,directionSourceId:e.target.value,direction:d?.name||''})}} required><option value="">Yo'nalishni tanlang</option>{catalog.directions.map(d=><option key={d.sourceId} value={d.sourceId}>{d.name} · {d.category}</option>)}</select>
              <select aria-label="Ta'lim shakli" className="form-control" value={groupForm.educationType} onChange={e=>setGroupForm({...groupForm,educationType:e.target.value})}><option>Kunduzgi</option><option>Kechki</option><option>Masofaviy</option><option>Magistratura</option></select>
              <input className="form-control" placeholder="Guruh nomi (avtomatik yoki kiriting)" value={groupName} onChange={e => setGroupName(e.target.value)} required />
              <select aria-label="Kurs" className="form-control" value={course} onChange={e => setCourse(e.target.value)} required><option value="">Kursni tanlang</option>{[1,2,3,4,5,6].map(n => <option value={n} key={n}>{n}-kurs</option>)}</select>
              <input className="form-control" type="number" min="2020" max="2100" placeholder="Qabul yili" value={groupForm.admissionYear} onChange={e=>setGroupForm({...groupForm,admissionYear:e.target.value})}/>
              <input className="form-control" type="number" min="1" max="200" placeholder="Talaba limiti" value={groupForm.capacity} onChange={e=>setGroupForm({...groupForm,capacity:e.target.value})}/>
              </div>
              <div className="group-auto-note"><Sparkles size={15}/> Yo'nalish katalogdan tanlandi — guruh kodi va kurs ma'lumotlari jadvalda avtomatik ishlatiladi.</div>
              <button className="btn btn-primary">
                <Plus size={16} /> Qo'shish
              </button>
            </form>
            {groups.map((g) => (
              <div className="list-row" key={g.id || g._id}>
                <div>
                  <div className="name">{g.name} {g.course && <span className="badge badge-blue">{g.course}-kurs</span>}</div>
                  <div className="count">{g.studentCount || 0} / {g.capacity || 30} ta talaba · {g.educationType || 'Kunduzgi'}{g.department ? ` · ${g.department}` : ''}</div>
                  {g.direction && <div className="count">{g.direction} · {g.admissionYear || '—'} · {g.semester || 1}-semestr</div>}
                </div>
                <button className="btn-icon" onClick={() => removeGroup(g)}>
                  <Trash2 size={15} color="#dc2626" />
                </button>
              </div>
            ))}
            {groups.length === 0 && <p className="empty-day">Guruhlar yo'q</p>}
          </div>

          <div className="card">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <BookOpen size={18} color="#2563eb" /> Fanlar
            </h3>
            <form className="add-row" onSubmit={addSubject}>
              <input
                className="form-control"
                placeholder="Yangi fan nomi"
                value={subjectName}
                onChange={(e) => setSubjectName(e.target.value)}
              />
              <button className="btn btn-primary">
                <Plus size={16} /> Qo'shish
              </button>
            </form>
            {subjects.map((s) => (
              <div className="list-row" key={s.id || s._id}>
                <div><div className="name">{s.name}</div>{s.code&&<small style={{color:'#8496b4'}}>{s.code} · {s.course}-kurs · {s.semester}-semestr · {s.credits} kredit</small>}{s.syllabus?.data&&<div><a href={s.syllabus.data} download={s.syllabus.name} className="text-link">PDF sillabusni yuklab olish</a></div>}</div>
                <button className="btn-icon" onClick={() => removeSubject(s)}>
                  <Trash2 size={15} color="#dc2626" />
                </button>
              </div>
            ))}
            {subjects.length === 0 && <p className="empty-day">Fanlar yo'q</p>}
          </div>
        </div>
      )}
    </div>
  )
}
