import React, { useState } from 'react'
import { api, setToken } from '../api'
import { Button, ErrorBox, Input } from '../components/Ui'
import logoImg from '../assets/shinwari-logo.jpeg'

export default function LoginPage({ onLogin }) {
  const [form, setForm] = useState({ username: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const data = await api('/auth/login/', { method: 'POST', body: form })
      setToken(data.token)
      onLogin(data.user)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-panel">
        <div className="login-logo-wrap" style={{ textAlign: 'center', marginBottom: '1rem' }}>
          <img
            src={logoImg}
            alt="Shinwari Electronics and Decoration"
            style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border)' }}
          />
        </div>
        <h1 style={{ fontSize: '1.25rem', textAlign: 'center', marginBottom: '0.25rem' }}>Shinwari Electronics and Decoration</h1>
        <p style={{ textAlign: 'center', color: 'var(--muted)', marginBottom: '1.5rem', fontSize: '0.875rem' }}>Business Management Portal</p>
        <form onSubmit={submit}>
          <Input
            label="Username"
            value={form.username}
            onChange={e => setForm({ ...form, username: e.target.value })}
            placeholder="Enter username"
            required
          />
          <Input
            label="Password"
            type="password"
            value={form.password}
            onChange={e => setForm({ ...form, password: e.target.value })}
            placeholder="Enter password"
            required
          />
          <ErrorBox error={error} />
          <Button disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </div>
    </div>
  )
}