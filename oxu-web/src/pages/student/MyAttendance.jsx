import { useEffect, useState } from 'react'
import { BookOpen, CheckCircle2, XCircle } from 'lucide-react'
import client from '../../api/client.js'
import useRealtimeRevision from '../../useRealtimeRevision.js'
import PageHeader from '../../components/PageHeader.jsx'
import { formatDateUZ } from '../../utils/week.js'

export default function MyAttendance() {
  const revision = useRealtimeRevision()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    client
      .get('/student/attendance')
      .then(({ data }) => setData(data))
      .catch((err) => setError(err.response?.data?.message || 'Davomatni yuklab bo‘lmadi'))
  }, [revision])

  const percentage = data?.percentage ?? 0
  const radius = 56
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (percentage / 100) * circumference

  if (error) return <div className="form-error" role="alert">{error}</div>
  if (!data) return <div className="page-loading">Yuklanmoqda...</div>

  const cards = [
    { icon: BookOpen, label: 'Jami darslar', value: data?.total ?? '—', tone: '#3c5bdb' },
    { icon: CheckCircle2, label: 'Qatnashilgan', value: data?.present ?? '—', tone: '#0e9f6e' },
    { icon: XCircle, label: 'Qatnashilmagan', value: data?.absent ?? '—', tone: '#e02424' },
  ]

  return (
    <div>
      <PageHeader
        eyebrow="Talaba paneli"
        title="Mening davomatim"
        subtitle="Shaxsiy davomat ko‘rsatkichlari va darslar tarixi."
      />

      <div className="stats-grid">
        {cards.map(({ icon: Icon, label, value, tone }) => (
          <div className="stat-card" key={label} style={{ '--tone': tone }}>
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

      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 30, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', width: 148, height: 148 }}>
          <svg width="148" height="148" viewBox="0 0 148 148" role="img" aria-label={`Davomat: ${percentage}%`}>
            <circle cx="74" cy="74" r={radius} fill="none" stroke="#eef2ff" strokeWidth="12" />
            <circle
              cx="74"
              cy="74"
              r={radius}
              fill="none"
              stroke="url(#ringGrad)"
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              transform="rotate(-90 74 74)"
            />
            <defs>
              <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#2f4ddb" />
                <stop offset="100%" stopColor="#7b5cff" />
              </linearGradient>
            </defs>
          </svg>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 30,
              fontWeight: 800,
              letterSpacing: '-0.03em',
              color: 'var(--ink)',
            }}
          >
            {percentage}%
          </div>
        </div>

        <div style={{ flex: '1 1 240px', minWidth: 0 }}>
          <span className="badge badge-blue">Umumiy ko‘rsatkich</span>
          <h3 style={{ marginTop: 10, fontSize: 18 }}>Umumiy davomat foizi</h3>
          <p style={{ color: 'var(--muted)', fontSize: 13.5, marginTop: 6, lineHeight: 1.6 }}>
            Qatnashilgan darslarning ulushi — {data?.present ?? 0} / {data?.total ?? 0} ta dars.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
            <span className="badge badge-green">
              <CheckCircle2 size={13} /> Qatnashdi: {data?.present ?? 0}
            </span>
            <span className="badge badge-red">
              <XCircle size={13} /> Qatnashmadi: {data?.absent ?? 0}
            </span>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 8, marginTop: 20 }}>
        <h3 style={{ padding: '18px 18px 12px', fontSize: 16 }}>Davomat tarixi</h3>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Sana</th>
                <th>Fan</th>
                <th>Holat</th>
              </tr>
            </thead>
            <tbody>
              {(data?.records || []).map((r) => (
                <tr key={r.id || r._id || `${r.date}_${r.subject}`}>
                  <td style={{ color: 'var(--muted)' }}>{formatDateUZ(r.date)}</td>
                  <td style={{ fontWeight: 700, color: 'var(--ink)' }}>{r.subject}</td>
                  <td>
                    <span className={`badge ${r.status === 'present' ? 'badge-green' : 'badge-red'}`}>
                      {r.status === 'present' ? 'Qatnashdi' : 'Qatnashmadi'}
                    </span>
                  </td>
                </tr>
              ))}
              {(data?.records || []).length === 0 && (
                <tr>
                  <td colSpan={3} style={{ textAlign: 'center', color: 'var(--muted)', padding: 28 }}>
                    Davomat yozuvlari yo‘q
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
