import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ShieldQuestion, X } from 'lucide-react'

const Context = createContext(null)
export const useConfirm = () => useContext(Context)

export default function ConfirmProvider({ children }) {
  const [request, setRequest] = useState(null)
  const pending = useRef(null)
  const cancel = useRef(null)
  const settle = (answer) => { const resolve = pending.current; pending.current = null; setRequest(null); resolve?.(answer) }
  const confirm = (options) => {
    if (pending.current) return Promise.resolve(false)
    return new Promise(resolve => { pending.current = resolve; setRequest(options) })
  }
  useEffect(() => {
    if (!request) return
    const previous = document.activeElement
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    cancel.current?.focus()
    const key = (event) => {
      if (event.key === 'Escape') settle(false)
      if (event.key === 'Tab') {
        const buttons = [...document.querySelectorAll('.confirm-dialog button')]
        const index = buttons.indexOf(document.activeElement)
        event.preventDefault()
        buttons[(index + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length]?.focus()
      }
    }
    document.addEventListener('keydown', key)
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', key); previous?.focus() }
  }, [request])
  return <Context.Provider value={confirm}>{children}{request && createPortal(
    <div className="confirm-backdrop" onClick={() => settle(false)}>
      <section className={`confirm-dialog ${request.danger ? 'confirm-danger' : ''}`} role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-description" onClick={e => e.stopPropagation()}>
        <button className="confirm-close" onClick={() => settle(false)} aria-label="Yopish"><X size={18} /></button>
        <span className="confirm-symbol"><ShieldQuestion size={27} /></span>
        <span className="confirm-label">AMALNI TASDIQLASH</span>
        <h2 id="confirm-title">{request.title}</h2>
        <p id="confirm-description">{request.message || 'Haqiqatan ham ushbu amalni bajarmoqchimisiz?'}</p>
        <div className="confirm-actions"><button ref={cancel} className="btn btn-outline" onClick={() => settle(false)}>Bekor qilish</button><button className="btn btn-primary" onClick={() => settle(true)}>{request.action || 'Ha, davom etish'}</button></div>
      </section>
    </div>, document.body)}</Context.Provider>
}
