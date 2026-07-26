import React from 'react'
import CrudPage from './CrudPage'

export default function SuppliersPage(){
 return <CrudPage
  title="Suppliers"
  subtitle="Manage supplier details"
  endpoint="/suppliers/"
  searchKeys={['name','code','company_name','phone']}
  initial={{
   code:'',
   name:'',
   company_name:'',
   phone:'',
   email:'',
   address:'',
   trn:'',
   opening_balance:'0',
   bank_details:'',
   notes:'',
   is_active:true
  }}
  fields={[
   {name:'code',label:'Supplier Code',required:true},
   {name:'name',label:'Supplier Name',required:true},
   {name:'company_name',label:'Company Name'},
   {name:'phone',label:'Phone'},
   {name:'email',label:'Email',type:'email'},
   {name:'address',label:'Address',type:'textarea'},
   {name:'trn',label:'TRN / Tax No'},
   {name:'bank_details',label:'Bank Details',type:'textarea'},
   {name:'notes',label:'Notes',type:'textarea'},
   {name:'is_active',label:'Active',type:'checkbox'}
  ]}
  columns={[
   {key:'code',label:'Code'},
   {key:'name',label:'Name'},
   {key:'company_name',label:'Company'},
   {key:'phone',label:'Phone'},
   {key:'outstanding_balance',label:'Outstanding'}
  ]}
/>
}