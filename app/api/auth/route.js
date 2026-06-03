import { createClient } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function POST(request) {
  const supabase = createClient()
  const { action, email, password, name, role, secret_key, tahap_id } = await request.json()

  if (action === 'register') {
    // Semak secret key untuk guru dan admin
    if (role === 'admin' && secret_key !== process.env.ADMIN_SECRET_KEY) {
      return NextResponse.json({ error: 'Key admin tidak sah' }, { status: 401 })
    }
    if (role === 'guru' && secret_key !== process.env.GURU_SECRET_KEY) {
      return NextResponse.json({ error: 'Key guru tidak sah' }, { status: 401 })
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, role, tahap_id }
      }
    })

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ data })
  }

  if (action === 'login') {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ data })
  }

  if (action === 'logout') {
    await supabase.auth.signOut()
    return NextResponse.json({ success: true })
  }
}