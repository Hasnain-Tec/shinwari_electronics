import React, { useEffect, useState } from 'react'
import { api } from '../api'
import { Card, ErrorBox, PageHeader, money } from '../components/Ui'

export default function DashboardPage({ currency }){
 const [data,setData]=useState(null),[error,setError]=useState(''),[trendView,setTrendView]=useState('month')

 useEffect(()=>{api('/dashboard/').then(setData).catch(e=>setError(e.message))},[])

 if(!data) return <><PageHeader title="Dashboard" subtitle="Live business overview"/><ErrorBox error={error}/><div className="loading">Loading…</div></>

 const cards=[
  ['Sales Today',data.sales_today],
  ['Sales This Month',data.sales_month],
  ['Purchases This Month',data.purchases_month],
  ['Expenses This Month',data.expenses_month],
  ['Customer Receivables',data.receivables],
  ['Net Profit This Month',data.net_profit_month]
 ]

 const trendSource=data.trend||[]

 const lastDays=(days)=>trendSource.slice(-days)

 const groupWeeks=(items)=>{
  return Object.values(items.reduce((acc,x,i)=>{
   const key=`Week ${Math.floor(i/7)+1}`
   acc[key]=acc[key]||{date:key,sales:0}
   acc[key].sales+=Number(x.sales||0)
   return acc
  },{}))
 }

 const groupMonths=(items)=>{
  return Object.values(items.reduce((acc,x)=>{
   const key=x.date.slice(0,7)
   acc[key]=acc[key]||{date:key,sales:0}
   acc[key].sales+=Number(x.sales||0)
   return acc
  },{})).slice(-6)
 }

 const trendData=
  trendView==='day'
   ? lastDays(7)
   : trendView==='week'
    ? groupWeeks(lastDays(28))
    : trendView==='six'
     ? groupMonths(trendSource)
     : lastDays(30)

 const max=Math.max(...trendData.map(x=>Number(x.sales)),1)

 return <>
  <PageHeader title="Dashboard" subtitle="Live business overview"/>

  <div className="stats-grid">
   {cards.map(([label,val])=>
    <Card key={label} className="stat-card">
     <span>{label}</span>
     <strong>{money(val,currency)}</strong>
    </Card>
   )}
  </div>

  <div className="dashboard-grid">
   <Card>
    <div className="trend-head">
     <h3>Sales Trend</h3>

     <div className="trend-tabs">
      <button className={trendView==='day'?'active':''} onClick={()=>setTrendView('day')}>
       Day
      </button>

      <button className={trendView==='week'?'active':''} onClick={()=>setTrendView('week')}>
       Week
      </button>

      <button className={trendView==='month'?'active':''} onClick={()=>setTrendView('month')}>
       1 Month
      </button>

      <button className={trendView==='six'?'active':''} onClick={()=>setTrendView('six')}>
       6 Months
      </button>
     </div>
    </div>

    <div className="bars">
     {trendData.map(x=>
      <div className="bar-col" key={x.date} title={`${x.date}: ${money(x.sales,currency)}`}>
       <div className="bar" style={{height:`${Math.max(4,Number(x.sales)/max*140)}px`}}/>
       <small>{trendView==='day'||trendView==='month' ? x.date.slice(5) : x.date}</small>
      </div>
     )}
    </div>
   </Card>

   <Card>
    <h3>Low Stock Alerts</h3>
    {data.low_stock.length?
     data.low_stock.map(p=>
      <div className="list-row" key={p.id}>
       <div>
        <strong>{p.name}</strong>
        <small>{p.sku}</small>
       </div>
       <span className="badge danger">{p.current_stock} {p.unit}</span>
      </div>
     )
     :
     <p className="muted">No low-stock products.</p>
    }
   </Card>
  </div>

  <Card>
   <h3>Recent Sales</h3>

   <div className="table-wrap">
    <table>
     <thead>
      <tr>
       <th>Invoice</th>
       <th>Date</th>
       <th>Customer</th>
       <th>Status</th>
       <th>Total</th>
      </tr>
     </thead>

     <tbody>
      {data.recent_sales.map(s=>
       <tr key={s.id}>
        <td>{s.invoice_no}</td>
        <td>{s.date}</td>
        <td>{s.customer_name||'Walk-in'}</td>
        <td><span className="badge">{s.status}</span></td>
        <td>{money(s.total,currency)}</td>
       </tr>
      )}
     </tbody>
    </table>
   </div>
  </Card>
 </>
}