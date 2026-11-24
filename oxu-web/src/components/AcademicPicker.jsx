import { useEffect, useState } from 'react'
import client from '../api/client.js'

export default function AcademicPicker({ form, onChange }) {
  const [catalog, setCatalog] = useState({ departments: [], directions: [] })
  useEffect(() => { let alive = true; client.get('/admin/academic-catalog').then(({ data }) => alive && setCatalog(data || {})).catch(() => {}); return () => { alive = false } }, [])
  const update = (key) => (e) => onChange({ [key]: e.target.value, ...(key === 'direction' ? { directionSourceId: '' } : {}), ...(key === 'department' ? { referenceSource: '' } : {}) })
  return <section className="academic-picker manual-academic-picker">
    <div><strong>O‘quv ma’lumotlari</strong><small>Kafedra, yo‘nalish va fan kodini o‘zingiz kiriting. Ro‘yxatlar faqat taklif sifatida ishlaydi.</small></div>
    <div className="subject-two">
      <label className="subject-field">Ta’lim yo‘nalishi *<input required className="form-control" list="direction-suggestions" value={form.direction || ''} onChange={update('direction')} placeholder="Masalan: Dasturiy injiniring" /></label>
      <label className="subject-field">Kafedra *<input required className="form-control" list="department-suggestions" value={form.department || ''} onChange={update('department')} placeholder="Kafedra nomini yozing" /></label>
    </div>
    <div className="subject-two">
      <label className="subject-field">Fan kodi<input className="form-control" value={form.code || ''} onChange={update('code')} placeholder="Masalan: AT1204" /></label>
      <label className="subject-field">Fakultet / bo‘lim<input className="form-control" value={form.faculty || ''} onChange={update('faculty')} placeholder="Fakultet nomini yozing" /></label>
    </div>
    <datalist id="direction-suggestions">{(catalog.directions || []).map((d, i) => <option key={`${d.sourceId}-${i}`} value={d.name}>{d.level}</option>)}</datalist>
    <datalist id="department-suggestions">{(catalog.departments || []).map((d) => <option key={d.name} value={d.name} />)}</datalist>
    <p className="academic-note">Maydonlar erkin tahrirlanadi. Rasmiy katalogdagi taklifni tanlash shart emas; kod, majburiy/tanlov, kurs, soat va kreditni o‘quv rejangiz bo‘yicha kiriting.</p>
  </section>
}
