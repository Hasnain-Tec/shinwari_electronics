import React, { useEffect, useState } from 'react'
import { api } from '../api'
import { Button, Card, ErrorBox, Input, PageHeader, money, today } from '../components/Ui'

export default function ProfitLossPage({ currency='AED' }){
 const now=new Date(), first=new Date(now.getFullYear(),now.getMonth(),1).toISOString().slice(0,10)
 const [range,setRange]=useState({date_from:first,date_to:today()}),[data,setData]=useState(null),[error,setError]=useState('')
 async function load(){try{setData(await api(`/profit-loss/?date_from=${range.date_from}&date_to=${range.date_to}`))}catch(e){setError(e.message)}} useEffect(()=>{load()},[])
 return <><PageHeader title="Profit & Loss" subtitle="Revenue, cost of goods and operating expenses"/><Card><div className="filter-row"><Input label="From" type="date" value={range.date_from} onChange={e=>setRange({...range,date_from:e.target.value})}/><Input label="To" type="date" value={range.date_to} onChange={e=>setRange({...range,date_to:e.target.value})}/><Button onClick={load}>Run Report</Button></div><ErrorBox error={error}/></Card>{data&&<div className="pnl-grid"><Card className="pnl-card"><span>Sales Revenue (excl. VAT)</span><strong>{money(data.revenue,currency)}</strong></Card><Card className="pnl-card"><span>Cost of Goods Sold</span><strong>- {money(data.cogs,currency)}</strong></Card><Card className="pnl-card highlight"><span>Gross Profit</span><strong>{money(data.gross_profit,currency)}</strong></Card><Card className="pnl-card"><span>Operating Expenses</span><strong>- {money(data.expenses,currency)}</strong></Card><Card className={`pnl-card grand ${Number(data.net_profit)<0?'negative':''}`}><span>Net Profit</span><strong>{money(data.net_profit,currency)}</strong></Card></div>}</>
}
