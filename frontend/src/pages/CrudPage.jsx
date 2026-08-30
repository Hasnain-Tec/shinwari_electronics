import React, { useEffect, useMemo, useState } from 'react'
import { api, unwrap } from '../api'
import { Button, Card, Empty, ErrorBox, Input, Modal, PageHeader, Select, Textarea } from '../components/Ui'

export default function CrudPage({ title, subtitle, endpoint, fields, columns, initial = {}, searchKeys = ['name'] }) {
  const [rows, setRows] = useState([]), [loading, setLoading] = useState(true), [error, setError] = useState('')
  const [open, setOpen] = useState(false), [editing, setEditing] = useState(null), [form, setForm] = useState(initial), [q, setQ] = useState('')

  async function load(){ setLoading(true); setError(''); try{ setRows(unwrap(await api(`${endpoint}?page_size=100`))) }catch(e){setError(e.message)}finally{setLoading(false)} }
  useEffect(()=>{load()},[endpoint])

  const filtered = useMemo(()=>rows.filter(r => !q || searchKeys.some(k => String(r[k]||'').toLowerCase().includes(q.toLowerCase()))),[rows,q,searchKeys])

  function newRecord(){ setError(''); setEditing(null); setForm(initial); setOpen(true) }
  function editRecord(row){ setError(''); setEditing(row); const next={}; fields.forEach(f=>next[f.name]=row[f.readKey || f.name] ?? ''); setForm(next); setOpen(true) }

  async function save(e){ e.preventDefault(); setError(''); try{ await api(editing ? `${endpoint}${editing.id}/` : endpoint,{method:editing?'PUT':'POST',body:form}); setOpen(false); await load() }catch(err){setError(err.message)} }

  async function remove(row){ 
    if(!confirm(`Delete ${row.name || row.code || 'this record'}?`)) return; 
    setError(''); 
    try{
      await api(`${endpoint}${row.id}/`,{method:'DELETE'}); 
      await load();
    }catch(e){
      const msg = e.message || 'Cannot delete record because it is linked to other transactions.'
      setError(msg)
      alert(`Delete Failed: ${msg}`)
    } 
  }

  return <>
    <PageHeader title={title} subtitle={subtitle} actions={<Button onClick={newRecord}>+ Add New</Button>}/>
    <Card>
      <div className="toolbar"><input className="search" placeholder="Search…" value={q} onChange={e=>setQ(e.target.value)}/><span>{filtered.length} records</span></div>
      <ErrorBox error={error}/>
      {loading?<div className="loading">Loading…</div>:filtered.length===0?<Empty/>:<div className="table-wrap"><table><thead><tr>{columns.map(c=><th key={c.key}>{c.label}</th>)}<th>Actions</th></tr></thead><tbody>{filtered.map(row=><tr key={row.id}>{columns.map(c=><td key={c.key}>{c.render?c.render(row):String(row[c.key]??'')}</td>)}<td className="actions"><button onClick={()=>editRecord(row)}>Edit</button><button className="danger-link" onClick={()=>remove(row)}>Delete</button></td></tr>)}</tbody></table></div>}
    </Card>
    <Modal open={open} title={editing?`Edit ${title.replace(/s$/,'')}`:`Add ${title.replace(/s$/,'')}`} onClose={()=>setOpen(false)} wide>
      <form onSubmit={save}><div className="form-grid">{fields.map(f=>{
        const common={key:f.name,label:f.label,value:form[f.name]??'',required:f.required,onChange:e=>setForm({...form,[f.name]:f.type==='checkbox'?e.target.checked:e.target.value})}
        if(f.type==='select') return <Select {...common}>{f.options?.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</Select>
        if(f.type==='textarea') return <Textarea {...common}/>
        if(f.type==='checkbox') return <label key={f.name} className="check-field"><input type="checkbox" checked={!!form[f.name]} onChange={common.onChange}/><span>{f.label}</span></label>
        return <Input {...common} type={f.type||'text'} step={f.step}/>
      })}</div><ErrorBox error={error}/><div className="modal-actions"><Button type="button" variant="ghost" onClick={()=>setOpen(false)}>Cancel</Button><Button>Save</Button></div></form>
    </Modal>
  </>
}