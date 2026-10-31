'use client'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const statuses = ['All', 'New', 'Contacted', 'Proposal', 'Won', 'Lost']
const dateLabel = (value?: string) => value ? new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—'
const asList = (value: unknown) => Array.isArray(value) ? value.join(', ') : (value ? String(value) : '—')

export default function WebsiteLeadsPage() {
  const supabase = createClient()
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('All')
  const [selected, setSelected] = useState<any>(null)

  async function load() {
    setLoading(true)
    setError('')
    const { data, error } = await supabase.from('leads').select('*').eq('source', 'Website').order('created_at', { ascending: false })
    if (error) setError(error.message)
    setRows(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const filtered = useMemo(() => rows.filter(row => {
    const matchesStatus = status === 'All' || (row.status || 'New') === status
    const q = search.trim().toLowerCase()
    const haystack = [row.name, row.email, row.phone, row.company, row.business_type, row.service].join(' ').toLowerCase()
    return matchesStatus && (!q || haystack.includes(q))
  }), [rows, search, status])

  async function updateStatus(id: string, next: string) {
    const { error } = await supabase.from('leads').update({ status: next }).eq('id', id)
    if (error) setError(error.message)
    else {
      setRows(prev => prev.map(row => row.id === id ? { ...row, status: next } : row))
      if (selected?.id === id) setSelected((prev: any) => ({ ...prev, status: next }))
    }
  }

  const count = (key: string) => key === 'All' ? rows.length : rows.filter(row => (row.status || 'New') === key).length

  return <div>
    <div className="topbar">
      <div><div className="eyebrow">Website enquiries</div><h1 className="page-title">Website Leads</h1><p className="page-subtitle">All enquiries submitted through the KJS Creative website, in one place.</p></div>
      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}><button className="secondary-button compact" onClick={load}>↻ Refresh</button><button className="secondary-button compact" onClick={() => { const csvRows = [['Name','Email','Phone','Company','Business Type','Budget','Services','Goals','Status','Submitted At'], ...filtered.map(r => [r.name,r.email,r.phone,r.company,r.business_type,r.budget,asList(r.services),asList(r.goals),r.status,dateLabel(r.created_at)])]; const csv = csvRows.map(row => row.map(v => '"' + String(v ?? '').replace(/"/g,'""') + '"').join(',')).join('\n'); const url = URL.createObjectURL(new Blob([csv], {type:'text/csv;charset=utf-8;'})); const a = document.createElement('a'); a.href=url; a.download='kjs-website-leads.csv'; a.click(); URL.revokeObjectURL(url) }}>↓ Export CSV</button></div>
    </div>
    {error && <div className="form-message" style={{marginBottom:14}}>{error}</div>}
    <div className="pipeline-board" style={{gridTemplateColumns:'repeat(6,minmax(0,1fr))'}}>
      {statuses.map(key => <button key={key} className="pipeline-stage" onClick={() => setStatus(key)} style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,border:status===key?'1px solid #25252a':'1px solid #e9e7e1',background:status===key?'#f3f1ec':'#fff',padding:'12px 14px',borderRadius:12,textAlign:'left'}}><span style={{fontSize:13,fontWeight:650}}>{key}</span><strong>{count(key)}</strong></button>)}
    </div>
    <section className="panel section-gap">
      <div className="panel-head" style={{alignItems:'center',flexWrap:'wrap'}}>
        <div><div className="panel-title">Submitted enquiries</div><div className="panel-meta">{filtered.length} of {rows.length} website leads</div></div>
        <input aria-label="Search website leads" placeholder="Search name, email, phone or company…" value={search} onChange={e=>setSearch(e.target.value)} style={{maxWidth:330,minWidth:220}} />
      </div>
      {loading ? <div className="empty">Loading website enquiries…</div> : filtered.length === 0 ? <div className="empty">No website leads found.</div> : <div style={{display:'grid',gap:10}}>
        {filtered.map(row => <article key={row.id} style={{border:'1px solid #eceae5',borderRadius:14,padding:16,display:'grid',gap:12}}>
          <div style={{display:'flex',justifyContent:'space-between',gap:14,alignItems:'flex-start',flexWrap:'wrap'}}>
            <div style={{display:'flex',gap:12,minWidth:0}}>
              <div className="lead-avatar">{(row.name||'W').slice(0,1).toUpperCase()}</div>
              <div style={{minWidth:0}}><div className="lead-name">{row.name || 'Unnamed enquiry'}</div><div className="contact-line">{row.email || 'No email'} · {row.phone || 'No phone'}</div><div className="lead-meta-row"><span className="lead-service">{row.company || 'Company not provided'}</span><span className="source-badge">{row.business_type || 'Business type not provided'}</span><span className="source-badge">{dateLabel(row.created_at)}</span></div></div>
            </div>
            <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
              <select aria-label={'Status for '+row.name} value={row.status || 'New'} onChange={e=>updateStatus(row.id,e.target.value)}>{statuses.filter(x=>x!=='All').map(x=><option key={x}>{x}</option>)}</select>
              <button className="icon-button" onClick={()=>setSelected(selected?.id===row.id?null:row)}>{selected?.id===row.id?'Hide details':'View details'} ↗</button>
            </div>
          </div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap',fontSize:13,color:'#5f5e59'}}><span><b>Budget:</b> {row.budget || '—'}</span><span>·</span><span><b>Services:</b> {asList(row.services?.length ? row.services : row.service)}</span></div>
          {selected?.id===row.id && <div style={{borderTop:'1px solid #eeeae3',paddingTop:14,display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))',gap:14}}>
            {[['Full name',row.name],['Email',row.email],['Phone',row.phone],['Company',row.company],['Business type',row.business_type],['Monthly budget',row.budget],['Services requested',asList(row.services?.length?row.services:row.service)],['Goals',asList(row.goals)],['Submitted on',dateLabel(row.created_at)],['Lead status',row.status||'New']].map(([label,value])=><div key={label}><div className="eyebrow">{label}</div><div style={{fontSize:13,fontWeight:600,marginTop:4,overflowWrap:'anywhere'}}>{value || '—'}</div></div>)}
            {row.message && <div style={{gridColumn:'1/-1'}}><div className="eyebrow">Additional message</div><p style={{fontSize:13,lineHeight:1.6,whiteSpace:'pre-wrap'}}>{row.message}</p></div>}
            {row.goals?.length>0 && <div style={{gridColumn:'1/-1'}}><div className="eyebrow">Goals selected</div><p style={{fontSize:13}}>{asList(row.goals)}</p></div>}
          </div>}
        </article>)}
      </div>}
    </section>
  </div>
}
