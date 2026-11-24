import client from './api/client.js'

let pendingSetup = null
let setupController = null

export function safeNotificationUrl(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u0020\u007f]|%5c|%0[0-9a-f]|%7f/i.test(value)) return null
  try {
    const url = new URL(value, window.location.origin)
    if (url.origin !== window.location.origin || url.pathname.startsWith('//')) return null
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return null
  }
}

async function getPushRegistration() {
  if (!('serviceWorker' in navigator)) return null
  const registration = await navigator.serviceWorker.getRegistration('/')
  const workers = [registration?.active, registration?.waiting, registration?.installing]
  return workers.some((worker) => worker?.scriptURL === new URL('/push-sw.js', window.location.origin).href)
    ? registration
    : null
}

export async function hasWebPushSubscription() {
  const registration = await getPushRegistration()
  return Boolean(registration && await registration.pushManager.getSubscription())
}

function waitForActivation(registration, signal) {
  if (registration.active?.state === 'activated') return Promise.resolve()
  const worker = registration.installing || registration.waiting || registration.active
  if (!worker) return Promise.reject(new Error('Push worker ishga tushmadi.'))
  return new Promise((resolve, reject) => {
    const finish = (error) => {
      clearTimeout(timer)
      worker.removeEventListener('statechange', check)
      signal.removeEventListener('abort', abort)
      if (error) reject(error)
      else resolve()
    }
    const check = () => {
      if (worker.state === 'activated') finish()
      else if (worker.state === 'redundant') finish(new Error('Push worker ishga tushmadi.'))
    }
    const abort = () => finish(new DOMException('Cancelled', 'AbortError'))
    const timer = setTimeout(() => finish(new Error('Push worker kutish vaqti tugadi.')), 10000)
    worker.addEventListener('statechange', check)
    signal.addEventListener('abort', abort, { once: true })
    if (signal.aborted) abort()
    else check()
  })
}

async function removeSubscription(registration, subscription) {
  try {
    if (subscription) {
      await client.delete('/notifications/subscriptions', {
        data: { type: 'web', endpoint: subscription.endpoint },
        timeout: 5000,
      })
    }
  } finally {
    await Promise.allSettled([
      subscription ? subscription.unsubscribe() : Promise.resolve(),
      registration.getNotifications().then((notifications) => notifications.forEach((notification) => notification.close())),
    ])
  }
}

export function enableWebPush(publicKey, signal) {
  if (pendingSetup) return Promise.reject(new Error('Push sozlanmoqda. Iltimos, kuting.'))
  setupController = new AbortController()
  const controller = setupController
  const abort = () => controller.abort()
  signal.addEventListener('abort', abort, { once: true })
  if (signal.aborted) abort()
  const check = () => {
    if (controller.signal.aborted) throw new DOMException('Cancelled', 'AbortError')
  }
  pendingSetup = Promise.resolve().then(async () => {
    let registration
    let subscription
    try {
      check()
      const key = publicKey.replace(/-/g, '+').replace(/_/g, '/')
      const bytes = Uint8Array.from(atob(key.padEnd(Math.ceil(key.length / 4) * 4, '=')), (character) => character.charCodeAt(0))
      registration = await navigator.serviceWorker.register('/push-sw.js')
      check()
      await waitForActivation(registration, controller.signal)
      subscription = await registration.pushManager.getSubscription()
      check()
      if (!subscription) subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes })
      check()
      await client.post('/notifications/subscriptions', { type: 'web', subscription: subscription.toJSON() }, { signal: controller.signal, timeout: 10000 })
      check()
      await client.put('/notifications/preferences', { web: true }, { signal: controller.signal, timeout: 10000 })
      check()
    } catch (error) {
      if (registration && subscription) await removeSubscription(registration, subscription).catch(() => {})
      throw error
    } finally {
      signal.removeEventListener('abort', abort)
      setupController = null
      pendingSetup = null
    }
  })
  return pendingSetup
}

export async function disconnectWebPush() {
  setupController?.abort()
  if (pendingSetup) await pendingSetup.catch(() => {})
  const registration = await getPushRegistration()
  if (!registration) return
  const subscription = await registration.pushManager.getSubscription()
  await removeSubscription(registration, subscription)
}
