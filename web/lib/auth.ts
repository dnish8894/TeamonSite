import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase-admin'

/** Resolves the logged-in user's `users` table profile from the request's auth cookies, or null if unauthenticated. */
export async function getCurrentUser(): Promise<{ id: string; full_name: string; email: string; role: string } | null> {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return null

  const { data: profile } = await supabaseAdmin
    .from('users')
    .select('id, full_name, email, role')
    .eq('email', user.email)
    .single()
  return profile ?? null
}
