import React, { useState } from 'react'
import logoImg from '../assets/shinwari-logo.jpeg'

const items = [
  ['dashboard','Dashboard','▦'], ['customers','Customers','◎'], ['suppliers','Suppliers','◇'],
  ['inventory','Inventory','▣'], ['sales','Sales','↗'], ['purchases','Purchases','↙'],
  ['payments','Payments','¤'], ['expenses','Expenses','−'], ['profit','Profit & Loss','∑'],
  ['employees','Employees','♙'], ['settings','Settings','⚙'], ['backup','Backup','⇩']
]

export default function Layout({ page, setPage, user, company, onLogout, children }) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return <div className="app-shell">
    <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
      <div className="brand">
        <div className="brand-logo-wrap">
          <img
            src={logoImg}
            alt="Shinwari Electronics and Decoration"
            className="brand-logo"
          />
        </div>

        <div className="brand-text">
          <strong>{company?.company_name || 'Shinwari Electronics'}</strong>
          <small>and Decoration</small>
        </div>
      </div>


      <nav>
        {items.map(([id,label,icon]) =>
          <button
            key={id}
            className={page === id ? 'active' : ''}
            onClick={() => {
              setPage(id)
              setMobileOpen(false)
            }}
          >
            <span>{icon}</span>
            {label}
          </button>
        )}
      </nav>

      <div className="sidebar-user">
        <div className="avatar">
          {(user?.username || 'U')[0].toUpperCase()}
        </div>

        <div>
          <strong>{user?.username}</strong>
          <small>{user?.role || 'User'}</small>
        </div>
      </div>
    </aside>

    <div className="main-area">
      <header className="topbar">
        <button
          className="menu-btn"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          ☰
        </button>

        <div className="topbar-spacer"/>

        <span className="currency-pill">
          {company?.currency_code || 'AED'}
        </span>

        <button
          className="btn btn-ghost"
          onClick={onLogout}
        >
          Logout
        </button>
      </header>

      <main className="content">
        {children}
      </main>
    </div>

    {mobileOpen &&
      <div
        className="mobile-overlay"
        onClick={() => setMobileOpen(false)}
      />
    }
  </div>
}