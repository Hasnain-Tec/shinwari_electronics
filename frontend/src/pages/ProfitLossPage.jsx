import React, { useEffect, useState } from 'react'
import { api } from '../api'
import { Button, Card, ErrorBox, Input, PageHeader, money, today } from '../components/Ui'

export default function ProfitLossPage({ currency = 'AED' }) {
  // Set default date range: From 1st of current month to Today
  const now = new Date()
  const first = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)

  const [range, setRange] = useState({ date_from: first, date_to: today() })
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const query = `?date_from=${range.date_from}&date_to=${range.date_to}`

      // Fetch sales and expenses for the selected date range
      const [salesRes, expensesRes] = await Promise.all([
        api(`/sales/${query}`),
        api(`/expenses/${query}`)
      ])

      const salesList = Array.isArray(salesRes) ? salesRes : (salesRes.results || [])
      const expensesList = Array.isArray(expensesRes) ? expensesRes : (expensesRes.results || [])

      let revenue = 0
      let cogs = 0

      // Calculate Revenue & Cost of Goods Sold from Confirmed Sales
      salesList.forEach((sale) => {
        if (sale.status === 'CANCELLED') return

        // 1. Net Revenue (excl. VAT) = Subtotal - Discounts
        const subtotal = parseFloat(sale.subtotal || 0)
        const discountTotal = parseFloat(sale.discount_total || 0)
        revenue += (subtotal - discountTotal)

        // 2. COGS = sum of (quantity * cost_price) for each item in the sale
        const items = sale.items || []
        items.forEach((item) => {
          const qty = parseFloat(item.quantity || 0)
          const cost = parseFloat(item.cost_price || 0)
          cogs += (qty * cost)
        })
      })

      // 3. Operating Expenses sum
      const expenses = expensesList.reduce((acc, exp) => {
        return acc + parseFloat(exp.amount || 0)
      }, 0)

      // 4. Gross and Net Profit calculations
      const gross_profit = revenue - cogs
      const net_profit = gross_profit - expenses

      setData({
        revenue,
        cogs,
        gross_profit,
        expenses,
        net_profit
      })
    } catch (e) {
      setError(e.message || 'Failed to fetch profit & loss data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <>
      <PageHeader 
        title="Profit & Loss" 
        subtitle="Revenue, cost of goods and operating expenses" 
      />

      <Card>
        <div className="filter-row">
          <Input 
            label="From" 
            type="date" 
            value={range.date_from} 
            onChange={e => setRange({ ...range, date_from: e.target.value })} 
          />
          <Input 
            label="To" 
            type="date" 
            value={range.date_to} 
            onChange={e => setRange({ ...range, date_to: e.target.value })} 
          />
          <Button onClick={load} disabled={loading}>
            {loading ? 'Calculating...' : 'Run Report'}
          </Button>
        </div>
        <ErrorBox error={error} />
      </Card>

      {data && (
        <div className="pnl-grid">
          <Card className="pnl-card">
            <span>Sales Revenue (excl. VAT)</span>
            <strong>{money(data.revenue, currency)}</strong>
          </Card>

          <Card className="pnl-card">
            <span>Cost of Goods Sold</span>
            <strong>- {money(data.cogs, currency)}</strong>
          </Card>

          <Card className="pnl-card highlight">
            <span>Gross Profit</span>
            <strong>{money(data.gross_profit, currency)}</strong>
          </Card>

          <Card className="pnl-card">
            <span>Operating Expenses</span>
            <strong>- {money(data.expenses, currency)}</strong>
          </Card>

          <Card className={`pnl-card grand ${Number(data.net_profit) < 0 ? 'negative' : ''}`}>
            <span>Net Profit</span>
            <strong>{money(data.net_profit, currency)}</strong>
          </Card>
        </div>
      )}
    </>
  )
}