import React, { useEffect, useMemo, useState } from 'react'
import { api, download, previewPdf, unwrap } from '../api'
import { Button, Card, ErrorBox, Input, Modal, PageHeader, Select, Textarea, money, today } from '../components/Ui'

export default function DocumentsPage({ mode='sale', currency='AED' }){
  const isSale = mode === 'sale'
  const endpoint = isSale ? '/sales/' : '/purchases/'
  const [docs, setDocs] = useState([])
  const [parties, setParties] = useState([])
  const [products, setProducts] = useState([])
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)
  const [invoiceReady, setInvoiceReady] = useState(null)
  const blank = { party:'', date:today(), payment_mode:'CREDIT', amount_paid:'0', notes:'', items:[] }
  const [form, setForm] = useState(blank)

  async function load(){
    try {
      const [d,p,pr] = await Promise.all([
        api(`${endpoint}?page_size=100`),
        api(isSale ? '/customers/?page_size=100' : '/suppliers/?page_size=100'),
        api('/products/?page_size=100')
      ])
      setDocs(unwrap(d)); setParties(unwrap(p)); setProducts(unwrap(pr))
    } catch(e){ setError(e.message) }
  }

  useEffect(() => { load() }, [mode])

  function addItem(){
    setForm({...form, items:[...form.items, {product:'', quantity:'1', price:'0', discount:'0', vat_rate:'0'}]})
  }

  function setItem(i,key,value){
    const items = form.items.map((x,idx) => idx === i ? {...x,[key]:value} : x)
    if(key === 'product'){
      const p = products.find(p => String(p.id) === String(value))
      if(p) items[i] = {...items[i], product:value, price:isSale ? p.selling_price : p.purchase_price, vat_rate:p.vat_rate}
    }
    setForm({...form,items})
  }

  function removeItem(i){ setForm({...form,items:form.items.filter((_,idx)=>idx!==i)}) }

  const totals = useMemo(() => form.items.reduce((a,i) => {
    const gross = Number(i.quantity||0) * Number(i.price||0)
    const disc = Number(i.discount||0)
    const taxable = Math.max(0,gross-disc)
    const vat = taxable * Number(i.vat_rate||0) / 100
    return {sub:a.sub+gross,disc:a.disc+disc,vat:a.vat+vat,total:a.total+taxable+vat}
  }, {sub:0,disc:0,vat:0,total:0}), [form.items])

  async function save(e){
    e.preventDefault()
    try {
      setError('')
      const body = {
        date:form.date,
        payment_mode:form.payment_mode,
        amount_paid:form.amount_paid||0,
        notes:form.notes,
        items:form.items.map(i => ({
          product:Number(i.product),
          quantity:i.quantity,
          [isSale?'unit_price':'unit_cost']:i.price,
          discount:i.discount||0,
          vat_rate:i.vat_rate||0
        }))
      }
      body[isSale?'customer':'supplier'] = form.party ? Number(form.party) : null
      const created = await api(endpoint,{method:'POST',body})
      setOpen(false)
      setForm(blank)
      await load()
      if(isSale) setInvoiceReady(created)
    } catch(e){ setError(e.message) }
  }

  async function previewInvoice(d){
    try { setError(''); await previewPdf(`/sales/${d.id}/invoice_pdf/`) }
    catch(e){ setError(e.message) }
  }

  async function downloadInvoice(d){
    try { setError(''); await download(`/sales/${d.id}/invoice_pdf/`,`${d.invoice_no}.pdf`) }
    catch(e){ setError(e.message) }
  }

  async function cancelDoc(d){
    if(!confirm(`Cancel ${isSale?d.invoice_no:d.purchase_no}? Stock will be reversed.`)) return
    try { await api(`${endpoint}${d.id}/cancel/`,{method:'POST'}); await load() }
    catch(e){ setError(e.message) }
  }

  return <>
    <PageHeader
      title={isSale?'Sales & Invoices':'Purchases'}
      subtitle={isSale?'Create a sale, reduce stock, then preview or download a professional PDF invoice':'Record supplier purchases and automatically increase stock'}
      actions={<Button onClick={()=>{setForm({...blank,items:[]});setOpen(true)}}>+ New {isSale?'Sale / Invoice':'Purchase'}</Button>}
    />
    <ErrorBox error={error}/>

    {isSale && <Card>
      <div className="invoice-help">
        <div>
          <strong>Invoice workflow</strong>
          <p>Create a sale first. The system saves the transaction, reduces stock, assigns an invoice number, and immediately offers PDF preview and download.</p>
        </div>
      </div>
    </Card>}

    <Card>
      <div className="table-wrap"><table>
        <thead><tr>
          <th>No</th><th>Date</th><th>{isSale?'Customer':'Supplier'}</th><th>Payment</th><th>Status</th><th>Total</th><th>Paid</th><th>Balance</th><th>Actions</th>
        </tr></thead>
        <tbody>{docs.map(d => <tr key={d.id}>
          <td><strong>{isSale?d.invoice_no:d.purchase_no}</strong></td>
          <td>{d.date}</td>
          <td>{isSale?(d.customer_name||'Walk-in'):(d.supplier_name||'-')}</td>
          <td>{d.payment_mode}</td>
          <td><span className={`badge ${d.status==='CANCELLED'?'danger':'success'}`}>{d.status}</span></td>
          <td>{money(d.total,currency)}</td>
          <td>{money(d.amount_paid,currency)}</td>
          <td>{money(d.balance_due,currency)}</td>
          <td className="actions">
            {isSale && <>
              <button className="invoice-action" onClick={()=>previewInvoice(d)}>Preview Invoice</button>
              <button className="invoice-action" onClick={()=>downloadInvoice(d)}>Download PDF</button>
            </>}
            {d.status!=='CANCELLED' && <button className="danger-link" onClick={()=>cancelDoc(d)}>Cancel</button>}
          </td>
        </tr>)}</tbody>
      </table></div>
    </Card>

    <Modal open={open} title={`New ${isSale?'Sale & Invoice':'Purchase'}`} onClose={()=>setOpen(false)} wide>
      <form onSubmit={save}>
        <div className="form-grid">
          <Select label={isSale?'Customer':'Supplier'} value={form.party} onChange={e=>setForm({...form,party:e.target.value})}>
            <option value="">{isSale?'Walk-in / No customer':'No supplier'}</option>
            {parties.map(p=><option value={p.id} key={p.id}>{p.code} — {p.name}</option>)}
          </Select>
          <Input label="Date" type="date" required value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/>
          <Select label="Payment Mode" value={form.payment_mode} onChange={e=>setForm({...form,payment_mode:e.target.value})}>
            <option value="CREDIT">Credit</option><option value="CASH">Cash</option><option value="BANK">Bank Transfer</option><option value="CARD">Card</option><option value="CHEQUE">Cheque</option>
          </Select>
          <Input label="Amount Paid" type="number" step="0.01" min="0" value={form.amount_paid} onChange={e=>setForm({...form,amount_paid:e.target.value})}/>
        </div>
        <Textarea label="Notes / Remark" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/>

        <div className="line-items">
          <div className="line-head"><h3>Invoice Items</h3><Button type="button" variant="secondary" onClick={addItem}>+ Add Item</Button></div>
          {form.items.map((i,idx)=><div className="line-item" key={idx}>
            <Select label="Product" required value={i.product} onChange={e=>setItem(idx,'product',e.target.value)}>
              <option value="">Select product</option>
              {products.map(p=><option value={p.id} key={p.id}>{p.sku} — {p.name}{isSale?` (Stock ${p.current_stock})`:''}</option>)}
            </Select>
            <Input label="Qty" type="number" min="0.001" step="0.001" required value={i.quantity} onChange={e=>setItem(idx,'quantity',e.target.value)}/>
            <Input label={isSale?'Unit Price':'Unit Cost'} type="number" min="0" step="0.01" required value={i.price} onChange={e=>setItem(idx,'price',e.target.value)}/>
            <Input label="Discount" type="number" min="0" step="0.01" value={i.discount} onChange={e=>setItem(idx,'discount',e.target.value)}/>
            <Input label="VAT %" type="number" min="0" step="0.01" value={i.vat_rate} onChange={e=>setItem(idx,'vat_rate',e.target.value)}/>
            <button type="button" className="remove-line" onClick={()=>removeItem(idx)}>×</button>
          </div>)}
          {!form.items.length && <div className="empty">Add at least one product to generate an invoice.</div>}
        </div>

        <div className="doc-summary">
          <span>Sub Total <strong>{money(totals.sub,currency)}</strong></span>
          <span>Discount <strong>{money(totals.disc,currency)}</strong></span>
          <span>VAT <strong>{money(totals.vat,currency)}</strong></span>
          <span className="grand">Invoice Total <strong>{money(totals.total,currency)}</strong></span>
        </div>

        <div className="modal-actions">
          <Button type="button" variant="ghost" onClick={()=>setOpen(false)}>Cancel</Button>
          <Button disabled={!form.items.length}>{isSale?'Save Sale & Generate Invoice':'Save Purchase'}</Button>
        </div>
      </form>
    </Modal>

    <Modal open={!!invoiceReady} title="Invoice Generated Successfully" onClose={()=>setInvoiceReady(null)}>
      {invoiceReady && <div className="invoice-ready">
        <div className="invoice-ready-number">{invoiceReady.invoice_no}</div>
        <p>The sale is saved, stock has been updated, and your English-only PDF invoice is ready.</p>
        <div className="invoice-ready-totals">
          <span>Total <strong>{money(invoiceReady.total,currency)}</strong></span>
          <span>Paid <strong>{money(invoiceReady.amount_paid,currency)}</strong></span>
          <span>Balance <strong>{money(invoiceReady.balance_due,currency)}</strong></span>
        </div>
        <div className="modal-actions">
          <Button variant="secondary" onClick={()=>previewInvoice(invoiceReady)}>Preview Invoice</Button>
          <Button onClick={()=>downloadInvoice(invoiceReady)}>Download PDF</Button>
        </div>
      </div>}
    </Modal>
  </>
}
