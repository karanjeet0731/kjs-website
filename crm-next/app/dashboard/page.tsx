import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

const nav = [['⌂','Dashboard'],['◉','Leads'],['◎','Clients'],['▣','Projects'],['✓','Tasks'],['₹','Invoices'],['≡','Notes'],['◌','Activity']]

export default async function Dashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('full_name, role, approved').eq('id', user.id).single()
  const signOut = <form action="/auth/signout" method="post"><button className="logout">Log out</button></form>
  if (!profile?.approved) return <main className="login-wrap"><section className="login-card"><div className="login-brand"><div className="login-mark">KJ</div><div><h1 className="login-title">KJS CRM</h1><p className="login-copy">Creative business management</p></div></div><h2 className="login-heading">Waiting for approval</h2><p className="login-description">Your account ({user.email}) is confirmed, but an admin has not approved it yet.</p>{signOut}</section></main>

  const count = async (table: string) => (await supabase.from(table).select('*', { count: 'exact', head: true })).count ?? 0
  const [leads, clients, projects, tasks, invoices] = await Promise.all(['leads', 'clients', 'projects', 'tasks', 'invoices'].map(count))
  const { data: recent } = await supabase.from('leads').select('id, name, service, status, created_at').order('created_at', { ascending: false }).limit(8)
  const initials = (profile.full_name ?? user.email ?? 'KJ').split(' ').map((x:string)=>x[0]).slice(0,2).join('').toUpperCase()

  return <div className="crm-shell">
    <aside className="sidebar"><div className="brand"><div className="brand-mark">KJ</div><div><div className="brand-title">KJS Creative</div><div className="brand-sub">CRM Workspace</div></div></div><div className="nav-label">Workspace</div><nav className="nav">{nav.map(([icon,label],i)=><a key={label} className={i===0?'active':''} href="#"><span className="nav-icon">{icon}</span>{label}</a>)}</nav><div className="sidebar-bottom"><div className="user-mini"><div className="avatar">{initials}</div><div style={{minWidth:0}}><div className="user-name">{profile.full_name ?? user.email}</div><div className="user-role">{profile.role ?? 'Team member'}</div></div></div></div></aside>
    <main className="main"><header className="topbar"><div><div className="eyebrow">Overview</div><h1 className="page-title">Good to see you 👋</h1><p className="page-subtitle">Here’s what’s happening across KJS Creative today.</p></div><div className="top-actions"><button className="icon-button">⌕ Search</button><button className="icon-button">◔</button>{signOut}</div></header>
      <section className="stats">
        {[['Leads',leads,'↗'],['Clients',clients,'◎'],['Projects',projects,'▣'],['Tasks',tasks,'✓'],['Invoices',invoices,'₹']].map(([label,value,icon])=><div className="stat-card" key={label as string}><div className="stat-top"><span className="stat-label">{label}</span><span className="stat-icon">{icon}</span></div><div className="stat-number">{value}</div><div className="stat-foot">Live from your workspace</div></div>)}
      </section>
      <div className="grid"><section className="panel"><div className="panel-head"><div><div className="panel-title">Recent leads</div><div className="panel-meta">Latest enquiries and opportunities</div></div><span className="panel-meta">View all →</span></div><div className="panel-body">{recent?.length ? <>{recent.map(l=><div className="lead-row" key={l.id}><div><div className="lead-name">{l.name}</div><div className="lead-service">{l.service ?? 'General enquiry'}</div></div><div className="lead-service">New enquiry</div><span className={`pill ${l.status === 'won' ? 'won' : l.status === 'pending' ? 'pending' : 'new'}`}>{l.status ?? 'new'}</span><div className="lead-date">{new Date(l.created_at).toLocaleDateString('en-IN',{day:'2-digit',month:'short'})}</div></div>)}</> : <div className="empty">No leads yet. Your latest enquiries will appear here.</div>}</div></section>
        <aside><section className="panel"><div className="panel-head"><div><div className="panel-title">Quick actions</div><div className="panel-meta">Jump into your workflow</div></div></div><div className="quick-grid"><div className="quick"><strong>+ New lead</strong><span>Add an enquiry</span></div><div className="quick"><strong>+ Client</strong><span>Create a client</span></div><div className="quick"><strong>+ Project</strong><span>Start a project</span></div><div className="quick"><strong>+ Invoice</strong><span>Bill a client</span></div></div></section><section className="panel section-gap"><div className="panel-head"><div><div className="panel-title">Workspace health</div><div className="panel-meta">Your CRM at a glance</div></div></div><div className="mini-list"><div className="mini-item"><span>Active clients</span><span className="mini-value">{clients}</span></div><div className="mini-item"><span>Open projects</span><span className="mini-value">{projects}</span></div><div className="mini-item"><span>Pending tasks</span><span className="mini-value">{tasks}</span></div></div></section></aside>
      </div>
    </main>
  </div>
}
