import { useEffect, useState } from "react";
import { BookOpen, CheckCircle2, XCircle, GraduationCap, Clock3, FlaskConical } from "lucide-react";
import client from "../../api/client.js";
import useRealtimeRevision from "../../useRealtimeRevision.js";
import PageHeader from "../../components/PageHeader.jsx";

export default function TeacherStats() {
  const revision = useRealtimeRevision();
  const [stats, setStats] = useState(null);
  const [workload, setWorkload] = useState({ rows: [], totals: {} });
  const [demo, setDemo] = useState(false);

  useEffect(() => {
    Promise.all([client.get("/teacher/stats"), client.get("/teacher/workload")])
      .then(([s, w]) => { setStats(s.data); setWorkload(w.data); })
      .catch(() => { setStats({ total: 0, present: 0, absent: 0 }); setWorkload({ rows: [], totals: {} }); });
  }, [revision]);

  const percentage =
    stats && stats.total > 0
      ? Math.round(((stats.present || 0) / stats.total) * 100)
      : 0;

  const cards = [
    {
      icon: BookOpen,
      label: "Jami darslar",
      value: stats?.total ?? "—",
      tone: "#3c5bdb",
    },
    {
      icon: CheckCircle2,
      label: "Qatnashilgan",
      value: stats?.present ?? "—",
      tone: "#0e9f6e",
    },
    {
      icon: XCircle,
      label: "Qatnashilmagan",
      value: stats?.absent ?? "—",
      tone: "#e02424",
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Statistika"
        title="Mening statistikam"
        subtitle="Davomat ko‘rsatkichlari va umumiy qatnashish foizi."
      />

      <div className="stats-grid teacher-load-cards">{[['Jami auditoriya', workload.totals.total || 0, Clock3, '#2563eb'], ['Ma’ruza', workload.totals.lecture || 0, BookOpen, '#16a085'], ['Amaliyot', workload.totals.practice || 0, GraduationCap, '#7c3aed'], ['Laboratoriya', workload.totals.laboratory || 0, FlaskConical, '#e58b20']].map(([label, value, Icon, tone]) => <div className="stat-card" key={label} style={{ '--tone': tone }}><div className="stat-icon"><Icon size={22}/></div><div><div className="stat-value">{value} soat</div><div className="stat-label">{label}</div></div></div>)}</div>
      <div className="card teacher-workload-card"><h3><BookOpen size={18}/> Biriktirilgan fanlar va yuklama <button type="button" className="btn btn-outline btn-sm" onClick={() => setDemo(!demo)}>{demo ? 'Haqiqiy ma’lumot' : 'Test ma’lumotini ko‘rsatish'}</button></h3><div className="teacher-workload-table-wrap"><table className="teacher-workload-table"><thead><tr><th>#</th><th>Kod</th><th>Fan nomi</th><th>Kafedra</th><th>Kredit</th><th>Ma’ruza</th><th>Amaliy</th><th>Laboratoriya</th><th>Guruhlar</th><th>Jadval</th></tr></thead><tbody>{(demo ? [{no:1,id:'demo-1',code:'AT1204',name:'Axborot texnologiyalari',direction:'Dasturiy injiniring',department:'Aniq fanlar va raqamli texnologiyalar',credits:4,lecture:16,practice:30,laboratory:0,groups:['S1-KT-26'],scheduledLessons:6},{no:2,id:'demo-2',code:'TI1302',name:'Tizimli dasturlash',direction:'Kompyuter injiniringi',department:'Muhandislik va texnologiyalari',credits:3,lecture:12,practice:24,laboratory:12,groups:['S2-KT-26','S3-KT-26'],scheduledLessons:8}] : workload.rows).map(row=><tr key={row.id}><td>{row.no}</td><td>{row.code || '—'}</td><td><strong>{row.name}</strong><small>{row.direction || ''}</small></td><td>{row.department || '—'}</td><td>{row.credits || 0}</td><td>{row.lecture}</td><td>{row.practice}</td><td>{row.laboratory}</td><td>{row.groups.join(', ') || '—'}</td><td>{row.scheduledLessons} dars</td></tr>)}</tbody></table>{!workload.rows.length && !demo && <p className="empty-day">Sizga hali fan biriktirilmagan.</p>}{demo && <p className="teacher-demo-note">Bu namunaviy ma’lumot. Haqiqiy fan biriktirilganda avtomatik almashtiriladi.</p>}</div></div>
      <div className="stats-grid">
        {cards.map(({ icon: Icon, label, value, tone }) => (
          <div className="stat-card" key={label} style={{ "--tone": tone }}>
            <div className="stat-icon">
              <Icon size={22} />
            </div>
            <div>
              <div className="stat-value">{value}</div>
              <div className="stat-label">{label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 12 }}>Umumiy qatnashish foizi</h3>
        <div
          style={{
            fontSize: 38,
            fontWeight: 800,
            letterSpacing: "-0.03em",
            color: "var(--ink)",
          }}
        >
          {percentage}%
        </div>
        <div
          className="att-progress"
          style={{ background: "#eef2ff", marginTop: 14 }}
        >
          <div
            className="att-progress-fill"
            style={{
              width: `${percentage}%`,
              background: "linear-gradient(90deg, #2f4ddb, #7b5cff)",
            }}
          />
        </div>
        <p style={{ marginTop: 12, fontSize: 13, color: "var(--muted)" }}>
          Qatnashilgan darslar: {stats?.present ?? 0} / {stats?.total ?? 0}
        </p>
      </div>
    </div>
  );
}
