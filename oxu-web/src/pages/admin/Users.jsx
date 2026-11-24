import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, X, Eye, EyeOff, KeyRound, Search, BookOpen } from 'lucide-react'
import client from '../../api/client.js'
import { useConfirm } from '../../components/ConfirmProvider.jsx'
import PageHeader from '../../components/PageHeader.jsx'

const roleLabels = { admin: 'Administrator', teacher: "O'qituvchi", student: 'Talaba', department_head: 'Kafedra mudiri' }
const emptyForm = {
  fullName: '',
  phone: '',
  password: '',
  role: 'student',
  groupId: '',
  subjectIds: [],
  departmentId: '',
  approved: true,
}

export default function Users() {
  const confirm = useConfirm()
  const [users, setUsers] = useState([])
  const [groups, setGroups] = useState([])
  const [subjects, setSubjects] = useState([])
  const [departments, setDepartments] = useState([])
  const [roleFilter, setRoleFilter] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [resetOnly, setResetOnly] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [credentials, setCredentials] = useState(null)

  const closeModal = () => {
    if (busy) return
    setModalOpen(false)
    setEditing(null)
    setForm(emptyForm)
    setCredentials(null)
    setShowPassword(false)
    setResetOnly(false)
  }

  useEffect(() => {
    if (!modalOpen && !credentials) return
    const onKey = (event) => { if (event.key === 'Escape') closeModal() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [modalOpen, credentials, busy])

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await client.get('/admin/users', {
        params: roleFilter ? { role: roleFilter } : {},
      })
      setUsers(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleFilter])

  useEffect(() => {
    client
      .get('/admin/groups')
      .then(({ data }) => setGroups(data))
      .catch(() => setGroups([]))
    client
      .get('/admin/subjects')
      .then(({ data }) => setSubjects(data))
      .catch(() => setSubjects([]))
    client.get('/admin/departments').then(({ data }) => setDepartments(data)).catch(() => setDepartments([]))
  }, [])

  const openAdd = () => {
    setEditing(null)
    setForm(emptyForm)
    setError('')
    setResetOnly(false)
    setShowPassword(false)
    setCredentials(null)
    setModalOpen(true)
  }

  const openEdit = async (u, passwordOnly = false) => {
    if (!await confirm({ title: passwordOnly ? 'Kirish ma’lumotlarini tahrirlash?' : 'Hisobni tahrirlash?', message: `Haqiqatan ham ${u.fullName} hisobini tahrirlamoqchimisiz?`, action: 'Ha, tahrirlash' })) return
    setResetOnly(passwordOnly)
    setShowPassword(false)
    setCredentials(null)
    setEditing(u)
    setForm({
      fullName: u.fullName,
      phone: u.phone,
      password: '',
      role: u.role,
      groupId: u.group?.id || u.group?._id || '',
      subjectIds: (u.subjects || []).map((s) => s.id || s._id),
      departmentId: u.department?.id || u.department?._id || '',
      approved: u.approved !== false,
    })
    setError('')
    setModalOpen(true)
  }

  const set = (key) => (e) =>
    setForm((f) => ({ ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  const toggleSubject = (id) =>
    setForm((f) => ({
      ...f,
      subjectIds: f.subjectIds.includes(id)
        ? f.subjectIds.filter((item) => item !== id)
        : [...f.subjectIds, id],
    }))

  const submit = async (e) => {
    e.preventDefault()
    if (busy) return
    setError('')
    if (!resetOnly && ['teacher', 'department_head'].includes(form.role) && form.subjectIds.length === 0) {
      setError('O‘qituvchi uchun kamida bitta fan tanlang')
      return
    }
    setBusy(true)
    try {
      const payload = resetOnly ? {} : {
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
        role: form.role,
        approved: form.approved,
      }
      if (!resetOnly && form.role === 'student' && form.groupId) payload.groupId = form.groupId
      if (!resetOnly && ['teacher', 'department_head'].includes(form.role)) { payload.subjectIds = form.subjectIds; payload.departmentId = form.departmentId }
      if (form.password) payload.password = form.password
      if ((!editing || resetOnly) && !form.password) {
        setError('Parolni kiriting')
        return
      }
      const { data } = editing
        ? await client.put(`/admin/users/${editing.id || editing._id}`, payload)
        : await client.post('/admin/users', payload)
      if (form.password) setCredentials({ fullName: data.fullName, phone: data.phone, password: form.password })
      setShowPassword(false)
      setForm(emptyForm)
      setEditing(null)
      setModalOpen(false)
      load()
    } catch (err) {
      setError(err.response?.data?.message || 'Xatolik yuz berdi')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (u) => {
    if (!await confirm({ title: 'Hisobni butunlay o‘chirish?', message: `Haqiqatan ham ${u.fullName} hisobini o‘chirmoqchimisiz? ${u.role === 'teacher' ? 'Uning barcha darslari va shu darslardagi davomat yozuvlari ham o‘chadi.' : 'Uning davomat yozuvlari ham o‘chadi.'} Bu amalni ortga qaytarib bo‘lmaydi.`, action: 'Ha, o‘chirish', danger: true })) return
    try {
      await client.delete(`/admin/users/${u.id || u._id}`)
      load()
    } catch (err) {
      setError(err.response?.data?.message || 'O‘chirishda xatolik')
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Boshqaruv"
        title="Foydalanuvchilar"
        subtitle="Login — telefon raqami. Eski parollar ochilmaydi; «Login / parol» orqali yangi parol belgilang."
        actions={
          <button className="btn btn-primary" onClick={openAdd}>
            <Plus size={16} /> Qo‘shish
          </button>
        }
      />
      {!modalOpen && error && <div className="form-error" role="alert">{error}</div>}

      <div className="toolbar">
        <div className="search-input">
          <Search size={16} />
          <input
            className="form-control"
            placeholder="Ism yoki telefon bo‘yicha qidirish"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="filter-tabs">
          <button className={roleFilter === '' ? 'active' : ''} onClick={() => setRoleFilter('')}>
            Barchasi
          </button>
          <button className={roleFilter === 'teacher' ? 'active' : ''} onClick={() => setRoleFilter('teacher')}>
            O‘qituvchilar
          </button>
          <button className={roleFilter === 'student' ? 'active' : ''} onClick={() => setRoleFilter('student')}>
            Talabalar
          </button>
          <button className={roleFilter === 'admin' ? 'active' : ''} onClick={() => setRoleFilter('admin')}>
            Administratorlar
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: 8 }}>
        {loading ? (
          <p style={{ padding: 20, color: '#6b7280' }}>Yuklanmoqda...</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>FIO</th>
                  <th>Login (telefon)</th>
                  <th>Rol</th>
                  <th>Guruh / Fanlar</th>
                  <th>Holat</th>
                  <th style={{ width: 100 }} />
                </tr>
              </thead>
              <tbody>
                {users
                  .filter((u) => {
                    const q = search.trim().toLowerCase()
                    if (!q) return true
                    return `${u.fullName} ${u.phone}`.toLowerCase().includes(q)
                  })
                  .map((u) => (
                  <tr key={u.id || u._id}>
                    <td style={{ fontWeight: 600 }}>{u.fullName}</td>
                    <td>{u.phone}</td>
                    <td>
                      <span
                        className={`badge ${
                          u.role === 'admin' ? 'badge-yellow' : u.role === 'department_head' ? 'badge-purple' : u.role === 'teacher' ? 'badge-blue' : 'badge-green'
                        }`}
                      >
                        {roleLabels[u.role] || u.role}
                      </span>
                    </td>
                    <td>
                      {['teacher', 'department_head'].includes(u.role) ? (
                        u.subjects?.length ? (
                          <div className="tag-list">
                            {u.subjects.map((s) => (
                              <span key={s.id || s._id} className="badge badge-blue">{s.name}</span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted">Fan biriktirilmagan</span>
                        )
                      ) : (
                        u.group?.name || '—'
                      )}
                    </td>
                    <td>
                      <span className={`badge ${u.approved !== false ? 'badge-green' : 'badge-red'}`}>
                        {u.approved !== false ? 'Faol' : 'Kutilmoqda'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {['student', 'teacher', 'department_head'].includes(u.role) && <button className="btn btn-outline btn-sm" style={{ whiteSpace: 'nowrap' }} aria-label={`${u.fullName}: login va parol`} onClick={() => openEdit(u, true)}><KeyRound size={15} /> Login / parol</button>}
                        <button className="btn-icon" title="Tahrirlash" onClick={() => openEdit(u)}>
                          <Pencil size={15} />
                        </button>
                        <button className="btn-icon" title="O'chirish" onClick={() => remove(u)}>
                          <Trash2 size={15} color="#dc2626" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: 28 }}>
                      Foydalanuvchilar topilmadi
                    </td>
                  </tr>
                )}
                {users.length > 0 &&
                  !users.some((u) => {
                    const q = search.trim().toLowerCase()
                    return !q || `${u.fullName} ${u.phone}`.toLowerCase().includes(q)
                  }) && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: 28 }}>
                        Qidiruvga mos foydalanuvchi topilmadi
                      </td>
                    </tr>
                  )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {credentials && (
        <div className="modal-overlay" onClick={closeModal}>
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="credential-heading" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header"><h3 id="credential-heading">Kirish ma’lumotlari</h3><button className="modal-close" aria-label="Kirish ma’lumotlarini yopish" onClick={closeModal}><X size={20} /></button></div>
            <p style={{ marginBottom: 16 }}>{credentials.fullName} — saqlandi.</p>
            <div className="form-group"><label htmlFor="saved-login">Login (telefon)</label><input id="saved-login" className="form-control" value={credentials.phone} readOnly /></div>
            <div className="form-group"><label htmlFor="saved-password">Yangi parol</label><div style={{ display: 'flex', gap: 8 }}><input id="saved-password" className="form-control" type={showPassword ? 'text' : 'password'} value={credentials.password} readOnly autoComplete="off" /><button type="button" className="btn btn-outline" aria-label={showPassword ? 'Parolni yashirish' : 'Parolni ko‘rsatish'} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></div>
            <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>Ma’lumotlarni faqat hisob egasiga bering. Oyna yopilgach parolni qayta ko‘rib bo‘lmaydi.</p>
            <button className="btn btn-primary" autoFocus onClick={closeModal}>Yopish</button>
          </section>
        </div>
      )}

      {modalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="account-heading" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 id="account-heading">{resetOnly ? 'Login / parol' : editing ? 'Foydalanuvchini tahrirlash' : "Yangi foydalanuvchi qo'shish"}</h3>
              <button className="modal-close" aria-label="Hisob oynasini yopish" disabled={busy} onClick={closeModal}>
                <X size={20} />
              </button>
            </div>

            {error && <div className="form-error" role="alert">{error}</div>}
            {resetOnly && <p style={{ marginBottom: 16 }}>{editing.fullName}. Eski parol xeshda saqlangan va ochilmaydi. Yangi parolni saqlasangiz, eski parol ishlamaydi.</p>}

            <form onSubmit={submit}>
              <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
              {!resetOnly && <div className="form-group">
                <label htmlFor="account-name">To'liq ism familiya</label>
                <input id="account-name" className="form-control" value={form.fullName} onChange={set('fullName')} required />
              </div>}
              <div className="form-group">
                <label htmlFor="account-phone">Login (telefon)</label>
                <input id="account-phone" className="form-control" value={form.phone} onChange={set('phone')} readOnly={resetOnly} required />
              </div>
              <div className="form-group">
                <label htmlFor="account-password">{editing ? 'Yangi parol' : 'Parol'} {editing && !resetOnly && "(o'zgartirmaslik uchun bo'sh qoldiring)"}</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input id="account-password" className="form-control" type={showPassword ? 'text' : 'password'} value={form.password} onChange={set('password')} required={!editing || resetOnly} minLength={6} autoComplete="new-password" autoFocus={resetOnly} />
                  <button type="button" className="btn btn-outline" aria-label={showPassword ? 'Parolni yashirish' : 'Parolni ko‘rsatish'} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                </div>
              </div>
              {!resetOnly && <><div className="form-group">
                <label>Rol</label>
                <select className="form-control" value={form.role} onChange={set('role')}>
                  <option value="student">Talaba</option>
                  <option value="teacher">O'qituvchi</option>
                  <option value="department_head">Kafedra mudiri</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>
              {['teacher', 'department_head'].includes(form.role) && (
                <div className="form-group">
                  <label>Darslari (fanlar) <span className="req">*</span></label>
                  <div className="chip-grid">
                    {subjects.map((s) => {
                      const id = s.id || s._id
                      const checked = form.subjectIds.includes(id)
                      return (
                        <label key={id} className={`chip-check${checked ? ' active' : ''}`}>
                          <input type="checkbox" checked={checked} onChange={() => toggleSubject(id)} />
                          <BookOpen size={14} aria-hidden="true" />
                          {s.name}
                        </label>
                      )
                    })}
                  </div>
                  {subjects.length === 0 && (
                    <p className="slot-hint">Avval «Guruhlar va fanlar» bo‘limida fan qo‘shing.</p>
                  )}
                  <p className="field-hint">Kamida bitta fan tanlang — jadvalda dars shu fanlar bo‘yicha biriktiriladi.</p>
                </div>
              )}
              {['teacher', 'department_head'].includes(form.role) && <div className="form-group"><label>Kafedra *</label><select className="form-control" value={form.departmentId} onChange={set('departmentId')} required><option value="">Kafedrani tanlang</option>{departments.map(d => <option key={d._id} value={d._id}>{d.name}{d.code ? ` · ${d.code}` : ''}</option>)}</select></div>}
              {form.role === 'student' && (
                <div className="form-group">
                  <label>Guruh</label>
                  <select className="form-control" value={form.groupId} onChange={set('groupId')}>
                    <option value="">Guruhni tanlang</option>
                    {groups.map((g) => (
                      <option key={g.id || g._id} value={g.id || g._id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="checkbox" id="approved" checked={form.approved} onChange={set('approved')} />
                <label htmlFor="approved" style={{ margin: 0 }}>
                  Faol (tasdiqlangan)
                </label>
              </div></>}
              <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={busy}>
                {busy ? 'Saqlanmoqda...' : resetOnly ? 'Yangi parolni saqlash' : 'Saqlash'}
              </button>
              </fieldset>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
