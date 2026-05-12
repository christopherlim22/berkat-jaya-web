import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // PENTING: Gunakan getSession() bukan getUser() di middleware.
  // getUser() melakukan network call ke Supabase Auth server → menyebabkan 504 timeout.
  // getSession() hanya membaca cookie lokal → sangat cepat, tidak ada network call.
  // Verifikasi keamanan penuh (getUser) dilakukan di Server Components/API routes, bukan di sini.
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const isLoggedIn = !!session

  if (
    !isLoggedIn &&
    !request.nextUrl.pathname.startsWith('/api') &&
    request.nextUrl.pathname.startsWith('/dashboard')
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  if (isLoggedIn && request.nextUrl.pathname === '/') {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
