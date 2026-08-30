import React, { useEffect, useState } from 'react'
import { api, setToken } from '../api'
import { Button, Card, ErrorBox, Input, PageHeader, Select, Textarea } from '../components/Ui'

export default function SettingsPage({ onChanged }) {
  const [form, setForm] = useState(null)
  const [adminForm, setAdminForm] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [adminSaved, setAdminSaved] = useState(false)

  useEffect(() => {
    api('/settings/').then(setForm).catch(e => setError(e.message))
    api('/auth/me/').then(user => setAdminForm({ username: user.username || '', password: '' })).catch(e => setError(e.message))
  }, [])

  async function saveCompany(e) {
    e.preventDefault()
    setSaved(false)
    setError('')
    try {
      const data = await api('/settings/', { method: 'PUT', body: form })
      setForm(data)
      setSaved(true)
      onChanged?.(data)
    } catch (e) {
      setError(e.message)
    }
  }

  async function saveAdmin(e) {
    e.preventDefault()
    setAdminSaved(false)
    setError('')
    try {
      const body = {}
      if (adminForm.username.trim()) body.username = adminForm.username.trim()
      if (adminForm.password.trim()) body.password = adminForm.password.trim()

      if (!body.username && !body.password) {
        setError('Please enter a username or password to update.')
        return
      }

      const res = await api('/auth/me/', { method: 'PUT', body })
      if (res.token) {
        setToken(res.token)
      }
      setAdminForm(prev => ({ ...prev, password: '' }))
      setAdminSaved(true)
    } catch (e) {
      setError(e.message)
    }
  }

  if (!form) return <><PageHeader title="Settings" /><div className="loading">Loading…</div></>

  return (
    <>
      <PageHeader title="Settings" subtitle="Company, currency, signature, admin security and document configuration" />
      <ErrorBox error={error} />

      {saved && <div className="success-box" style={{ marginBottom: '1rem' }}>Company settings saved successfully.</div>}
      {adminSaved && <div className="success-box" style={{ marginBottom: '1rem' }}>Admin credentials updated successfully.</div>}

      {/* Admin Account Credentials Form */}
      <Card>
        <h3>Admin Account Credentials</h3>
        <form onSubmit={saveAdmin}>
          <div className="form-grid">
            <Input
              label="Admin Username"
              value={adminForm.username}
              onChange={e => setAdminForm({ ...adminForm, username: e.target.value })}
              placeholder="Enter new username"
            />
            <Input
              label="New Password"
              type="password"
              value={adminForm.password}
              onChange={e => setAdminForm({ ...adminForm, password: e.target.value })}
              placeholder="Leave blank to keep current password"
            />
          </div>
          <div style={{ marginTop: '1rem', textAlign: 'right' }}>
            <Button type="submit">Update Admin Credentials</Button>
          </div>
        </form>
      </Card>

      {/* Company Settings Form */}
      <form onSubmit={saveCompany}>
        <Card>
          <h3>Company Details</h3>
          <div className="form-grid">
            <Input label="Company Name" value={form.company_name || ''} onChange={e => setForm({ ...form, company_name: e.target.value })} />
            <Input label="Phone" value={form.phone || ''} onChange={e => setForm({ ...form, phone: e.target.value })} />
            <Input label="Email" type="email" value={form.email || ''} onChange={e => setForm({ ...form, email: e.target.value })} />
            <Input label="TRN / Tax No" value={form.trn || ''} onChange={e => setForm({ ...form, trn: e.target.value })} />
            <Textarea label="Address" value={form.address || ''} onChange={e => setForm({ ...form, address: e.target.value })} />
          </div>
        </Card>

        <Card>
          <h3>Authorized Signature & Stamp</h3>
          <div className="form-grid">
            <Input label="Signatory Name" value={form.signature_name || ''} onChange={e => setForm({ ...form, signature_name: e.target.value })} placeholder="e.g. Authorized Signatory" />
            <Input label="Signature Image URL" value={form.signature_url || ''} onChange={e => setForm({ ...form, signature_url: e.target.value })} placeholder="https://... or /media/..." />
          </div>
          {form.signature_url && (
            <div style={{ marginTop: '1rem' }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>Signature Preview:</p>
              <img src={form.signature_url} alt="Signature Preview" style={{ maxHeight: '80px', border: '1px dashed #ccc', padding: '4px' }} />
            </div>
          )}
        </Card>

        <Card>
          <h3>Currency & Tax</h3>
          <div className="form-grid">
            <Select label="Currency Code" value={form.currency_code || 'AED'} onChange={e => setForm({ ...form, currency_code: e.target.value, currency_symbol: e.target.value === 'USD' ? '$' : e.target.value })}>
              <option value="AED">AED</option>
              <option value="USD">USD</option>
              <option value="PKR">PKR</option>
              <option value="SAR">SAR</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
            </Select>
            <Input label="Currency Symbol" value={form.currency_symbol || ''} onChange={e => setForm({ ...form, currency_symbol: e.target.value })} />
            <Input label="Default VAT %" type="number" step="0.01" value={form.default_vat || ''} onChange={e => setForm({ ...form, default_vat: e.target.value })} />
          </div>
        </Card>

        <Card>
          <h3>Document Numbers</h3>
          <div className="form-grid">
            <Input label="Invoice Prefix" value={form.invoice_prefix || ''} onChange={e => setForm({ ...form, invoice_prefix: e.target.value })} />
            <Input label="Purchase Prefix" value={form.purchase_prefix || ''} onChange={e => setForm({ ...form, purchase_prefix: e.target.value })} />
            <Input label="Receipt Prefix" value={form.receipt_prefix || ''} onChange={e => setForm({ ...form, receipt_prefix: e.target.value })} />
            <Textarea label="Invoice Terms" value={form.terms || ''} onChange={e => setForm({ ...form, terms: e.target.value })} />
          </div>
        </Card>

        <Card>
          <h3>Bank Details</h3>
          <div className="form-grid">
            <Input label="Bank Name" value={form.bank_name || ''} onChange={e => setForm({ ...form, bank_name: e.target.value })} />
            <Input label="Account Title" value={form.account_title || ''} onChange={e => setForm({ ...form, account_title: e.target.value })} />
            <Input label="Account Number" value={form.account_number || ''} onChange={e => setForm({ ...form, account_number: e.target.value })} />
            <Input label="IBAN" value={form.iban || ''} onChange={e => setForm({ ...form, iban: e.target.value })} />
          </div>
        </Card>

        <div className="save-bar">
          <Button type="submit">Save All Company Settings</Button>
        </div>
      </form>
    </>
  )
}