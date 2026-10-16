import { createClient } from '@/lib/supabase/server'

/**
 * API routes that change CRM data or send mail must be restricted to approved admins.
 */
export async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, approved')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError || profile?.approved !== true || profile.role !== 'admin') return null
  return { supabase, user }
}
