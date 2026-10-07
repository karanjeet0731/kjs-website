'use client'

import{useEffect,useState}from'react'
import{createClient}from'@/lib/supabase/client'

type Project={id:string,name:string,description?:string|null,status?:string|null,created_at?:string|null}

const emptyForm={name:'',description:'',status:'active'}

export default function Projects(){
  const s=createClient()
  const[rows,setRows]=useState<Project[]>([])
  const[form,setForm]=useState(emptyForm)
  const[editing,setEditing]=useState<string|null>(null)
  const[msg,setMsg]=useState('')
  const[saving,setSaving]=useState(false)

  const load=async()=>{
    const{data,error}=await s.from('projects').select('*').order('created_at',{ascending:false})
    if(error)setMsg(error.message)
    setRows(data??[])
  }

  useEffect(()=>{load()},[])

  const reset=()=>{setForm(emptyForm);setEditing(null)}

  async function save(e:any){
    e.preventDefault()
    setSaving(true);setMsg('')
    const payload={name:form.name.trim(),description:form.description.trim()||null,status:form.status}
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
    setForm({name:x.name||'',description:x.description||'',status:x.status||'active'})
    setMsg('')
    window.scrollTo({top:0,behavior:'smooth'})
  }

  async function remove(x:Project){
    if(!window.confirm(`Delete project “${x.name}”? This cannot be undone.`))return
    setMsg('')
    const{error}=await s.from('projects').delete().eq('id',x.id)
    if(error)setMsg(error.message)
    else{
      setRows(rows.filter(r=>r.id!==x.id))
      if(editing===x.id)reset()
      setMsg('Project deleted successfully.')
    }
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
          <input required placeholder="Project name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/>
          <input placeholder="Description" value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/>
          <select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>
            <option value="active">active</option><option value="completed">completed</option><option value="on_hold">on hold</option>
          </select>
        </div>
        <div className="form-actions">
          <button className="primary-button compact" disabled={saving}>{saving?(editing?'Saving…':'Creating…'):(editing?'Save changes':'Create project')}</button>
          {msg&&<span className="form-message">{msg}</span>}
        </div>
      </form>
    </section>

    <section className="panel section-gap">
      <div className="panel-head"><b>Projects</b><span className="panel-meta">{rows.length} records</span></div>
      {rows.map(x=><div className="lead-row project-row" key={x.id}>
        <div><div className="lead-name">{x.name}</div><div className="lead-service">{x.description||'No description'}</div></div>
        <div></div>
        <span className="pill new">{x.status||'active'}</span>
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
