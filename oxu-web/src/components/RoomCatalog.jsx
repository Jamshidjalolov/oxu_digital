import { useEffect, useState } from 'react'
import client from '../api/client.js'
export default function RoomCatalog() {
  const [rooms, setRooms] = useState([])
  const [building, setBuilding] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { client.get('/admin/rooms').then(r => setRooms(r.data)).catch(() => setError('Xonalarni yuklab bo‘lmadi')) }, [])
  const save = async e => {
    e.preventDefault(); setBusy(true); setError('')
    try { const r = await client.post('/admin/rooms', { building, name }); setRooms(v => [...v,r.data]); setName('') }
    catch(e) { setError(e.response?.data?.message || 'Saqlashda xatolik') }
    finally { setBusy(false) }
  }
  return <section className="card" style={{ marginBottom: 22 }}><h3>Xonalar va binolar</h3><p className="page-subtitle">Xona raqamini va bino nomini bir xil shaklda kiriting. Bandlik dars qo‘shishda sana va para bo‘yicha tekshiriladi.</p>{error && <p role="alert" className="form-error">{error}</p>}<form className="toolbar" style={{ marginTop: 16 }} onSubmit={save}><input required aria-label="Bino nomi" className="form-control" style={{ flex: 1 }} list="building-options" placeholder="Kampus va bino" value={building} onChange={e => setBuilding(e.target.value)} /><datalist id="building-options">{[...new Set(['Kampus 1 (1-bino)','Kampus 1 (2-bino)','Kampus 1 (3-bino)',...rooms.map(r => r.building)])].map(b => <option key={b} value={b} />)}</datalist><input required aria-label="Xona raqami" className="form-control" style={{ flex: 1 }} placeholder="Xona raqami" value={name} onChange={e => setName(e.target.value)} /><button disabled={busy} className="btn btn-primary">{busy ? 'Saqlanmoqda…' : 'Xona qo‘shish'}</button></form><div className="chip-grid">{rooms.map(r => <span key={r._id} className="badge badge-blue">{r.building} · {r.name}-xona</span>)}</div>{!rooms.length && <p className="empty-day">Hali xona kiritilmagan.</p>}</section>
}
