import React, { useEffect, useMemo, useState } from 'react'
import { api, unwrap } from '../api'
import { Button, Card, Empty, ErrorBox, Input, Modal, PageHeader, Select, Textarea } from '../components/Ui'

const blankProduct={sku:'',barcode:'',name:'',description:'',category:'',brand:'',unit:'pcs',purchase_price:'0',selling_price:'0',vat_rate:'0',min_stock:'0',opening_stock:'0',batch_no:'',expiry_date:'',shelf_location:'',is_active:true}

/* Stock status display logic only */
function getStockStatus(product){
 const current=Number(product.current_stock||0)
 const minimum=Number(product.min_stock||0)

 if(current<=minimum){
  return {label:'Low Stock',className:'danger'}
 }

 if(current<=minimum*2){
  return {label:'Partial Stock',className:'warning'}
 }

 return {label:'High Stock',className:'success'}
}

export default function InventoryPage(){
 const [products,setProducts]=useState([]),[cats,setCats]=useState([]),[moves,setMoves]=useState([]),[error,setError]=useState(''),[q,setQ]=useState('')
 const [open,setOpen]=useState(false),[editing,setEditing]=useState(null),[form,setForm]=useState(blankProduct)
 const [adjustOpen,setAdjustOpen]=useState(false),[adjust,setAdjust]=useState({product:'',adjustment_type:'ADJUSTMENT_IN',quantity:'1',note:''})

 async function load(){
  try{
   const [p,c,m]=await Promise.all([
    api('/products/?page_size=100'),
    api('/categories/?page_size=100'),
    api('/stock-movements/?page_size=100')
   ])
   setProducts(unwrap(p))
   setCats(unwrap(c))
   setMoves(unwrap(m))
  }catch(e){
   setError(e.message)
  }
 }

 useEffect(()=>{load()},[])

 const filtered=useMemo(
  ()=>products.filter(
   p=>!q||`${p.sku} ${p.name} ${p.brand}`.toLowerCase().includes(q.toLowerCase())
  ),
  [products,q]
 )

 function add(){
  setEditing(null)
  setForm(blankProduct)
  setOpen(true)
 }

 function edit(p){
  setEditing(p)
  setForm({
   ...blankProduct,
   ...p,
   category:p.category||'',
   expiry_date:p.expiry_date||''
  })
  setOpen(true)
 }

 async function save(e){
  e.preventDefault()
  try{
   const body={
    ...form,
    category:form.category||null,
    expiry_date:form.expiry_date||null
   }

   await api(
    editing?`/products/${editing.id}/`:'/products/',
    {
     method:editing?'PUT':'POST',
     body
    }
   )

   setOpen(false)
   await load()
  }catch(e){
   setError(e.message)
  }
 }

 async function saveAdjust(e){
  e.preventDefault()
  try{
   await api('/products/adjust_stock/',{
    method:'POST',
    body:adjust
   })

   setAdjustOpen(false)
   await load()
  }catch(e){
   setError(e.message)
  }
 }

 async function deleteProduct(p){
  const confirmed=window.confirm(
   `Are you sure you want to delete "${p.name}"?`
  )

  if(!confirmed) return

  try{
   await api(`/products/${p.id}/`,{
    method:'DELETE'
   })

   await load()
  }catch(e){
   setError(e.message)
  }
 }

 return <>
  <PageHeader
   title="Inventory"
   subtitle="Products, stock levels and movement ledger"
   actions={
    <>
     <Button
      variant="secondary"
      onClick={()=>setAdjustOpen(true)}
     >
      Stock Adjustment
     </Button>

     <Button onClick={add}>
      + Add Product
     </Button>
    </>
   }
  />

  <ErrorBox error={error}/>

  <Card>
   <div className="toolbar">
    <input
     className="search"
     placeholder="Search SKU, product, brand…"
     value={q}
     onChange={e=>setQ(e.target.value)}
    />

    <span>{filtered.length} products</span>
   </div>

   {filtered.length?
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
        <th/>
       </tr>
      </thead>

      <tbody>
       {filtered.map(p=>{
        const stockStatus=getStockStatus(p)

        return (
         <tr key={p.id}>
          <td>{p.sku}</td>

          <td>
           <strong>{p.name}</strong>
           <small className="cell-sub">{p.brand}</small>
          </td>

          <td>{p.category_name||'-'}</td>

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
           <button onClick={()=>edit(p)}>
            Edit
           </button>

           <button onClick={()=>deleteProduct(p)}>
            Delete
           </button>
          </td>
         </tr>
        )
       })}
      </tbody>
     </table>
    </div>
    :
    <Empty/>
   }
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
      {moves.slice(0,20).map(m=>
       <tr key={m.id}>
        <td>{new Date(m.created_at).toLocaleString()}</td>
        <td>{m.product_sku}</td>
        <td>{m.product_name}</td>
        <td>{m.movement_type}</td>
        <td>{m.quantity}</td>
        <td>{m.balance_after}</td>
        <td>{m.note}</td>
       </tr>
      )}
     </tbody>
    </table>
   </div>
  </Card>

  <Modal
   open={open}
   title={editing?'Edit Product':'Add Product'}
   onClose={()=>setOpen(false)}
   wide
  >
   <form onSubmit={save}>
    <div className="form-grid">
     <Input
      label="SKU"
      required
      value={form.sku}
      onChange={e=>setForm({...form,sku:e.target.value})}
     />

     <Input
      label="Barcode"
      value={form.barcode}
      onChange={e=>setForm({...form,barcode:e.target.value})}
     />

     <Input
      label="Product Name"
      required
      value={form.name}
      onChange={e=>setForm({...form,name:e.target.value})}
     />

     <Select
      label="Category"
      value={form.category}
      onChange={e=>setForm({...form,category:e.target.value})}
     >
      <option value="">No category</option>

      {cats.map(c=>
       <option value={c.id} key={c.id}>
        {c.name}
       </option>
      )}
     </Select>

     <Input
      label="Brand"
      value={form.brand}
      onChange={e=>setForm({...form,brand:e.target.value})}
     />

     <Input
      label="Unit"
      value={form.unit}
      onChange={e=>setForm({...form,unit:e.target.value})}
     />

     <Input
      label="Purchase Price"
      type="number"
      step="0.01"
      value={form.purchase_price}
      onChange={e=>setForm({...form,purchase_price:e.target.value})}
     />

     <Input
      label="Selling Price"
      type="number"
      step="0.01"
      value={form.selling_price}
      onChange={e=>setForm({...form,selling_price:e.target.value})}
     />

     <Input
      label="VAT %"
      type="number"
      step="0.01"
      value={form.vat_rate}
      onChange={e=>setForm({...form,vat_rate:e.target.value})}
     />

     <Input
      label="Minimum Stock"
      type="number"
      step="0.001"
      value={form.min_stock}
      onChange={e=>setForm({...form,min_stock:e.target.value})}
     />

     {!editing&&
      <Input
       label="Opening Stock"
       type="number"
       step="0.001"
       value={form.opening_stock}
       onChange={e=>setForm({...form,opening_stock:e.target.value})}
      />
     }

     <Input
      label="Batch No"
      value={form.batch_no}
      onChange={e=>setForm({...form,batch_no:e.target.value})}
     />

     <Input
      label="Expiry Date"
      type="date"
      value={form.expiry_date}
      onChange={e=>setForm({...form,expiry_date:e.target.value})}
     />

     <Input
      label="Shelf Location"
      value={form.shelf_location}
      onChange={e=>setForm({...form,shelf_location:e.target.value})}
     />

     <Textarea
      label="Description"
      value={form.description}
      onChange={e=>setForm({...form,description:e.target.value})}
     />
    </div>

    <div className="modal-actions">
     <Button
      type="button"
      variant="ghost"
      onClick={()=>setOpen(false)}
     >
      Cancel
     </Button>

     <Button>
      Save Product
     </Button>
    </div>
   </form>
  </Modal>

  <Modal
   open={adjustOpen}
   title="Stock Adjustment"
   onClose={()=>setAdjustOpen(false)}
  >
   <form onSubmit={saveAdjust}>
    <Select
     label="Product"
     required
     value={adjust.product}
     onChange={e=>setAdjust({...adjust,product:e.target.value})}
    >
     <option value="">Select product</option>

     {products.map(p=>
      <option value={p.id} key={p.id}>
       {p.sku} — {p.name}
      </option>
     )}
    </Select>

    <Select
     label="Adjustment Type"
     value={adjust.adjustment_type}
     onChange={e=>setAdjust({...adjust,adjustment_type:e.target.value})}
    >
     <option value="ADJUSTMENT_IN">
      Adjustment In
     </option>

     <option value="ADJUSTMENT_OUT">
      Adjustment Out
     </option>
    </Select>

    <Input
     label="Quantity"
     type="number"
     step="0.001"
     min="0.001"
     required
     value={adjust.quantity}
     onChange={e=>setAdjust({...adjust,quantity:e.target.value})}
    />

    <Textarea
     label="Reason / Note"
     value={adjust.note}
     onChange={e=>setAdjust({...adjust,note:e.target.value})}
    />

    <div className="modal-actions">
     <Button
      type="button"
      variant="ghost"
      onClick={()=>setAdjustOpen(false)}
     >
      Cancel
     </Button>

     <Button>
      Save Adjustment
     </Button>
    </div>
   </form>
  </Modal>
 </>
}