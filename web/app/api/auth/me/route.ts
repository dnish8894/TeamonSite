import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET() {
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll() {},
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json(null, { status: 401 })

  // Look up the user profile in our users table (match by email)
  const { data: profile } = await supabaseAdmin
    .from('users')
    .select('id, full_name, email, role, avatar_url')
    .eq('email', user.email!)
    .single()

  if (!profile) {
    // Auth user exists but no profile row — return minimal info
    return NextResponse.json({ id: user.id, email: user.email, full_name: user.email, role: 'admin' })
  }

  return NextResponse.json(profile)
}
