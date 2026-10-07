'use client'

import{useEffect,useState}from'react'
import{createClient}from'@/lib/supabase/client'

type Client={id:string,name:string,company?:string|null}
type Project={id:string,title:string,client_id:string}
type Invoice={id:string,invoice_number:string,client_id:string,project_id?:string|null,amount:number,currency?:string|null,status:string,issue_date?:string|null,due_date?:string|null,created_at?:string|null}

const initial={client_id:'',project_id:'',amount:'',status:'draft',due_date:''}

export default function Invoices(){
  const s=createClient()
  const[rows,setRows]=useState<Invoice[]>([])
  const[clients,setClients]=useState<Client[]>([])
  const[projects,setProjects]=useState<Project[]>([])
  const[f,setF]=useState(initial)
  const[msg,setMsg]=useState('')
  const[saving,setSaving]=useState(false)

  const load=async()=>{
    const[{data:inv,error:iErr},{data:c,error:cErr},{data:p,error:pErr}]=await Promise.all([
      s.from('invoices').select('*').order('created_at',{ascending:false}),
      s.from('clients').select('id,name,company').order('name'),
      s.from('projects').select('id,title,client_id').order('title')
    ])
    if(iErr)setMsg(iErr.message);else setRows(inv??[])
    if(cErr)setMsg(cErr.message);else setClients(c??[])
    if(pErr)setMsg(pErr.message);else setProjects(p??[])
  }

  useEffect(()=>{load()},[])

  const clientName=(id:string)=>{
    const c=clients.find(x=>x.id===id)
    return c?.company?c.company+' · '+c.name:(c?.name||'Client')
  }

  const makeNumber=()=>`KJS-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`

  async function add(e:any){
    e.preventDefault()
    setSaving(true);setMsg('')
    const amount=Number(f.amount)
    if(!f.client_id){setMsg('Please select a client.');setSaving(false);return}
    if(!Number.isFinite(amount)||amount<0){setMsg('Please enter a valid amount.');setSaving(false);return}

    const payload={
      invoice_number:makeNumber(),
      client_id:f.client_id,
      project_id:f.project_id||null,
      amount,
      currency:'INR',
      status:f.status,
      issue_date:new Date().toISOString().slice(0,10),
      due_date:f.due_date||null
    }

    const{error}=await s.from('invoices').insert(payload)
    if(error)setMsg(error.message)
    else{
      setMsg('Invoice created successfully.')
      setF(initial)
      await load()
    }
    setSaving(false)
  }

  async function remove(id:string){
    if(!window.confirm('Delete this invoice? This cannot be undone.'))return
    const{error}=await s.from('invoices').delete().eq('id',id)
    if(error)setMsg(error.message)
    else{setRows(rows.filter(x=>x.id!==id));setMsg('Invoice deleted successfully.')}
  }

  const visibleProjects=projects.filter(p=>!f.client_id||p.client_id===f.client_id)

  return <main className="main">
    <div className="topbar">
      <div><div className="eyebrow">Finance</div><h1 className="page-title">Invoices</h1><p className="page-subtitle">Create and track client invoices.</p></div>
    </div>

    <section className="panel">
      <div className="panel-head"><div><b>New invoice</b><div className="panel-meta">Create an invoice for an existing client.</div></div></div>
      <form className="lead-form" onSubmit={add}>
        <div className="form-grid">
          <select required value={f.client_id} onChange={e=>setF({...f,client_id:e.target.value,project_id:''})}>
            <option value="">Select client *</option>
            {clients.map(c=><option key={c.id} value={c.id}>{c.company?c.company+' · ':''}{c.name}</option>)}
          </select>
          <select value={f.project_id} onChange={e=>setF({...f,project_id:e.target.value})}>
            <option value="">Project (optional)</option>
            {visibleProjects.map(p=><option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
          <input required min="0" step="0.01" type="number" placeholder="Amount (₹) *" value={f.amount} onChange={e=>setF({...f,amount:e.target.value})}/>
          <select value={f.status} onChange={e=>setF({...f,status:e.target.value})}>
            <option value="draft">Draft</option><option value="sent">Sent</option><option value="paid">Paid</option><option value="overdue">Overdue</option><option value="cancelled">Cancelled</option>
          </select>
          <input type="date" value={f.due_date} onChange={e=>setF({...f,due_date:e.target.value})}/>
        </div>
        <div className="form-actions">
          <button className="primary-button compact" disabled={saving||!clients.length}>{saving?'Creating…':'Create invoice'}</button>
          {!clients.length&&<span className="form-message">Add a client first, then create an invoice.</span>}
          {msg&&<span className="form-message">{msg}</span>}
        </div>
      </form>
    </section>

    <section className="panel section-gap">
      <div className="panel-head"><b>Invoices</b><span className="panel-meta">{rows.length} records</span></div>
      {rows.map(x=><div className="lead-row" key={x.id}>
        <div><div className="lead-name">{x.invoice_number}</div><div className="lead-service">{clientName(x.client_id)}</div></div>
        <div className="lead-name">₹{Number(x.amount||0).toLocaleString('en-IN')}</div>
        <span className="pill pending">{x.status}</span>
        <div className="lead-date">{x.due_date?'Due '+new Date(x.due_date).toLocaleDateString('en-IN'):''}</div>
        <button type="button" className="delete-button" onClick={()=>remove(x.id)}>Delete</button>
      </div>)}
      {!rows.length&&<div className="empty">No invoices yet.</div>}
    </section>
  </main>
}