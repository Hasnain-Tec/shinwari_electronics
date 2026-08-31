import React, { useEffect, useState } from 'react'
import { api, download, unwrap } from '../api'
import { Button, Card, ErrorBox, Input, Modal, PageHeader, Select, Textarea, money, today } from '../components/Ui'

export default function PaymentsPage({ currency='AED' }){
  const [rows, setRows] = useState([])
  const [customers, setCustomers] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [sales, setSales] = useState([])
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  
  // Search query state for customer invoices
  const [saleSearch, setSaleSearch] = useState('')
  
  const [form, setForm] = useState({
    party_type: 'CUSTOMER',
    customer: '',
    supplier: '',
    sale: '',
    date: today(),
    amount: '',
    payment_method: 'CASH',
    reference: '',
    notes: ''
  })

  async function load(){
    try {
      const [p, c, s, sa] = await Promise.all([
        api('/payments/?page_size=100'),
        api('/customers/?page_size=100'),
        api('/suppliers/?page_size=100'),
        api('/sales/?page_size=100')
      ])
      setRows(unwrap(p))
      setCustomers(unwrap(c))
      setSuppliers(unwrap(s))
      setSales(unwrap(sa))
    } catch(e) { setError(e.message) }
  }

  useEffect(() => { load() }, [])

  function openCreate(){
    setEditingId(null)
    setSaleSearch('')
    setForm({party_type:'CUSTOMER', customer:'', supplier:'', sale:'', date:today(), amount:'', payment_method:'CASH', reference:'', notes:''})
    setOpen(true)
  }

  function openEdit(r){
    setEditingId(r.id)
    setSaleSearch('')
    setForm({
      party_type: r.party_type || 'CUSTOMER',
      customer: r.customer ? String(r.customer) : '',
      supplier: r.supplier ? String(r.supplier) : '',
      sale: r.sale ? String(r.sale) : '',
      date: r.date || today(),
      amount: r.amount || '',
      payment_method: r.payment_method || 'CASH',
      reference: r.reference || '',
      notes: r.notes || ''
    })
    setOpen(true)
  }

  async function remove(id){
    if(!window.confirm('Are you sure you want to delete this payment?')) return
    try {
      await api(`/payments/${id}/`, {method:'DELETE'})
      await load()
    } catch(e) { setError(e.message) }
  }

  async function save(e){
    e.preventDefault()
    if (form.party_type === 'CUSTOMER' && !form.sale) {
      setError('Please select an invoice.')
      return
    }
    try {
      const body = {
        ...form,
        customer: form.party_type==='CUSTOMER' && form.customer ? Number(form.customer) : null,
        supplier: form.party_type==='SUPPLIER' && form.supplier ? Number(form.supplier) : null,
        sale: form.party_type==='CUSTOMER' && form.sale ? Number(form.sale) : null
      }
      if(editingId){
        await api(`/payments/${editingId}/`, {method:'PUT', body})
      } else {
        await api('/payments/', {method:'POST', body})
      }
      setOpen(false)
      setForm({party_type:'CUSTOMER', customer:'', supplier:'', sale:'', date:today(), amount:'', payment_method:'CASH', reference:'', notes:''})
      setEditingId(null)
      setSaleSearch('')
      await load()
    } catch(e) { setError(e.message) }
  }

  // Filter sales belonging to selected customer
  const customerSales = sales.filter(x => {
    const customerId = x.customer ?? x.customer_id
    return form.customer && Number(customerId) === Number(form.customer)
  })

  // Search filter matching invoice number or total
  const filteredCustomerSales = customerSales.filter(x => {
    if (!saleSearch.trim()) return true
    const q = saleSearch.toLowerCase()
    const invNo = String(x.invoice_no || '').toLowerCase()
    const total = String(x.total || '')
    return invNo.includes(q) || total.includes(q)
  })

  return (
    <>
      <PageHeader 
        title="Payments" 
        subtitle="Customer receipts and supplier payments" 
        actions={<Button onClick={openCreate}>+ Record Payment</Button>}
      />
      <ErrorBox error={error}/>
      
      <Card>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Receipt</th>
                <th>Date</th>
                <th>Type</th>
                <th>Party</th>
                <th>Method</th>
                <th>Amount</th>
                <th>Reference</th>
                <th/>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id}>
                  <td>{r.receipt_no}</td>
                  <td>{r.date}</td>
                  <td>{r.party_type}</td>
                  <td>{r.customer_name || r.supplier_name || '-'}</td>
                  <td>{r.payment_method}</td>
                  <td>{money(r.amount, currency)}</td>
                  <td>{r.reference || '-'}</td>
                  <td>
                    <button onClick={() => download(`/payments/${r.id}/receipt_pdf/`, `${r.receipt_no}.pdf`)}>PDF</button>{' '}
                    <button onClick={() => openEdit(r)}>Edit</button>{' '}
                    <button onClick={() => remove(r.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={open} title={editingId ? "Edit Payment" : "Record Payment"} onClose={() => setOpen(false)}>
        <form onSubmit={save}>
          <Select 
            label="Payment Type" 
            value={form.party_type} 
            onChange={e => setForm({...form, party_type: e.target.value, customer: '', supplier: '', sale: ''})}
          >
            <option value="CUSTOMER">Customer Receipt</option>
            <option value="SUPPLIER">Supplier Payment</option>
          </Select>

          {form.party_type === 'CUSTOMER' ? (
            <>
              <Select 
                label="Customer" 
                required 
                value={form.customer} 
                onChange={e => {
                  setForm({...form, customer: e.target.value, sale: ''})
                  setSaleSearch('')
                }}
              >
                <option value="">Select customer</option>
                {customers.map(x => (
                  <option key={x.id} value={x.id}>{x.code} — {x.name}</option>
                ))}
              </Select>

              {form.customer && (
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.25rem' }}>
                    Select Invoice *
                  </label>

                  {/* Invoice Search Bar */}
                  <div style={{ marginBottom: '0.5rem' }}>
                    <Input 
                      placeholder="🔍 Search by invoice # or amount..." 
                      value={saleSearch}
                      onChange={e => setSaleSearch(e.target.value)}
                    />
                  </div>

                  {/* Scrollable Custom Selection Box */}
                  <div style={{
                    maxHeight: '180px',
                    overflowY: 'auto',
                    border: '1px solid #ccc',
                    borderRadius: '6px',
                    padding: '6px',
                    background: '#fafafa'
                  }}>
                    {filteredCustomerSales.length > 0 ? (
                      filteredCustomerSales.map(x => {
                        const isSelected = String(form.sale) === String(x.id)
                        return (
                          <div
                            key={x.id}
                            onClick={() => setForm({ ...form, sale: String(x.id), amount: x.total != null ? x.total : form.amount })}
                            style={{
                              padding: '8px 12px',
                              marginBottom: '4px',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              background: isSelected ? '#2563eb' : '#fff',
                              color: isSelected ? '#fff' : '#333',
                              border: isSelected ? '1px solid #2563eb' : '1px solid #e5e7eb'
                            }}
                          >
                            <span><strong>{x.invoice_no}</strong></span>
                            <span>{x.total != null ? money(x.total, currency) : ''}</span>
                          </div>
                        )
                      })
                    ) : (
                      <div style={{ padding: '8px', color: '#888', textAlign: 'center' }}>
                        No invoices found.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <Select 
              label="Supplier" 
              required 
              value={form.supplier} 
              onChange={e => setForm({...form, supplier: e.target.value})}
            >
              <option value="">Select supplier</option>
              {suppliers.map(x => (
                <option key={x.id} value={x.id}>{x.code} — {x.name}</option>
              ))}
            </Select>
          )}

          <Input label="Date" type="date" required value={form.date} onChange={e => setForm({...form, date: e.target.value})}/>
          <Input label="Amount" type="number" min="0.01" step="0.01" required value={form.amount} onChange={e => setForm({...form, amount: e.target.value})}/>
          
          <Select label="Method" value={form.payment_method} onChange={e => setForm({...form, payment_method: e.target.value})}>
            <option value="CASH">Cash</option>
            <option value="BANK">Bank Transfer</option>
            <option value="CARD">Card</option>
            <option value="CHEQUE">Cheque</option>
            <option value="OTHER">Other</option>
          </Select>

          <Input label="Reference" value={form.reference} onChange={e => setForm({...form, reference: e.target.value})}/>
          <Textarea label="Notes" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})}/>

          <div className="modal-actions">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button>{editingId ? "Update Payment" : "Save Payment"}</Button>
          </div>
        </form>
      </Modal>
    </>
  )
}