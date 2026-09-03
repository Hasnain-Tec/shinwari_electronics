import React, { useEffect, useState } from 'react'
import { api, unwrap } from '../api'
import { Button, Card, ErrorBox, Input, Modal, PageHeader, Select, money } from '../components/Ui'

// Get current local date as YYYY-MM-DD (prevents timezone lag / previous-day bug)
const getTodayLocalDate = () => {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export default function ExpensesPage({ currency='AED' }){
 const [rows,setRows]=useState([]),[cats,setCats]=useState([]),[error,setError]=useState(''),[open,setOpen]=useState(false)
 const [form,setForm]=useState({date:getTodayLocalDate(),category:'',amount:'',description:'',paid_to:'',payment_method:'CASH',reference:''})
 
 async function load(){
   try{
     const [e,c]=await Promise.all([api('/expenses/?page_size=100'),api('/expense-categories/?page_size=100')]);
     setRows(unwrap(e));
     setCats(unwrap(c))
   }catch(e){
     setError(e.message)
   }
 } 
 
 useEffect(()=>{load()},[])

 async function save(e){
   e.preventDefault();
   try{
     await api('/expenses/',{method:'POST',body:{...form,category:Number(form.category)}});
     setOpen(false);
     setForm({date:getTodayLocalDate(),category:'',amount:'',description:'',paid_to:'',payment_method:'CASH',reference:''});
     await load()
   }catch(e){
     setError(e.message)
   }
 }

 async function remove(r){
   if(!confirm('Delete this expense?'))return;
   try{
     await api(`/expenses/${r.id}/`,{method:'DELETE'});
     await load()
   }catch(e){
     setError(e.message)
   }
 }

 return <>
   <PageHeader title="Expenses" subtitle="Track operating costs" actions={<Button onClick={()=>{ setForm(f => ({ ...f, date: getTodayLocalDate() })); setOpen(true); }}>+ Add Expense</Button>}/>
   <ErrorBox error={error}/>
   <Card>
     <div className="table-wrap">
       <table>
         <thead>
           <tr>
             <th>Date</th>
             <th>Category</th>
             <th>Description</th>
             <th>Paid To</th>
             <th>Method</th>
             <th>Amount</th>
             <th/>
           </tr>
         </thead>
         <tbody>
           {rows.map(r=>(
             <tr key={r.id}>
               <td>{r.date}</td>
               <td>{r.category_name}</td>
               <td>{r.description}</td>
               <td>{r.paid_to||'-'}</td>
               <td>{r.payment_method}</td>
               <td>{money(r.amount,currency)}</td>
               <td><button className="danger-link" onClick={()=>remove(r)}>Delete</button></td>
             </tr>
           ))}
         </tbody>
       </table>
     </div>
   </Card>
   <Modal open={open} title="Add Expense" onClose={()=>setOpen(false)}>
     <form onSubmit={save}>
       <Input label="Date" type="date" required value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/>
       <Select label="Category" required value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>
         <option value="">Select category</option>
         {cats.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
       </Select>
       <Input label="Amount" type="number" min="0.01" step="0.01" required value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})}/>
       <Input label="Description" required value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/>
       <Input label="Paid To" value={form.paid_to} onChange={e=>setForm({...form,paid_to:e.target.value})}/>
       <Select label="Payment Method" value={form.payment_method} onChange={e=>setForm({...form,payment_method:e.target.value})}>
         <option value="CASH">Cash</option>
         <option value="BANK">Bank Transfer</option>
         <option value="CARD">Card</option>
         <option value="CHEQUE">Cheque</option>
       </Select>
       <Input label="Reference" value={form.reference} onChange={e=>setForm({...form,reference:e.target.value})}/>
       <div className="modal-actions">
         <Button type="button" variant="ghost" onClick={()=>setOpen(false)}>Cancel</Button>
         <Button>Save Expense</Button>
       </div>
     </form>
   </Modal>
 </>
}