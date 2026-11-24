export const DAY_NAMES = ['Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba']

// Demo ma'lumotlar shu haftada — dastlabki ko'rinish
export const DEFAULT_WEEK = toISODate(getMonday(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent' }).format(new Date())))

export function toISODate(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Berilgan sanadan (yoki bugundan) haftaning dushanbasini qaytaradi
export function getMonday(dateStr) {
  const d = dateStr ? new Date(dateStr + 'T00:00:00') : new Date()
  const day = d.getDay() // 0=Yakshanba, 1=Dushanba...
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d
}

export function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return toISODate(d)
}

// Hafta boshidan 6 kun (Dushanba..Shanba)
export function weekDates(weekStart) {
  return Array.from({ length: 6 }, (_, i) => addDays(weekStart, i))
}

export function formatDateUZ(iso) {
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}
