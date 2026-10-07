'use client'

import{useEffect,useState}from'react'
import{createClient}from'@/lib/supabase/client'

type Client={id:string,name:string,email?:string|null,phone?:string|null,company?:string|null,created_at?:string|null}
const emptyForm={name:'',email:'',phone:'',company:''}

export default function Clients(){
  const s=createClient()
  const[rows,setRows]=useState<Client[]>([])
  const[form,setForm]=useState(emptyForm)
  const[editing,setEditing]=useState<string|null>(null)
  const[msg,setMsg]=useState('')
  const[saving,setSaving]=useState(false)

  const load=async()=>{
    const{data,error}=await s.from('clients').select('*').order('created_at',{ascending:false})
    if(error)setMsg(error.message)
    setRows(data??[])
  }

  useEffect(()=>{load()},[])

  const reset=()=>{setForm(emptyForm);setEditing(null)}

  async function save(e:any){
    e.preventDefault()
    setSaving(true);setMsg('')
    const{data:{user}}=await s.auth.getUser()
    if(!user){setMsg('Session expired.');setSaving(false);return}

    const payload={name:form.name.trim(),email:form.email.trim()||null,phone:form.phone.trim()||null,company:form.company.trim()||null}
    const{error}=editing
      ? await s.from('clients').update(payload).eq('id',editing)
      : await s.from('clients').insert({...payload,created_by:user.id})

    if(error)setMsg(error.message)
    else{
      setMsg(editing?'Client updated successfully.':'Client added successfully.')
      reset()
      await load()
    }
    setSaving(false)
  }

  function startEdit(x:Client){
    setEditing(x.id)
    setForm({name:x.name||'',email:x.email||'',phone:x.phone||'',company:x.company||''})
    setMsg('')
    window.scrollTo({top:0,behavior:'smooth'})
  }

  async function remove(x:Client){
    if(!window.confirm(`Delete client “${x.name}”? This cannot be undone.`))return
    setMsg('')
    const{error}=await s.from('clients').delete().eq('id',x.id)
    if(error)setMsg(error.message)
    else{
      setRows(rows.filter(r=>r.id!==x.id))
      if(editing===x.id)reset()
      setMsg('Client deleted successfully.')
    }
  }

  return <>
    <div className="topbar">
      <div><div className="eyebrow">Workspace</div><h1 className="page-title">Clients</h1><p className="page-subtitle">Your client directory.</p></div>
    </div>

    <section className="panel">
      <div className="panel-head">
        <div><b>{editing?'Edit client':'Add client'}</b>{editing&&<div className="panel-meta">Update the client details below.</div>}</div>
        {editing&&<button type="button" className="icon-button" onClick={reset}>Cancel</button>}
      </div>
      <form className="lead-form" onSubmit={save}>
        <div className="form-grid">
          <input required placeholder="Name *" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/>
          <input type="email" placeholder="Email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/>
          <input placeholder="Phone" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/>
          <input placeholder="Company" value={form.company} onChange={e=>setForm({...form,company:e.target.value})}/>
        </div>
        <div className="form-actions">
          <button className="primary-button compact" disabled={saving}>{saving?(editing?'Saving…':'Saving…'):(editing?'Save changes':'Save client')}</button>
          {msg&&<span className="form-message">{msg}</span>}
        </div>
      </form>
    </section>

    <section className="panel section-gap">
      <div className="panel-head"><b>All clients</b><span className="panel-meta">{rows.length} records</span></div>
      {rows.map(x=><div className="lead-row client-row" key={x.id}>
        <div><div className="lead-name">{x.name}</div><div className="lead-service">{x.company||x.email||'Client'}</div></div>
        <div className="lead-service">{x.phone||''}</div>
        <span className="pill new">Client</span>
        <div className="lead-date">{x.created_at?new Date(x.created_at).toLocaleDateString('en-IN'):''}</div>
        <div className="row-actions">
          <button type="button" className="icon-button" onClick={()=>startEdit(x)}>Edit</button>
          <button type="button" className="delete-button" onClick={()=>remove(x)}>Delete</button>
        </div>
      </div>)}
      {!rows.length&&<div className="empty">No clients yet.</div>}
    </section>
  </>
}
