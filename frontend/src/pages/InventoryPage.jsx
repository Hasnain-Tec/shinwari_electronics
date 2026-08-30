import React, { useEffect, useMemo, useState } from 'react'
import { api, unwrap } from '../api'
import { Button, Card, Empty, ErrorBox, Input, Modal, PageHeader, Select, Textarea } from '../components/Ui'

const blankProduct = {
  sku: '',
  barcode: '',
  name: '',
  description: '',
  category: '',
  brand: '',
  unit: 'pcs',
  purchase_price: '0',
  selling_price: '0',
  vat_rate: '0',
  min_stock: '0',
  opening_stock: '0',
  current_stock: '0',
  batch_no: '',
  expiry_date: '',
  shelf_location: '',
  is_active: true
}

/* Stock status display logic only */
function getStockStatus(product) {
  const current = Number(product.current_stock || 0)
  const minimum = Number(product.min_stock || 0)
  if (current <= minimum) {
    return { label: 'Low Stock', className: 'danger' }
  }
  if (current <= minimum * 2) {
    return { label: 'Partial Stock', className: 'warning' }
  }
  return { label: 'High Stock', className: 'success' }
}

/* Escape text for raw PDF streams */
function pdfEscape(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/[\r\n]+/g, ' ')
}

/* Truncate PDF text cleanly */
function pdfText(value, maxLength = 55) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim()
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength - 3)}...`
}

/* Creates PDF starting directly with "Available Stock" and the 3 columns */
function createInventoryPDF(products) {
  const pageWidth = 595
  const pageHeight = 842
  const marginLeft = 28
  const marginRight = 28
  const printableWidth = pageWidth - marginLeft - marginRight
  const topY = 800
  const rowHeight = 18
  const contentPages = []
  let lines = []
  let y = topY

  function addText(text, x, yPos, size = 9, font = 'F1', align = 'left') {
    if (!text) return
    const escaped = pdfEscape(text)
    let finalX = x
    if (align === 'center') {
      const approxWidth = text.length * (size * 0.45)
      finalX = x - approxWidth / 2
    }
    lines.push(`BT /${font} ${size} Tf ${finalX} ${yPos} Td (${escaped}) Tj ET`)
  }

  function addLine(x1, y1, x2, y2, weight = 0.5) {
    lines.push(`q ${weight} w ${x1} ${y1} m ${x2} ${y2} l S Q`)
  }

  function addRect(x, yPos, w, h, weight = 0.6) {
    lines.push(`q ${weight} w ${x} ${yPos} ${w} ${h} re S Q`)
  }

  function startPage() {
    lines = []
    y = topY
    // 1. Title directly at top
    addText('Available Stock', pageWidth / 2, y, 11, 'F1', 'center')
    y -= 15
    // 2. Table Header Box (SNo. | Item | qty)
    const headerBoxY = y - rowHeight
    addRect(marginLeft, headerBoxY, printableWidth, rowHeight)
    // Vertical line dividers
    addLine(marginLeft + 45, headerBoxY, marginLeft + 45, y)
    addLine(pageWidth - marginRight - 55, headerBoxY, pageWidth - marginRight - 55, y)
    // Header Titles
    addText('SNo.', marginLeft + 22.5, headerBoxY + 5, 9, 'F1', 'center')
    addText('Item', marginLeft + 50, headerBoxY + 5, 9, 'F1', 'left')
    addText('qty', pageWidth - marginRight - 27.5, headerBoxY + 5, 9, 'F1', 'center')
    y = headerBoxY
  }

  function finishPage() {
    contentPages.push(lines.join('\n'))
  }

  const rowsPerPage = 38
  startPage()
  products.forEach((product, index) => {
    if (index > 0 && index % rowsPerPage === 0) {
      finishPage()
      startPage()
    }
    const currentY = y - rowHeight
    // Outer row box
    addRect(marginLeft, currentY, printableWidth, rowHeight)
    // Inner cell dividers
    addLine(marginLeft + 45, currentY, marginLeft + 45, y)
    addLine(pageWidth - marginRight - 55, currentY, pageWidth - marginRight - 55, y)
    // Row Data
    addText(String(index + 1), marginLeft + 22.5, currentY + 5, 8.5, 'F1', 'center')
    addText(pdfText(product.name, 55), marginLeft + 50, currentY + 5, 8.5, 'F1', 'left')
    addText(String(product.current_stock ?? 0), pageWidth - marginRight - 27.5, currentY + 5, 8.5, 'F1', 'center')
    y = currentY
  })
  finishPage()

  // Native PDF structure setup
  const objects = []
  objects.push('<< /Type /Catalog /Pages 2 0 R >>')
  const pageObjectNumbers = []
  let nextObject = 5
  contentPages.forEach(() => {
    pageObjectNumbers.push(nextObject)
    nextObject += 2
  })
  const kids = pageObjectNumbers.map((number) => `${number} 0 R`).join(' ')
  objects.push(`<< /Type /Pages /Kids [${kids}] /Count ${contentPages.length} >>`)
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>')

  contentPages.forEach((content, index) => {
    const pageObjectNumber = pageObjectNumbers[index]
    const contentObjectNumber = pageObjectNumber + 1
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObjectNumber} 0 R >>`
    )
    objects.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`)
  })

  let pdf = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n'
  const offsets = [0]
  objects.forEach((object, index) => {
    offsets.push(pdf.length)
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`
  })
  const xrefOffset = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (let i = 1; i < offsets.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`

  return new Blob([pdf], { type: 'application/pdf' })
}

export default function InventoryPage() {
  const [products, setProducts] = useState([])
  const [cats, setCats] = useState([])
  const [moves, setMoves] = useState([])
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(blankProduct)
  const [adjustOpen, setAdjustOpen] = useState(false)
  const [adjust, setAdjust] = useState({
    product: '',
    adjustment_type: 'ADJUSTMENT_IN',
    quantity: '1',
    note: ''
  })
  const [pdfGenerating, setPdfGenerating] = useState(false)

  async function load() {
    try {
      const [p, c, m] = await Promise.all([
        api('/products/?page_size=1000'),
        api('/categories/?page_size=100'),
        api('/stock-movements/?page_size=100')
      ])
      setProducts(unwrap(p))
      setCats(unwrap(c))
      setMoves(unwrap(m))
    } catch (e) {
      setError(e.message)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(
    () =>
      products.filter(
        (p) => !q || `${p.sku} ${p.name} ${p.brand}`.toLowerCase().includes(q.toLowerCase())
      ),
    [products, q]
  )

  function generatePDF() {
    if (!products.length) {
      alert('There are no products available to generate the PDF.')
      return
    }
    try {
      setPdfGenerating(true)
      const pdfBlob = createInventoryPDF(products)
      const url = URL.createObjectURL(pdfBlob)
      const link = document.createElement('a')
      const date = new Date().toISOString().slice(0, 10)
      link.href = url
      link.download = `inventory-products-${date}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      setTimeout(() => {
        URL.revokeObjectURL(url)
      }, 1000)
    } catch (e) {
      console.error(e)
      setError(e?.message || 'Unable to generate inventory PDF.')
    } finally {
      setPdfGenerating(false)
    }
  }

  function add() {
    setEditing(null)
    setForm(blankProduct)
    setOpen(true)
  }

  function edit(p) {
    setEditing(p)
    setForm({
      ...blankProduct,
      ...p,
      category: p.category || '',
      expiry_date: p.expiry_date || '',
      current_stock: p.current_stock ?? '0'
    })
    setOpen(true)
  }

  async function save(e) {
    e.preventDefault()
    try {
      const body = {
        ...form,
        category: form.category || null,
        expiry_date: form.expiry_date || null
      }
      await api(editing ? `/products/${editing.id}/` : '/products/', {
        method: editing ? 'PUT' : 'POST',
        body
      })
      setOpen(false)
      await load()
    } catch (e) {
      setError(e.message)
    }
  }

  async function saveAdjust(e) {
    e.preventDefault()
    try {
      await api('/products/adjust_stock/', { method: 'POST', body: adjust })
      setAdjustOpen(false)
      await load()
    } catch (e) {
      setError(e.message)
    }
  }

  async function deleteProduct(p) {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${p.name}"?`
    )
    if (!confirmed) return
    try {
      const res = await api(`/products/${p.id}/`, { method: 'DELETE' })
      if (res?.detail) {
        alert(res.detail)
      }
      await load()
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <>
      <PageHeader
        title="Inventory"
        subtitle="Products, stock levels and movement ledger"
        actions={
          <>
            <Button
              variant="secondary"
              onClick={generatePDF}
              disabled={pdfGenerating || !products.length}
            >
              {pdfGenerating ? 'Generating PDF…' : 'Generate PDF'}
            </Button>
            <Button variant="secondary" onClick={() => setAdjustOpen(true)}>
              Stock Adjustment
            </Button>
            <Button onClick={add}> + Add Product </Button>
          </>
        }
      />
      <ErrorBox error={error} />
      <Card>
        <div className="toolbar">
          <input
            className="search"
            placeholder="Search SKU, product, brand…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <span>{filtered.length} products</span>
        </div>
        {filtered.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Stock</th>
                  <th>Min</th>
                  <th>Purchase</th>
                  <th>Sale</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const stockStatus = getStockStatus(p)
                  return (
                    <tr key={p.id}>
                      <td>{p.sku}</td>
                      <td>
                        <strong>{p.name}</strong>
                        <small className="cell-sub">{p.brand}</small>
                      </td>
                      <td>{p.category_name || '-'}</td>
                      <td>
                        {p.current_stock} {p.unit}
                      </td>
                      <td>{p.min_stock}</td>
                      <td>{p.purchase_price}</td>
                      <td>{p.selling_price}</td>
                      <td>
                        <span className={`badge ${stockStatus.className}`}>
                          {stockStatus.label}
                        </span>
                      </td>
                      <td>
                        <button onClick={() => edit(p)}>Edit</button>
                        <button onClick={() => deleteProduct(p)}>Delete</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty />
        )}
      </Card>
      <Card>
        <h3>Recent Stock Movements</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>SKU</th>
                <th>Product</th>
                <th>Type</th>
                <th>Qty</th>
                <th>Balance</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {moves.slice(0, 20).map((m) => (
                <tr key={m.id}>
                  <td>{new Date(m.created_at).toLocaleString()}</td>
                  <td>{m.product_sku}</td>
                  <td>{m.product_name}</td>
                  <td>{m.movement_type}</td>
                  <td>{m.quantity}</td>
                  <td>{m.balance_after}</td>
                  <td>{m.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Modal open={open} title={editing ? 'Edit Product' : 'Add Product'} onClose={() => setOpen(false)} wide>
        <form onSubmit={save}>
          <div className="form-grid">
            <Input label="SKU" required value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
            <Input label="Barcode" value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} />
            <Input label="Product Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Select label="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              <option value=""> No category </option>
              {cats.map((c) => (
                <option value={c.id} key={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <Input label="Brand" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
            <Input label="Unit" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
            <Input label="Purchase Price" type="number" step="0.01" value={form.purchase_price} onChange={(e) => setForm({ ...form, purchase_price: e.target.value })} />
            <Input label="Selling Price" type="number" step="0.01" value={form.selling_price} onChange={(e) => setForm({ ...form, selling_price: e.target.value })} />
            <Input label="VAT %" type="number" step="0.01" value={form.vat_rate} onChange={(e) => setForm({ ...form, vat_rate: e.target.value })} />
            <Input label="Minimum Stock" type="number" step="0.001" value={form.min_stock} onChange={(e) => setForm({ ...form, min_stock: e.target.value })} />
            {editing ? (
              <Input label="Current Stock" type="number" step="0.001" value={form.current_stock} onChange={(e) => setForm({ ...form, current_stock: e.target.value })} />
            ) : (
              <Input label="Opening Stock" type="number" step="0.001" value={form.opening_stock} onChange={(e) => setForm({ ...form, opening_stock: e.target.value })} />
            )}
            <Input label="Batch No" value={form.batch_no} onChange={(e) => setForm({ ...form, batch_no: e.target.value })} />
            <Input label="Expiry Date" type="date" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} />
            <Input label="Shelf Location" value={form.shelf_location} onChange={(e) => setForm({ ...form, shelf_location: e.target.value })} />
            <Textarea label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="modal-actions">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}> Cancel </Button>
            <Button> Save Product </Button>
          </div>
        </form>
      </Modal>
      <Modal open={adjustOpen} title="Stock Adjustment" onClose={() => setAdjustOpen(false)}>
        <form onSubmit={saveAdjust}>
          <Select label="Product" required value={adjust.product} onChange={(e) => setAdjust({ ...adjust, product: e.target.value })}>
            <option value=""> Select product </option>
            {products.map((p) => (
              <option value={p.id} key={p.id}>
                {p.sku} — {p.name}
              </option>
            ))}
          </Select>
          <Select label="Adjustment Type" value={adjust.adjustment_type} onChange={(e) => setAdjust({ ...adjust, adjustment_type: e.target.value })}>
            <option value="ADJUSTMENT_IN"> Adjustment In </option>
            <option value="ADJUSTMENT_OUT"> Adjustment Out </option>
          </Select>
          <Input label="Quantity" type="number" step="0.001" min="0.001" required value={adjust.quantity} onChange={(e) => setAdjust({ ...adjust, quantity: e.target.value })} />
          <Textarea label="Reason / Note" value={adjust.note} onChange={(e) => setAdjust({ ...adjust, note: e.target.value })} />
          <div className="modal-actions">
            <Button type="button" variant="ghost" onClick={() => setAdjustOpen(false)}> Cancel </Button>
            <Button> Save Adjustment </Button>
          </div>
        </form>
      </Modal>
    </>
  )
}