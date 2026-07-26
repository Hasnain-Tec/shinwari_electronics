import React from 'react'

export function Card({ children, className = '' }) { return <div className={`card ${className}`}>{children}</div> }
export function PageHeader({ title, subtitle, actions }) {
  return <div className="page-header"><div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div><div className="page-actions">{actions}</div></div>
}
export function Button({ children, variant = 'primary', className = '', ...props }) {
  return <button className={`btn btn-${variant} ${className}`} {...props}>{children}</button>
}
export function Input({ label, ...props }) { return <label className="field"><span>{label}</span><input {...props} /></label> }
export function Select({ label, children, ...props }) { return <label className="field"><span>{label}</span><select {...props}>{children}</select></label> }
export function Textarea({ label, ...props }) { return <label className="field"><span>{label}</span><textarea {...props} /></label> }
export function Modal({ open, title, onClose, children, wide = false }) {
  if (!open) return null
  return <div className="modal-backdrop" onMouseDown={onClose}><div className={`modal ${wide ? 'modal-wide' : ''}`} onMouseDown={e => e.stopPropagation()}><div className="modal-head"><h2>{title}</h2><button className="icon-btn" onClick={onClose}>×</button></div><div className="modal-body">{children}</div></div></div>
}
export function Loading() { return <div className="loading">Loading…</div> }
export function Empty({ text = 'No records found.' }) { return <div className="empty">{text}</div> }
export function ErrorBox({ error }) { return error ? <div className="error-box">{String(error)}</div> : null }
export function money(value, currency = 'AED') { return `${currency} ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` }
export function today() { return new Date().toISOString().slice(0, 10) }
