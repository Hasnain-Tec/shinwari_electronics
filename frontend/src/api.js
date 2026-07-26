const API_BASE = import.meta.env.VITE_API_URL || '/api'
export function getToken() { return localStorage.getItem('medtrade_token') || '' }
export function setToken(token) { token ? localStorage.setItem('medtrade_token', token) : localStorage.removeItem('medtrade_token') }
export function unwrap(data) { return Array.isArray(data) ? data : (data?.results || []) }

export async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) }
  const token = getToken()
  if (token) headers.Authorization = `Token ${token}`
  if (options.body && !(options.body instanceof FormData) && typeof options.body !== 'string') {
    headers['Content-Type'] = 'application/json'
    options.body = JSON.stringify(options.body)
  }
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers })
  const contentType = response.headers.get('content-type') || ''
  if (!response.ok) {
    let detail = `Request failed (${response.status})`
    try {
      const body = contentType.includes('json') ? await response.json() : await response.text()
      detail = typeof body === 'string' ? body : (body.detail || JSON.stringify(body))
    } catch {}
    throw new Error(detail)
  }
  if (response.status === 204) return null
  return contentType.includes('json') ? response.json() : response.blob()
}

export async function download(path, filename) {
  const blob = await api(path)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove()
  URL.revokeObjectURL(url)
}

export async function previewPdf(path) {
  const blob = await api(path)
  const url = URL.createObjectURL(blob)
  const win = window.open(url, '_blank', 'noopener,noreferrer')
  if (!win) {
    URL.revokeObjectURL(url)
    throw new Error('Popup blocked. Please allow popups to preview the PDF.')
  }
  // Keep the object URL alive long enough for the new tab to load the PDF.
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
