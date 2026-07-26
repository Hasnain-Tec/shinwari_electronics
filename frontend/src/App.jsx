import React, { useEffect, useState } from 'react'
import { api, getToken, setToken } from './api'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import CustomersPage from './pages/CustomersPage'
import SuppliersPage from './pages/SuppliersPage'
import InventoryPage from './pages/InventoryPage'
import DocumentsPage from './pages/DocumentsPage'
import PaymentsPage from './pages/PaymentsPage'
import ExpensesPage from './pages/ExpensesPage'
import ProfitLossPage from './pages/ProfitLossPage'
import EmployeesPage from './pages/EmployeesPage'
import SettingsPage from './pages/SettingsPage'
import BackupPage from './pages/BackupPage'

export default function App(){
  const [user,setUser]=useState(null),[company,setCompany]=useState(null),[page,setPage]=useState('dashboard'),[checking,setChecking]=useState(!!getToken())
  async function loadCompany(){ try{setCompany(await api('/settings/'))}catch{} }
  useEffect(()=>{ if(!getToken()){setChecking(false);return} Promise.all([api('/auth/me/'),api('/settings/')]).then(([u,c])=>{setUser(u);setCompany(c)}).catch(()=>setToken('')).finally(()=>setChecking(false)) },[])
  async function logout(){ try{await api('/auth/logout/',{method:'POST'})}catch{} setToken('');setUser(null) }
  function loggedIn(u){setUser(u);loadCompany()}
  if(checking) return <div className="splash">Loading MedTrade…</div>
  if(!user) return <LoginPage onLogin={loggedIn}/>
  const currency=company?.currency_symbol||company?.currency_code||'AED'
  let content
  switch(page){
    case 'customers': content=<CustomersPage/>; break
    case 'suppliers': content=<SuppliersPage/>; break
    case 'inventory': content=<InventoryPage/>; break
    case 'sales': content=<DocumentsPage mode="sale" currency={currency}/>; break
    case 'purchases': content=<DocumentsPage mode="purchase" currency={currency}/>; break
    case 'payments': content=<PaymentsPage currency={currency}/>; break
    case 'expenses': content=<ExpensesPage currency={currency}/>; break
    case 'profit': content=<ProfitLossPage currency={currency}/>; break
    case 'employees': content=<EmployeesPage/>; break
    case 'settings': content=<SettingsPage onChanged={setCompany}/>; break
    case 'backup': content=<BackupPage/>; break
    default: content=<DashboardPage currency={currency}/>
  }
  return <Layout page={page} setPage={setPage} user={user} company={company} onLogout={logout}>{content}</Layout>
}
