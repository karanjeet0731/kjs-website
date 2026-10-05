import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function Dashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('full_name, role, approved').eq('id', user.id).single()
  const signOut = <form action="/auth/signout" method="post"><button>Log out</button></form>

  if (!profile?.approved) return <main style={{ maxWidth: 480, margin: '15vh auto', padding: 16 }}><h1>Waiting for approval</h1><p>Your account ({user.email}) is confirmed, but an admin has not approved it yet.</p>{signOut}</main>

  const count = async (table: string) => (await supabase.from(table).select('*', { count: 'exact', head: true })).count ?? 0
  const [leads, clients, projects, tasks, invoices] = await Promise.all(['leads', 'clients', 'projects', 'tasks', 'invoices'].map(count))
  const { data: recent } = await supabase.from('leads').select('id, name, service, status, created_at').order('created_at', { ascending: false }).limit(10)

  return <main style={{ maxWidth: 900, margin: '0 auto', padding: 16 }}>
    <header style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center' }}><h1>KJS CRM</h1><span>{profile.full_name ?? user.email} ({profile.role}) {signOut}</span></header>
    <p>Leads {leads} · Clients {clients} · Projects {projects} · Tasks {tasks} · Invoices {invoices}</p>
    <h2>Recent leads</h2>
    {recent?.length ? <ul>{recent.map(l => <li key={l.id}>{l.name} — {l.service ?? '—'} — {l.status}</li>)}</ul> : <p>No leads yet.</p>}
  </main>
}
