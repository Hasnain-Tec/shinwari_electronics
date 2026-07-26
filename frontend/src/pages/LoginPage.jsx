import React, { useState } from 'react'
import { api, setToken } from '../api'
import { Button, ErrorBox, Input } from '../components/Ui'

export default function LoginPage({ onLogin }) {
  const [form, setForm] = useState({ username: 'admin', password: 'admin123' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  async function submit(e) {
    e.preventDefault(); setLoading(true); setError('')
    try { const data = await api('/auth/login/', { method:'POST', body:form }); setToken(data.token); onLogin(data.user) }
    catch (err) { setError(err.message) } finally { setLoading(false) }
  }
  return <div className="login-page"><div className="login-panel"><div className="login-logo">M</div><h1>MedTrade Inventory</h1><p>Secure local business management</p><form onSubmit={submit}><Input label="Username" value={form.username} onChange={e=>setForm({...form,username:e.target.value})}/><Input label="Password" type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/><ErrorBox error={error}/><Button disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</Button></form><small>Default test login: admin / admin123</small></div></div>
}
