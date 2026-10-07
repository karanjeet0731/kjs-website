'use client'

import{useEffect,useState}from'react'
import{createClient}from'@/lib/supabase/client'

type Client={id:string,name:string,company?:string|null}
type Project={id:string,client_id:string,title:string,description?:string|null,status?:string|null,created_at?:string|null}
const emptyForm={client_id:'',title:'',description:'',status:'planning'}

export default function Projects(){
  const s=createClient()
  const[rows,setRows]=useState<Project[]>([])
  const[clients,setClients]=useState<Client[]>([])
  const[form,setForm]=useState(emptyForm)
  const[editing,setEditing]=useState<string|null>(null)
  const[msg,setMsg]=useState('')
  const[saving,setSaving]=useState(false)

  const load=async()=>{
    const[{data:projects,error:pError},{data:clientRows,error:cError}]=await Promise.all([
      s.from('projects').select('*').order('created_at',{ascending:false}),
      s.from('clients').select('id,name,company').order('name')
    ])
    if(pError)setMsg(pError.message)
    else setRows(projects??[])
    if(cError)setMsg(cError.message)
    else setClients(clientRows??[])
  }

  useEffect(()=>{load()},[])

  const reset=()=>{setForm(emptyForm);setEditing(null)}

  async function save(e:any){
    e.preventDefault()
    setSaving(true);setMsg('')

    if(!form.client_id){setMsg('Please select a client.');setSaving(false);return}

    const payload={
      client_id:form.client_id,
      title:form.title.trim(),
      description:form.description.trim()||null,
      status:form.status
    }

    const{error}=editing
      ? await s.from('projects').update(payload).eq('id',editing)
      : await s.from('projects').insert(payload)

    if(error)setMsg(error.message)
    else{
      setMsg(editing?'Project updated successfully.':'Project created successfully.')
      reset()
      await load()
    }
    setSaving(false)
  }

  function startEdit(x:Project){
    setEditing(x.id)
    setForm({
      client_id:x.client_id||'',
      title:x.title||'',
      description:x.description||'',
      status:x.status||'planning'
    })
    setMsg('')
    window.scrollTo({top:0,behavior:'smooth'})
  }

  async function remove(x:Project){
    if(!window.confirm(`Delete project “${x.title}”? This cannot be undone.`))return
    setMsg('')
    const{error}=await s.from('projects').delete().eq('id',x.id)
    if(error)setMsg(error.message)
    else{
      setRows(rows.filter(r=>r.id!==x.id))
      if(editing===x.id)reset()
      setMsg('Project deleted successfully.')
    }
  }

  const clientName=(id:string)=>{
    const c=clients.find(x=>x.id===id)
    return c?.company?c.company+' · '+c.name:(c?.name||'Unknown client')
  }

  return <main className="main">
    <div className="topbar">
      <div><div className="eyebrow">Workspace</div><h1 className="page-title">Projects</h1><p className="page-subtitle">Track client work and delivery.</p></div>
    </div>

    <section className="panel">
      <div className="panel-head">
        <div><b>{editing?'Edit project':'New project'}</b>{editing&&<div className="panel-meta">Update the project details below.</div>}</div>
        {editing&&<button type="button" className="icon-button" onClick={reset}>Cancel</button>}
      </div>

      <form className="lead-form" onSubmit={save}>
        <div className="form-grid">
          <select required value={form.client_id} onChange={e=>setForm({...form,client_id:e.target.value})}>
            <option value="">Select client *</option>
            {clients.map(c=><option key={c.id} value={c.id}>{c.company?c.company+' · ':''}{c.name}</option>)}
          </select>
          <input required placeholder="Project title *" value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/>
          <input placeholder="Description" value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/>
          <select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>
            <option value="planning">Planning</option>
            <option value="active">Active</option>
            <option value="on_hold">On hold</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <div className="form-actions">
          <button className="primary-button compact" disabled={saving||!clients.length}>
            {saving?(editing?'Saving…':'Creating…'):(editing?'Save changes':'Create project')}
          </button>
          {!clients.length&&<span className="form-message">Add a client first, then create a project.</span>}
          {msg&&<span className="form-message">{msg}</span>}
        </div>
      </form>
    </section>

    <section className="panel section-gap">
      <div className="panel-head"><b>Projects</b><span className="panel-meta">{rows.length} records</span></div>

      {rows.map(x=><div className="lead-row project-row" key={x.id}>
        <div>
          <div className="lead-name">{x.title}</div>
          <div className="lead-service">{clientName(x.client_id)}{x.description?' · '+x.description:''}</div>
        </div>
        <div></div>
        <span className="pill new">{x.status||'planning'}</span>
        <div className="lead-date">{x.created_at?new Date(x.created_at).toLocaleDateString('en-IN'):''}</div>
        <div className="row-actions">
          <button type="button" className="icon-button" onClick={()=>startEdit(x)}>Edit</button>
          <button type="button" className="delete-button" onClick={()=>remove(x)}>Delete</button>
        </div>
      </div>)}

      {!rows.length&&<div className="empty">No projects yet.</div>}
    </section>
  </main>
}
