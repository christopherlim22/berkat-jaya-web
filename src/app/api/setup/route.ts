import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET() {
  const supabase = createClient()
  
  const { data, error } = await supabase.auth.signUp({
    email: 'berkatjaya.lampung@gmail.com',
    password: 'BerkatJaya2026!',
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ message: 'Admin account created successfully', user: data.user })
}
