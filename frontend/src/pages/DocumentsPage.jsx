import React, { useEffect, useMemo, useRef, useState } from 'react'
import { api, download, previewPdf, unwrap } from '../api'
import { Button, Card, ErrorBox, Input, Modal, PageHeader, Select, Textarea, money, today } from '../components/Ui'

export default function DocumentsPage({ mode = 'sale', currency = 'AED' }) {
  const isSale = mode === 'sale'
  const endpoint = isSale ? '/sales/' : '/purchases/'

  const [docs, setDocs] = useState([])
  const [parties, setParties] = useState([])
  const [products, setProducts] = useState([])
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [invoiceReady, setInvoiceReady] = useState(null)

  // Document table search state
  const [docSearch, setDocSearch] = useState('')

  const [productDropdown, setProductDropdown] = useState(null)
  const [productSearch, setProductSearch] = useState('')
  const [partyDropdown, setPartyDropdown] = useState(false)
  const [partySearch, setPartySearch] = useState('')

  // Get current date string in YYYY-MM-DD
  const getCurrentDate = () => new Date().toISOString().split('T')[0]

  const blank = {
    party: '',
    date: getCurrentDate(),
    payment_mode: 'CREDIT',
    amount_paid: '0',
    notes: '',
    items: []
  }

  const [form, setForm] = useState(blank)

  const productDropdownRef = useRef(null)
  const partyDropdownRef = useRef(null)

  async function load() {
    try {
      // Increased page_size from 100 to 1000 to handle large inventories/parties/documents
      const [d, p, pr] = await Promise.all([
        api(`${endpoint}?page_size=1000`),
        api(isSale ? '/customers/?page_size=1000' : '/suppliers/?page_size=1000'),
        api('/products/?page_size=1000')
      ])
      setDocs(unwrap(d))
      setParties(unwrap(p))
      setProducts(unwrap(pr))
    } catch (e) {
      setError(e.message)
    }
  }

  useEffect(() => {
    load()
  }, [mode])

  useEffect(() => {
    function handleClickOutside(e) {
      if (productDropdownRef.current && !productDropdownRef.current.contains(e.target)) {
        setProductDropdown(null)
        setProductSearch('')
      }
      if (partyDropdownRef.current && !partyDropdownRef.current.contains(e.target)) {
        setPartyDropdown(false)
        setPartySearch('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function addItem() {
    setForm({
      ...form,
      items: [
        ...form.items,
        { product: '', quantity: '1', price: '0', discount: '0', vat_rate: '0' }
      ]
    })
  }

  function setItem(i, key, value) {
    const items = form.items.map((x, idx) => (idx === i ? { ...x, [key]: value } : x))

    if (key === 'product') {
      const p = products.find(prod => String(prod.id) === String(value))
      if (p) {
        items[i] = {
          ...items[i],
          product: value,
          price: isSale ? p.selling_price : p.purchase_price,
          vat_rate: p.vat_rate
        }
      }
    }
    setForm({ ...form, items })
  }

  function removeItem(i) {
    setForm({ ...form, items: form.items.filter((_, idx) => idx !== i) })
    if (productDropdown === i) {
      setProductDropdown(null)
      setProductSearch('')
    }
  }

  const totals = useMemo(
    () =>
      form.items.reduce(
        (a, i) => {
          const gross = Number(i.quantity || 0) * Number(i.price || 0)
          const disc = Number(i.discount || 0)
          const taxable = Math.max(0, gross - disc)
          const vat = (taxable * Number(i.vat_rate || 0)) / 100
          return {
            sub: a.sub + gross,
            disc: a.disc + disc,
            vat: a.vat + vat,
            total: a.total + taxable + vat
          }
        },
        { sub: 0, disc: 0, vat: 0, total: 0 }
      ),
    [form.items]
  )

  function editDoc(d) {
    setEditingId(d.id)
    setForm({
      party: isSale ? d.customer || '' : d.supplier || '',
      date: d.date || getCurrentDate(),
      payment_mode: d.payment_mode || 'CREDIT',
      amount_paid: d.amount_paid || '0',
      notes: d.notes || '',
      items: (d.items || []).map(i => ({
        product: String(i.product || i.product_id || ''),
        quantity: String(i.quantity || 1),
        price: String(i.unit_price || i.unit_cost || i.price || 0),
        discount: String(i.discount || 0),
        vat_rate: String(i.vat_rate || 0)
      }))
    })
    setProductDropdown(null)
    setProductSearch('')
    setPartyDropdown(false)
    setPartySearch('')
    setOpen(true)
  }

  async function save(e) {
    e.preventDefault()
    try {
      setError('')
      const body = {
        date: form.date || getCurrentDate(),
        payment_mode: form.payment_mode,
        amount_paid: form.amount_paid || 0,
        notes: form.notes,
        items: form.items.map(i => ({
          product: Number(i.product),
          quantity: i.quantity,
          [isSale ? 'unit_price' : 'unit_cost']: i.price,
          discount: i.discount || 0,
          vat_rate: i.vat_rate || 0
        }))
      }
      body[isSale ? 'customer' : 'supplier'] = form.party ? Number(form.party) : null

      const method = editingId ? 'PUT' : 'POST'
      const url = editingId ? `${endpoint}${editingId}/` : endpoint
      const created = await api(url, { method, body })

      setOpen(false)
      setEditingId(null)
      setForm({ ...blank, date: getCurrentDate() })
      setProductDropdown(null)
      setProductSearch('')
      setPartyDropdown(false)
      setPartySearch('')
      await load()

      if (isSale && !editingId) {
        setInvoiceReady(created)
      }
    } catch (e) {
      setError(e.message)
    }
  }

  async function previewInvoice(d) {
    try {
      setError('')
      await previewPdf(`/sales/${d.id}/invoice_pdf/`)
    } catch (e) {
      setError(e.message)
    }
  }

  async function downloadInvoice(d) {
    try {
      setError('')
      await download(`/sales/${d.id}/invoice_pdf/`, `${d.invoice_no}.pdf`)
    } catch (e) {
      setError(e.message)
    }
  }

  async function deleteDoc(d) {
    const docName = isSale ? d.invoice_no : d.purchase_no
    if (!confirm(`Are you sure you want to permanently delete ${docName}?`)) {
      return
    }
    try {
      setError('')
      await api(`${endpoint}${d.id}/`, { method: 'DELETE' })
      await load()
    } catch (e) {
      setError(e.message)
    }
  }

  function openProductDropdown(idx) {
    setProductDropdown(idx)
    setProductSearch('')
  }

  // Merges quantity if product already exists in form items, otherwise updates selected row
  function selectProduct(idx, productId) {
    if (!productId) {
      setItem(idx, 'product', '')
      setProductDropdown(null)
      setProductSearch('')
      return
    }

    const existingIndex = form.items.findIndex(
      (item, i) => i !== idx && String(item.product) === String(productId)
    )

    if (existingIndex !== -1) {
      // Product already exists in another row: increment quantity of that row and remove current blank row
      const updatedItems = [...form.items]
      const currentQty = Number(updatedItems[existingIndex].quantity || 0)
      const addedQty = Number(updatedItems[idx].quantity || 1)
      updatedItems[existingIndex].quantity = String(currentQty + addedQty)
      
      // Remove current pending row if it was empty/new
      updatedItems.splice(idx, 1)

      setForm({ ...form, items: updatedItems })
    } else {
      setItem(idx, 'product', productId)
    }

    setProductDropdown(null)
    setProductSearch('')
  }

  function getFilteredProducts() {
    const search = productSearch.trim().toLowerCase()
    if (!search) return products
    return products.filter(p => {
      const sku = String(p.sku || '').toLowerCase()
      const name = String(p.name || '').toLowerCase()
      return sku.includes(search) || name.includes(search)
    })
  }

  function getFilteredParties() {
    const search = partySearch.trim().toLowerCase()
    if (!search) return parties
    return parties.filter(p => {
      const code = String(p.code || '').toLowerCase()
      const name = String(p.name || '').toLowerCase()
      const phone = String(p.phone || '').toLowerCase()
      return code.includes(search) || name.includes(search) || phone.includes(search)
    })
  }

  // Filter main documents list based on docSearch string
  const filteredDocs = useMemo(() => {
    const search = docSearch.trim().toLowerCase()
    if (!search) return docs
    return docs.filter(d => {
      const docNo = String(isSale ? d.invoice_no : d.purchase_no || '').toLowerCase()
      const party = String(isSale ? d.customer_name : d.supplier_name || '').toLowerCase()
      const payment = String(d.payment_mode || '').toLowerCase()
      const status = String(d.status || '').toLowerCase()
      return (
        docNo.includes(search) ||
        party.includes(search) ||
        payment.includes(search) ||
        status.includes(search)
      )
    })
  }, [docs, docSearch, isSale])

  function selectParty(partyId) {
    setForm({ ...form, party: partyId })
    setPartyDropdown(false)
    setPartySearch('')
  }

  const selectedParty = parties.find(p => String(p.id) === String(form.party))

  return (
    <>
      <PageHeader
        title={isSale ? 'Sales & Invoices' : 'Purchases'}
        subtitle={
          isSale
            ? 'Create a sale, reduce stock, then preview or download a professional PDF invoice'
            : 'Record supplier purchases and automatically increase stock'
        }
        actions={
          <Button
            onClick={() => {
              setEditingId(null)
              setForm({ ...blank, date: getCurrentDate(), items: [] })
              setProductDropdown(null)
              setProductSearch('')
              setPartyDropdown(false)
              setPartySearch('')
              setOpen(true)
            }}
          >
            + New {isSale ? 'Sale / Invoice' : 'Purchase'}
          </Button>
        }
      />
      <ErrorBox error={error} />

      {isSale && (
        <Card>
          <div className="invoice-help">
            <div>
              <strong> Invoice workflow </strong>
              <p>
                Create a sale first. The system saves the transaction, reduces stock, assigns an
                invoice number, and immediately offers PDF preview and download.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* SEARCH BAR FOR INVOICES */}
      <Card>
        <div style={{ paddingBottom: '16px', display: 'flex', gap: '12px', alignItems: 'center' }}>
          <Input
            placeholder={`Search ${isSale ? 'invoices' : 'purchases'} by No, Party, Payment...`}
            value={docSearch}
            onChange={e => setDocSearch(e.target.value)}
            style={{ width: '100%', maxWidth: '400px' }}
          />
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>No</th>
                <th>Date</th>
                <th>{isSale ? 'Customer' : 'Supplier'}</th>
                <th>Payment</th>
                <th>Status</th>
                <th>Total</th>
                <th>Paid</th>
                <th>Balance</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDocs.map(d => (
                <tr key={d.id}>
                  <td>
                    <strong>{isSale ? d.invoice_no : d.purchase_no}</strong>
                  </td>
                  <td>{d.date}</td>
                  <td>{isSale ? d.customer_name || 'Walk-in' : d.supplier_name || '-'}</td>
                  <td>{d.payment_mode}</td>
                  <td>
                    <span
                      className={`badge ${
                        d.status === 'CANCELLED' ? 'danger' : 'success'
                      }`}
                    >
                      {d.status}
                    </span>
                  </td>
                  <td>{money(d.total, currency)}</td>
                  <td>{money(d.amount_paid, currency)}</td>
                  <td>{money(d.balance_due, currency)}</td>
                  <td className="actions">
                    {isSale && (
                      <>
                        <button className="invoice-action" onClick={() => previewInvoice(d)}>
                          Preview Invoice
                        </button>
                        <button className="invoice-action" onClick={() => downloadInvoice(d)}>
                          Download PDF
                        </button>
                      </>
                    )}
                    <button
                      className="invoice-action"
                      style={{ marginLeft: '4px' }}
                      onClick={() => editDoc(d)}
                    >
                      Edit
                    </button>
                    <button
                      className="danger-link"
                      style={{ marginLeft: '8px', color: '#dc3545' }}
                      onClick={() => deleteDoc(d)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {filteredDocs.length === 0 && (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', color: '#777', padding: '16px' }}>
                    No {isSale ? 'sales or invoices' : 'purchases'} found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        open={open}
        title={
          editingId
            ? `Edit ${isSale ? 'Sale / Invoice' : 'Purchase'}`
            : `New ${isSale ? 'Sale & Invoice' : 'Purchase'}`
        }
        onClose={() => {
          setOpen(false)
          setEditingId(null)
          setProductDropdown(null)
          setProductSearch('')
          setPartyDropdown(false)
          setPartySearch('')
        }}
        wide
      >
        <form onSubmit={save}>
          <div className="form-grid">
            {/* SEARCHABLE CUSTOMER / SUPPLIER */}
            <div ref={partyDropdownRef} style={{ position: 'relative' }}>
              <label style={{ display: 'block', marginBottom: '6px' }}>
                {isSale ? 'Customer' : 'Supplier'}
              </label>
              <button
                type="button"
                onClick={() => {
                  setPartyDropdown(!partyDropdown)
                  setPartySearch('')
                }}
                style={{
                  width: '100%',
                  minHeight: '42px',
                  padding: '10px 12px',
                  border: '1px solid #ccc',
                  borderRadius: '6px',
                  background: '#fff',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                {selectedParty
                  ? `${selectedParty.code} — ${selectedParty.name}`
                  : isSale
                  ? 'Walk-in / No customer'
                  : 'No supplier'}
              </button>
              {partyDropdown && (
                <div
                  style={{
                    position: 'absolute',
                    zIndex: 1100,
                    left: 0,
                    right: 0,
                    top: '100%',
                    marginTop: '4px',
                    background: '#fff',
                    border: '1px solid #ccc',
                    borderRadius: '6px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    overflow: 'hidden'
                  }}
                >
                  <div style={{ padding: '8px', borderBottom: '1px solid #eee' }}>
                    <input
                      type="text"
                      autoFocus
                      placeholder={
                        isSale
                          ? 'Search customer by code, name or phone...'
                          : 'Search supplier by code, name or phone...'
                      }
                      value={partySearch}
                      onChange={e => setPartySearch(e.target.value)}
                      onClick={e => e.stopPropagation()}
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        padding: '9px 10px',
                        border: '1px solid #ccc',
                        borderRadius: '5px',
                        outline: 'none',
                        fontSize: '14px'
                      }}
                    />
                  </div>
                  <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
                    <button
                      type="button"
                      onClick={() => selectParty('')}
                      style={{
                        display: 'block',
                        width: '100%',
                        padding: '10px 12px',
                        border: 'none',
                        background: form.party === '' ? '#f5f5f5' : '#fff',
                        textAlign: 'left',
                        cursor: 'pointer',
                        fontSize: '14px'
                      }}
                    >
                      {isSale ? 'Walk-in / No customer' : 'No supplier'}
                    </button>
                    {getFilteredParties().map(p => (
                      <button
                        type="button"
                        key={p.id}
                        onClick={() => selectParty(p.id)}
                        style={{
                          display: 'block',
                          width: '100%',
                          padding: '10px 12px',
                          border: 'none',
                          borderTop: '1px solid #f1f1f1',
                          background: String(p.id) === String(form.party) ? '#f5f5f5' : '#fff',
                          textAlign: 'left',
                          cursor: 'pointer',
                          fontSize: '14px'
                        }}
                      >
                        <strong>{p.code}</strong> {' — '} {p.name}
                        {p.phone && (
                          <span style={{ color: '#777', marginLeft: '6px' }}>
                            ({p.phone})
                          </span>
                        )}
                      </button>
                    ))}
                    {getFilteredParties().length === 0 && (
                      <div style={{ padding: '12px', textAlign: 'center', color: '#777' }}>
                        No {isSale ? 'customers' : 'suppliers'} found.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <Input
              label="Date"
              type="date"
              required
              value={form.date}
              onChange={e => setForm({ ...form, date: e.target.value })}
            />

            <Select
              label="Payment Mode"
              value={form.payment_mode}
              onChange={e => setForm({ ...form, payment_mode: e.target.value })}
            >
              <option value="CREDIT"> Credit </option>
              <option value="CASH"> Cash </option>
              <option value="BANK"> Bank Transfer </option>
              <option value="CARD"> Card </option>
              <option value="CHEQUE"> Cheque </option>
            </Select>

            <Input
              label="Amount Paid"
              type="number"
              step="0.01"
              min="0"
              value={form.amount_paid}
              onChange={e => setForm({ ...form, amount_paid: e.target.value })}
            />
          </div>

          <Textarea
            label="Notes / Remark"
            value={form.notes}
            onChange={e => setForm({ ...form, notes: e.target.value })}
          />

          <div className="line-items">
            <div className="line-head">
              <h3> Invoice Items </h3>
              <Button type="button" variant="secondary" onClick={addItem}>
                + Add Item
              </Button>
            </div>

            {form.items.map((i, idx) => {
              const filteredProducts = getFilteredProducts()
              const selectedProduct = products.find(p => String(p.id) === String(i.product))

              return (
                <div className="line-item" key={idx}>
                  {/* PRODUCT SEARCH */}
                  <div
                    ref={productDropdown === idx ? productDropdownRef : null}
                    style={{ position: 'relative' }}
                  >
                    <label style={{ display: 'block', marginBottom: '6px' }}> Product </label>
                    <button
                      type="button"
                      onClick={() =>
                        productDropdown === idx
                          ? setProductDropdown(null)
                          : openProductDropdown(idx)
                      }
                      style={{
                        width: '100%',
                        minHeight: '42px',
                        padding: '10px 12px',
                        border: '1px solid #ccc',
                        borderRadius: '6px',
                        background: '#fff',
                        textAlign: 'left',
                        cursor: 'pointer',
                        fontSize: '14px'
                      }}
                    >
                      {selectedProduct
                        ? `${selectedProduct.sku} — ${selectedProduct.name}${
                            isSale ? ` (Stock ${selectedProduct.current_stock})` : ''
                          }`
                        : 'Select product'}
                    </button>

                    {productDropdown === idx && (
                      <div
                        style={{
                          position: 'absolute',
                          zIndex: 1000,
                          left: 0,
                          right: 0,
                          top: '100%',
                          marginTop: '4px',
                          background: '#fff',
                          border: '1px solid #ccc',
                          borderRadius: '6px',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                          overflow: 'hidden'
                        }}
                      >
                        <div style={{ padding: '8px', borderBottom: '1px solid #eee' }}>
                          <input
                            type="text"
                            autoFocus
                            placeholder="Search SKU or product name..."
                            value={productSearch}
                            onChange={e => setProductSearch(e.target.value)}
                            onClick={e => e.stopPropagation()}
                            style={{
                              width: '100%',
                              boxSizing: 'border-box',
                              padding: '9px 10px',
                              border: '1px solid #ccc',
                              borderRadius: '5px',
                              outline: 'none',
                              fontSize: '14px'
                            }}
                          />
                        </div>

                        <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
                          <button
                            type="button"
                            onClick={() => selectProduct(idx, '')}
                            style={{
                              display: 'block',
                              width: '100%',
                              padding: '10px 12px',
                              border: 'none',
                              background: '#fff',
                              textAlign: 'left',
                              cursor: 'pointer'
                            }}
                          >
                            Select product
                          </button>
                          {filteredProducts.map(p => (
                            <button
                              type="button"
                              key={p.id}
                              onClick={() => selectProduct(idx, p.id)}
                              style={{
                                display: 'block',
                                width: '100%',
                                padding: '10px 12px',
                                border: 'none',
                                borderTop: '1px solid #f1f1f1',
                                background:
                                  String(p.id) === String(i.product) ? '#f5f5f5' : '#fff',
                                textAlign: 'left',
                                cursor: 'pointer',
                                fontSize: '14px'
                              }}
                            >
                              {p.sku} — {p.name}
                              {isSale ? ` (Stock ${p.current_stock})` : ''}
                            </button>
                          ))}
                          {filteredProducts.length === 0 && (
                            <div style={{ padding: '12px', textAlign: 'center', color: '#777' }}>
                              No products found.
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <Input
                    label="Qty"
                    type="number"
                    min="0.001"
                    step="0.001"
                    required
                    value={i.quantity}
                    onChange={e => setItem(idx, 'quantity', e.target.value)}
                  />
                  <Input
                    label={isSale ? 'Unit Price' : 'Unit Cost'}
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={i.price}
                    onChange={e => setItem(idx, 'price', e.target.value)}
                  />
                  <Input
                    label="Discount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={i.discount}
                    onChange={e => setItem(idx, 'discount', e.target.value)}
                  />
                  <Input
                    label="VAT %"
                    type="number"
                    min="0"
                    step="0.01"
                    value={i.vat_rate}
                    onChange={e => setItem(idx, 'vat_rate', e.target.value)}
                  />
                  <button type="button" className="remove-line" onClick={() => removeItem(idx)}>
                    ×
                  </button>
                </div>
              )
            })}

            {!form.items.length && (
              <div className="empty">Add at least one product to generate an invoice.</div>
            )}
          </div>

          <div className="doc-summary">
            <span>
              Sub Total <strong>{money(totals.sub, currency)}</strong>
            </span>
            <span>
              Discount <strong>{money(totals.disc, currency)}</strong>
            </span>
            <span>
              VAT <strong>{money(totals.vat, currency)}</strong>
            </span>
            <span className="grand">
              Invoice Total <strong>{money(totals.total, currency)}</strong>
            </span>
          </div>

          <div className="modal-actions">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setOpen(false)
                setEditingId(null)
                setProductDropdown(null)
                setProductSearch('')
                setPartyDropdown(false)
                setPartySearch('')
              }}
            >
              Cancel
            </Button>
            <Button disabled={!form.items.length}>
              {editingId
                ? 'Update Document'
                : isSale
                ? 'Save Sale & Generate Invoice'
                : 'Save Purchase'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!invoiceReady} title="Invoice Generated Successfully" onClose={() => setInvoiceReady(null)}>
        {invoiceReady && (
          <div className="invoice-ready">
            <div className="invoice-ready-number">{invoiceReady.invoice_no}</div>
            <p>
              The sale is saved, stock has been updated, and your English-only PDF invoice is
              ready.
            </p>
            <div className="invoice-ready-totals">
              <span>
                Total <strong>{money(invoiceReady.total, currency)}</strong>
              </span>
              <span>
                Paid <strong>{money(invoiceReady.amount_paid, currency)}</strong>
              </span>
              <span>
                Balance <strong>{money(invoiceReady.balance_due, currency)}</strong>
              </span>
            </div>
            <div className="modal-actions">
              <Button variant="secondary" onClick={() => previewInvoice(invoiceReady)}>
                Preview Invoice
              </Button>
              <Button onClick={() => downloadInvoice(invoiceReady)}>Download PDF</Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}