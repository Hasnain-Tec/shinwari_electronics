import React from 'react'
import CrudPage from './CrudPage'

export default function CustomersPage(){
 return <CrudPage
  title="Customers"
  subtitle="Manage customer details"
  endpoint="/customers/"
  searchKeys={['name','code','company_name','phone']}
  initial={{
   code:'',
   name:'',
   company_name:'',
   phone:'',
   email:'',
   address:'',
   city:'',
   country:'',
   trn:'',
   credit_limit:'0',
   opening_balance:'0',
   notes:'',
   is_active:true
  }}
  fields={[
   {name:'code',label:'Customer Code',required:true},
   {name:'name',label:'Customer Name',required:true},
   {name:'company_name',label:'Company Name'},
   {name:'phone',label:'Phone'},
   {name:'email',label:'Email',type:'email'},
   {name:'address',label:'Address',type:'textarea'},
   {name:'city',label:'City'},
   {name:'country',label:'Country'},
   {name:'trn',label:'TRN / Tax No'},
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