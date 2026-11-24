import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, Check, Settings, X } from 'lucide-react'
import client from '../api/client.js'
import { disconnectWebPush, enableWebPush, hasWebPushSubscription, safeNotificationUrl } from '../notifications.js'

function pushUnavailable(config, permission) {
  if (!window.isSecureContext) return 'Web Push uchun HTTPS yoki localhost kerak.'
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) return 'Bu brauzer Web Push xizmatini qo‘llab-quvvatlamaydi.'
  if (permission === 'denied') return 'Bildirishnomalar bloklangan. Brauzer sayt sozlamalarida ruxsatni o‘zgartiring.'
  if (!config?.webPush?.configured || !config.webPush.publicKey) return 'Serverda Web Push hali sozlanmagan.'
  return ''
}

function notificationTime(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export default function NotificationCenter() {
  const [open, setOpen] = useState(false)
  const [settings, setSettings] = useState(false)
  const [items, setItems] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [inboxError, setInboxError] = useState('')
  const [config, setConfig] = useState(null)
  const [configError, setConfigError] = useState('')
  const [actionError, setActionError] = useState('')
  const [busy, setBusy] = useState('')
  const [subscribed, setSubscribed] = useState(false)
  const [permission, setPermission] = useState(() => 'Notification' in window ? Notification.permission : 'default')
  const [flash, setFlash] = useState(null)
  const seen = useRef(null)
  const lifecycle = useRef(null)
  const refreshing = useRef(false)
  const acting = useRef(false)
  const revision = useRef(0)
  const center = useRef(null)
  const bell = useRef(null)
  const closeButton = useRef(null)

  const refresh = useCallback(async () => {
    const controller = lifecycle.current
    if (!controller || controller.signal.aborted || refreshing.current || acting.current) return
    refreshing.current = true
    const version = revision.current
    const current = () => !controller.signal.aborted && revision.current === version
    const options = { signal: controller.signal, timeout: 8000 }
    try {
      await Promise.allSettled([
        client.get('/notifications', options).then(({ data }) => {
          if (!current()) return
          const list = data.items.slice(0, 50)
          setItems(list)
          setUnreadCount(data.unreadCount)
          setInboxError('')
          const ids = new Set(list.map((item) => item._id))
          if (seen.current === null) {
            seen.current = ids
          } else {
            const fresh = list.find((item) => !seen.current.has(item._id) && !item.readAt)
            seen.current = ids
            if (fresh) setFlash(fresh)
          }
        }).catch(() => {
          if (current()) setInboxError('Bildirishnomalarni yuklab bo‘lmadi. Qayta urinib ko‘ring.')
        }),
        client.get('/notifications/config', options).then(({ data }) => {
          if (!current()) return
          setConfig(data)
          setConfigError('')
        }).catch(() => {
          if (current()) setConfigError('Bildirishnoma sozlamalarini yuklab bo‘lmadi.')
        }),
        hasWebPushSubscription().then((value) => {
          if (current()) setSubscribed(value)
        }).catch(() => {
          if (current()) setSubscribed(false)
        }),
      ])
      if (current() && 'Notification' in window) setPermission(Notification.permission)
    } finally {
      if (lifecycle.current === controller) refreshing.current = false
      if (!controller.signal.aborted) setLoading(false)
    }
  }, [])

  useEffect(() => {
    const onRealtime = () => refresh()
    window.addEventListener('oxu-refresh',onRealtime)
    return () => window.removeEventListener('oxu-refresh',onRealtime)
  }, [refresh])
  useEffect(() => {
    const controller = new AbortController()
    lifecycle.current = controller
    document.body.classList.add('has-notification-center')
    refresh()
    const timer = setInterval(refresh, 10000)
    const onFocus = () => refresh()
    const onVisible = () => { if (document.visibilityState === 'visible') refresh() }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      controller.abort()
      refreshing.current = false
      clearInterval(timer)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisible)
      document.body.classList.remove('has-notification-center')
    }
  }, [refresh])

  useEffect(() => {
    if (!open) return
    closeButton.current?.focus()
    const onPointer = (event) => {
      if (!center.current?.contains(event.target)) setOpen(false)
    }
    const onKey = (event) => {
      if (event.key === 'Escape') {
        setOpen(false)
        bell.current?.focus()
      }
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  useEffect(() => {
    if (!flash) return
    const timer = setTimeout(() => setFlash(null), 9000)
    return () => clearTimeout(timer)
  }, [flash])

  const runAction = async (name, task) => {
    const controller = lifecycle.current
    if (!controller || controller.signal.aborted || acting.current) return
    acting.current = true
    revision.current += 1
    setBusy(name)
    setActionError('')
    try {
      await task(controller.signal)
    } catch (error) {
      if (!controller.signal.aborted) setActionError(error.response?.data?.message || error.message || 'Amal bajarilmadi. Qayta urinib ko‘ring.')
    } finally {
      acting.current = false
      if (!controller.signal.aborted) {
        setBusy('')
        refresh()
      }
    }
  }

  const markRead = (item) => {
    if (item.readAt) return
    runAction(item._id, async (signal) => {
      await client.put(`/notifications/${encodeURIComponent(item._id)}/read`, undefined, { signal, timeout: 8000 })
      if (signal.aborted) return
      setItems((previous) => previous.map((entry) => entry._id === item._id ? { ...entry, readAt: new Date().toISOString() } : entry))
      setUnreadCount((count) => Math.max(0, count - 1))
    })
  }

  const markAllRead = () => runAction('read-all', async (signal) => {
    await client.put('/notifications/read-all', undefined, { signal, timeout: 8000 })
    if (signal.aborted) return
    setItems((previous) => previous.map((item) => ({ ...item, readAt: item.readAt || new Date().toISOString() })))
    setUnreadCount(0)
  })

  const setPreference = (channel, value) => runAction(channel, async (signal) => {
    await client.put('/notifications/preferences', { [channel]: value }, { signal, timeout: 8000 })
    if (!signal.aborted) setConfig((previous) => ({ ...previous, preferences: { ...previous.preferences, [channel]: value } }))
  })

  const optIn = () => runAction('web', async (signal) => {
    const reason = pushUnavailable(config, 'Notification' in window ? Notification.permission : 'default')
    if (reason) throw new Error(reason)
    const result = await Notification.requestPermission()
    if (signal.aborted) return
    setPermission(result)
    if (result !== 'granted') throw new Error(result === 'denied' ? 'Ruxsat rad etildi. Brauzer sayt sozlamalarini tekshiring.' : 'Ruxsat berilmadi. Web Push yoqilmadi.')
    await enableWebPush(config.webPush.publicKey, signal)
    if (signal.aborted) return
    setSubscribed(true)
    setConfig((previous) => ({ ...previous, preferences: { ...previous.preferences, web: true } }))
  })

  const optOut = () => runAction('web', async (signal) => {
    await disconnectWebPush()
    if (signal.aborted) return
    setSubscribed(false)
    await client.put('/notifications/preferences', { web: false }, { signal, timeout: 8000 })
    if (!signal.aborted) setConfig((previous) => ({ ...previous, preferences: { ...previous.preferences, web: false } }))
  })

  const unavailable = config ? pushUnavailable(config, permission) : ''
  const webEnabled = subscribed && config?.preferences?.web && permission === 'granted'

  return (
    <div className="notification-center" ref={center}>
      <button
        type="button"
        className="notification-bell"
        ref={bell}
        aria-label={`Bildirishnomalar: ${unreadCount} ta o‘qilmagan`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="notification-inbox"
        onClick={() => { setOpen((value) => !value); if (!open) refresh() }}
      >
        <Bell size={23} aria-hidden="true" />
        {unreadCount > 0 && <span className="notification-count" aria-hidden="true">{unreadCount > 99 ? '99+' : unreadCount}</span>}
      </button>
      {flash && (
        <aside className="sms-toast" role="status" aria-live="polite">
          <header className="sms-toast-head">
            <span className="sms-logo" aria-hidden="true">OXU</span>
            <div className="sms-meta">
              <strong>OXU Digital</strong>
              <span>SMS xabarnoma · hozir</span>
            </div>
            <button type="button" className="btn-icon sms-close" aria-label="Xabarni yopish" onClick={() => setFlash(null)}>
              <X size={15} aria-hidden="true" />
            </button>
          </header>
          {safeNotificationUrl(flash.url) ? (
            <Link className="sms-bubble" to={safeNotificationUrl(flash.url)} onClick={() => { markRead(flash); setFlash(null) }}>
              <span className="sms-title">{flash.title}</span>
              {flash.body && <span className="sms-text">{flash.body}</span>}
            </Link>
          ) : (
            <div className="sms-bubble">
              <span className="sms-title">{flash.title}</span>
              {flash.body && <span className="sms-text">{flash.body}</span>}
            </div>
          )}
        </aside>
      )}
      {open && (
        <section id="notification-inbox" className="notification-popover" role="dialog" aria-modal="false" aria-labelledby="notification-heading">
          <header className="notification-header">
            <h2 id="notification-heading">Bildirishnomalar</h2>
            <button type="button" className="btn-icon" aria-label="Sozlamalar" aria-expanded={settings} aria-controls="notification-settings" onClick={() => setSettings((value) => !value)}><Settings size={18} aria-hidden="true" /></button>
            <button type="button" className="btn-icon" ref={closeButton} aria-label="Bildirishnomalarni yopish" onClick={() => { setOpen(false); bell.current?.focus() }}><X size={18} aria-hidden="true" /></button>
          </header>
          <div className="notification-scroll">
            {settings && (
              <section id="notification-settings" className="notification-settings" aria-label="Bildirishnoma sozlamalari">
                <h3>Yetkazish kanallari</h3>
                {configError && <p className="notification-error" role="alert">{configError} <button type="button" className="notification-text-button" onClick={refresh}>Qayta urinish</button></p>}
                {!config && !configError && <p role="status">Sozlamalar yuklanmoqda...</p>}
                {config && <>
                  <p>Web Push: {webEnabled ? 'bu brauzerda yoqilgan' : 'bu brauzerda yoqilmagan'}.</p>
                  {webEnabled && <button className="btn btn-outline btn-sm" disabled={Boolean(busy)} onClick={()=>runAction('test',async(signal)=>{await client.post('/notifications/test',{}, {signal});})}>Sinov push xabari yuborish</button>}
                  <p className="notification-hint">Faqat siz tugmani bosib ruxsat berganingizdan keyin yoqiladi. SMS yuborilmaydi.</p>
                  {unavailable && <p className="notification-hint">{unavailable}</p>}
                  <div className="notification-channel-actions">
                    {!webEnabled && <button type="button" className="btn btn-primary btn-sm" disabled={Boolean(busy || unavailable || configError)} onClick={optIn}>{busy === 'web' ? 'Sozlanmoqda...' : 'Web Pushni yoqish'}</button>}
                    {(subscribed || config.preferences?.web) && <button type="button" className="btn btn-outline btn-sm" disabled={Boolean(busy)} onClick={optOut}>Web Pushni o‘chirish</button>}
                  </div>
                  <label className="notification-channel"><input type="checkbox" checked={Boolean(config.preferences?.mobile)} disabled={Boolean(busy || configError || (!config.expoPush?.configured && !config.preferences?.mobile))} onChange={(event) => setPreference('mobile', event.target.checked)} /> Mobil Push</label>
                  <p className="notification-hint">{config.expoPush?.configured ? 'Qurilma uchun mobil ilovada ruxsat kerak.' : 'Serverda mobil Push sozlanmagan.'}</p>
                  <label className="notification-channel"><input type="checkbox" checked={Boolean(config.preferences?.telegram)} disabled={Boolean(busy || configError || ((!config.telegram?.configured || !config.telegram?.linked) && !config.preferences?.telegram))} onChange={(event) => setPreference('telegram', event.target.checked)} /> Telegram</label>
                  <p className="notification-hint">{!config.telegram?.configured ? 'Serverda Telegram sozlanmagan.' : !config.telegram.linked ? 'Telegram bot orqali hisobingizni bog‘lang.' : 'Telegram hisobi bog‘langan.'}</p>
                </>}
              </section>
            )}
            {actionError && <p className="notification-error" role="alert">{actionError}</p>}
            <div className="notification-toolbar">
              <span role="status" aria-live="polite">{unreadCount} ta o‘qilmagan</span>
              <button type="button" className="notification-text-button" disabled={Boolean(busy || loading || !unreadCount)} onClick={markAllRead}>{busy === 'read-all' ? 'Saqlanmoqda...' : 'Barchasini o‘qilgan qilish'}</button>
            </div>
            {loading && <p className="notification-state" role="status">Bildirishnomalar yuklanmoqda...</p>}
            {inboxError && <p className="notification-error" role="alert">{inboxError} <button type="button" className="notification-text-button" onClick={refresh}>Qayta urinish</button></p>}
            {!loading && !inboxError && items.length === 0 && <p className="notification-state">Hozircha bildirishnomalar yo‘q.</p>}
            <ul className="notification-list" aria-label="Oxirgi 50 ta bildirishnoma" aria-busy={loading}>
              {items.map((item) => {
                const url = safeNotificationUrl(item.url)
                const date = notificationTime(item.createdAt)
                return (
                  <li key={item._id} className={`notification-item${item.readAt ? '' : ' notification-unread'}`}>
                    <div className="notification-sender" aria-hidden="true">
                      <span className="sms-logo sms-logo-sm">OXU</span>
                      <span>OXU Digital</span>
                      <span className="notification-channel-tag">SMS</span>
                    </div>
                    <div className="notification-item-heading">
                      <h3>{url ? <Link to={url} onClick={() => { markRead(item); setOpen(false) }}>{item.title}</Link> : item.title}</h3>
                      {!item.readAt && <span className="notification-unread-dot" role="img" aria-label="O‘qilmagan" />}
                    </div>
                    {item.body && <p className="notification-body">{item.body}</p>}
                    <div className="notification-item-footer">
                      {date ? <time dateTime={date.toISOString()}>{date.toLocaleString('uz-UZ', { dateStyle: 'medium', timeStyle: 'short' })}</time> : <span>Sana mavjud emas</span>}
                      {!item.readAt && <button type="button" className="notification-text-button" disabled={Boolean(busy)} onClick={() => markRead(item)}><Check size={14} aria-hidden="true" /> {busy === item._id ? 'Saqlanmoqda...' : 'O‘qilgan'}</button>}
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        </section>
      )}
    </div>
  )
}
