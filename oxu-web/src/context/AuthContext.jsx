import { createContext, useContext, useEffect, useRef, useState } from 'react'
import client from '../api/client.js'
import { useConfirm } from '../components/ConfirmProvider.jsx'
import { disconnectWebPush } from '../notifications.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const confirm = useConfirm()
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('oxu_user')
    try {
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  })
  const [token, setToken] = useState(
    () => localStorage.getItem('oxu_token') || null,
  )
  const [loading, setLoading] = useState(true)
  const bootController = useRef(null)
  const logoutTask = useRef(null)

  useEffect(() => {
    const controller = new AbortController()
    bootController.current = controller
    const boot = async () => {
      if (token) {
        try {
          const { data } = await client.get('/auth/me', {
            signal: controller.signal,
          })
          if (controller.signal.aborted) return
          setUser(data.user)
          localStorage.setItem('oxu_user', JSON.stringify(data.user))
        } catch {
          if (controller.signal.aborted) return
          localStorage.removeItem('oxu_token')
          localStorage.removeItem('oxu_user')
          setToken(null)
          setUser(null)
        }
      } else {
        setUser(null)
      }
      if (!controller.signal.aborted) setLoading(false)
    }
    boot()
    return () => controller.abort()
  }, [token])

  const persist = (data) => {
    localStorage.setItem('oxu_token', data.token)
    localStorage.setItem('oxu_user', JSON.stringify(data.user))
    setToken(data.token)
    setUser(data.user)
  }

  const login = async (phone, password) => {
    const { data } = await client.post('/auth/login', { phone, password })
    persist(data)
    return data.user
  }

  const logout = async () => {
    if (!await confirm({ title: 'Tizimdan chiqmoqchimisiz?', message: 'Haqiqatan ham hisobingizdan chiqmoqchimisiz? Qayta kirish uchun telefon va parol kerak bo‘ladi.', action: 'Ha, chiqish' })) return
    if (logoutTask.current) return logoutTask.current
    setLoading(true)
    bootController.current?.abort()
    logoutTask.current = Promise.resolve().then(async () => {
      try {
        await disconnectWebPush()
      } catch {
      } finally {
        localStorage.removeItem('oxu_token')
        localStorage.removeItem('oxu_user')
        setToken(null)
        setUser(null)
        setLoading(false)
        logoutTask.current = null
      }
    })
    return logoutTask.current
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, updateProfile: async (payload) => { const { data }=await client.put('/auth/me',payload); localStorage.setItem('oxu_user',JSON.stringify(data.user)); setUser(data.user); return data.user } }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
