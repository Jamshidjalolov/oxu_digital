import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CalendarDays,
  ClipboardCheck,
  BellRing,
  ArrowRight,
  ShieldCheck,
  Eye,
  EyeOff,
  GraduationCap,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'

const features = [
  {
    icon: CalendarDays,
    title: 'Haftalik dars jadvali',
    text: 'O‘qituvchi va talabalar uchun bir manbada, doim yangi.',
  },
  {
    icon: ClipboardCheck,
    title: 'Bir bosishda davomat',
    text: 'Davomat qulflanadi — keyin o‘zgartirib bo‘lmaydi.',
  },
  {
    icon: BellRing,
    title: 'Bildirishnomalar',
    text: 'Jadval o‘zgarishi haqida push, Telegram va mobil xabar.',
  },
]

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const user = await login(phone.trim(), password)
      if (user.role === 'admin') navigate('/admin')
      else if (user.role === 'teacher') navigate('/teacher')
      else if (user.role === 'department_head') navigate('/department-head')
      else navigate('/student')
    } catch (err) {
      setError(err.response?.data?.message || 'Telefon yoki parol xato')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-page">
      <aside className="auth-visual">
        <div className="auth-visual-brand">
          <span className="brand-tile">
            <img src="/oxu-logo.png" alt="OXU" width="42" height="42" />
          </span>
          <div>
            <strong>OXU Digital</strong>
            <span>Osiyo Xalqaro Universiteti</span>
          </div>
        </div>

        <div>
          <span className="auth-kicker">TA’LIMNING RAQAMLI MANZILI</span>
          <h2>
            Har bir dars.
            <br />
            Har bir imkoniyat.
            <br />
            <em>Bir qadam yaqin.</em>
          </h2>
          <p className="lead">
            Universitetning ichki platformasi: o‘qituvchilar dars o‘tadi va
            davomat oladi, talabalar jadvalini kuzatadi, administrator hammasini
            bir joydan boshqaradi.
          </p>
        </div>

        <div className="auth-campus" aria-hidden="true">
          <GraduationCap size={32} />
          <div>
            <strong>Bilimga yo‘l shu yerdan boshlanadi.</strong>
            <span>Jadval · Davomat · Natijalar</span>
          </div>
          <span className="auth-orbit" />
        </div>

        <div className="auth-features">
          {features.map(({ icon: Icon, title, text }) => (
            <div className="auth-feature" key={title}>
              <Icon size={19} aria-hidden="true" />
              <div>
                <strong>{title}</strong>
                <span>{text}</span>
              </div>
            </div>
          ))}
        </div>
      </aside>

      <main className="auth-panel">
        <div className="auth-card">
          <div className="auth-mobile-brand">
            <span className="brand-tile">
              <img src="/oxu-logo.png" alt="OXU" width="34" height="34" />
            </span>
            <div>
              <strong>OXU Digital</strong>
              <span>Osiyo Xalqaro Universiteti</span>
            </div>
          </div>

          <span className="eyebrow">OXU DIGITAL PLATFORMASI</span>
          <h2>Xush kelibsiz!</h2>
          <p className="auth-lead">
            Telefon raqami va parol bilan davom eting.
          </p>

          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}

          <form onSubmit={submit}>
            <div className="form-group">
              <label htmlFor="login-phone">Telefon raqami</label>
              <div className="phone-field">
                <span>+998</span>
                <input
                  id="login-phone"
                  className="form-control"
                  placeholder="901234567"
                  inputMode="tel"
                  autoComplete="username"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="login-password">Parol</label>
              <div className="password-field">
                <input
                  id="login-password"
                  className="form-control"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={
                    showPassword ? 'Parolni yashirish' : 'Parolni ko‘rsatish'
                  }
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <button className="btn btn-primary" disabled={busy}>
              {busy ? 'Kirilmoqda...' : 'Tizimga kirish'}{' '}
              <ArrowRight size={17} />
            </button>
          </form>

          <div className="auth-switch">
            <ShieldCheck
              size={13}
              style={{ verticalAlign: -2, marginRight: 4 }}
            />
            Hisobni administrator yaratadi. Kirish ma’lumotlarini
            administratordan oling.
          </div>
        </div>

        <p className="auth-foot">
          © {new Date().getFullYear()} Osiyo Xalqaro Universiteti
        </p>
      </main>
    </div>
  )
}
