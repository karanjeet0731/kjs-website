import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(list) {
        list.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })
  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname
  // This endpoint performs its own authentication using the shared sync secret
  // for Apps Script requests, or the signed-in admin session for CRM UI requests.
  const isGoogleSheetsSyncApi = path === '/api/integrations/google-sheets'
  const publicPath = path === '/login' || path.startsWith('/auth') || isGoogleSheetsSyncApi
  if (!user && !publicPath) {
    const url = request.nextUrl.clone(); url.pathname = '/login'
    return NextResponse.redirect(url)
  }
  return response
}
