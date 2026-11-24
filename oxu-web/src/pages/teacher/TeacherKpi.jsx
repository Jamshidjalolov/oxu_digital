import { useEffect, useState } from 'react'
import { Award, BarChart3, BookOpen, CheckCircle2, Target, TrendingUp } from 'lucide-react'
import client from '../../api/client.js'
import PageHeader from '../../components/PageHeader.jsx'

export default function TeacherKpi() {
  const [workload, setWorkload] = useState({ rows: [], totals: {} })
  const [stats, setStats] = useState({ total: 0, present: 0 })
  useEffect(() => { Promise.all([client.get('/teacher/workload'), client.get('/teacher/stats')]).then(([w, s]) => { setWorkload(w.data); setStats(s.data) }).catch(() => {}) }, [])
  const teaching = Math.min(5, (workload.totals.total || 0) / 60)
  const attendance = stats.total ? Math.min(5, (stats.present / stats.total) * 5) : 0
  const research = 0
  const score = Number(((teaching * .5) + (attendance * .3) + (research * .2)).toFixed(2))
  const green = score >= 3.5
  const bands = [
    ['O‘quv yuklamasi', 'A', workload.totals.total || 0, 'soat', teaching.toFixed(2), 50],
    ['Davomat va dars sifati', 'A', stats.present || 0, 'dars', attendance.toFixed(2), 30],
    ['Ilmiy faoliyat', 'C', 0, 'ish', research.toFixed(2), 20],
  ]
  return <div className="kpi-page"><PageHeader eyebrow="Ilmiy KPI" title="Mening kabinetim" subtitle="O‘quv, ilmiy va metodik faoliyatingiz bo‘yicha yillik KPI ko‘rsatkichlari." />
    <div className="kpi-filters"><label>Reyting yili<select className="form-control"><option>2026–2027 (ILMIY–2026)</option><option>2025–2026</option></select></label><label>Oraliq<select className="form-control"><option>Butun davr (2026–2027)</option><option>1-semestr</option><option>2-semestr</option></select></label><span className="kpi-live"><CheckCircle2 size={15}/> Faol — avtomatik baholanmoqda</span></div>
    <div className="kpi-cards"><div className="kpi-card score"><BarChart3/><small>K– samaradorlik</small><strong>{score.toFixed(2)}</strong><span>Joriy davr</span></div><div className="kpi-card"><Award/><small>Toifa</small><strong>{score >= 4.5 ? 'A' : score >= 3.5 ? 'B' : 'C'}</strong><span>{score >= 3.5 ? 'Yashil zona' : 'Rivojlanmoqda'}</span></div><div className="kpi-card"><Target/><small>Yashil chegara</small><strong>3.50</strong><span className={green ? 'good' : 'warn'}>{green ? 'Bali yetarli' : 'Yana ball kerak'}</span></div><div className="kpi-rank"><TrendingUp/><small>Universitetdagi o‘rningiz</small><strong>—</strong><span>Ma’lumotlar to‘planmoqda</span></div></div>
    <div className="kpi-layout"><section className="card"><h3><BookOpen size={18}/> Bandlar kesimida ballaringiz</h3><table className="kpi-table"><thead><tr><th>Band</th><th>Str.</th><th>Vazn</th><th>Soni</th><th>Ball</th><th>Cheklov</th></tr></thead><tbody>{bands.map(([name, code, count, unit, points, weight]) => <tr key={name}><td><strong>{name}</strong><small>Avtomatik hisob-kitob</small></td><td>{code}</td><td>{weight}%</td><td>{count} {unit}</td><td className="kpi-points">{points}</td><td>{points > 0 ? 'Hisoblandi' : 'Kiritilmagan'}</td></tr>)}</tbody></table></section><aside className="card kpi-rules"><h3><Target size={18}/> Normativ — yashil chegaraga chiqish</h3><p>Yashil zona uchun kamida <strong>3.50 ball</strong> to‘plash kerak.</p>{['Scopus maqola — 20 ballgacha','Xalqaro anjuman — 10 ballgacha','Mahalliy maqola — 2 ballgacha','O‘quv-uslubiy qo‘llanma — 5 ballgacha'].map((x, i) => <div className="kpi-rule" key={x}><span>{i + 1}</span>{x}<b>+</b></div>)}</aside></div>
  </div>
}
