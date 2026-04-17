"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/utils/supabase/client"

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!username || !password) {
      setError("Username dan password harus diisi.")
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: username,
      password,
    })
    
    if (signInError) {
      setLoading(false)
      setError("Username atau password salah")
      return
    }

    // Explicitly refresh so that layout can pick up new session if needed
    // The middleware will allow access to /dashboard now
    router.refresh()
    router.push("/dashboard")
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#0d1117] relative overflow-hidden">
      {/* Ambient background glows */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-green-600/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-green-500/8 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-green-900/5 rounded-full blur-3xl" />
      </div>

      {/* Grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(#22c55e 1px, transparent 1px), linear-gradient(90deg, #22c55e 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative z-10 w-full max-w-md px-4">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-green-500/10 border border-green-500/20 mb-4 shadow-lg shadow-green-500/5">
            {/* Chicken icon SVG */}
            <svg
              className="w-9 h-9 text-green-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2C8.5 2 6 4 6 7c0 1.5.5 2.8 1.4 3.8L5 14h3l-1 4h8l-1-4h3l-2.4-3.2C15.5 9.8 16 8.5 16 7c0-3-2.5-5-4-5z" />
              <path d="M9 7c0 0 .5-1 1.5-1" />
              <circle cx="10" cy="5.5" r=".5" fill="currentColor" stroke="none" />
              <path d="M6 14c-1.5 0-2.5 1-2.5 2.5S4.5 19 6 19" />
              <path d="M18 14c1.5 0 2.5 1 2.5 2.5S19.5 19 18 19" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">
            Berkat Jaya
          </h1>
          <p className="text-green-400/80 text-sm mt-1 font-medium tracking-wider uppercase">
            Sistem Manajemen Distribusi Ayam
          </p>
        </div>

        {/* Card */}
        <Card className="bg-[#161b22] border border-white/[0.08] shadow-2xl shadow-black/40">
          <CardHeader className="pb-4">
            <CardTitle className="text-white text-xl">Masuk ke Sistem</CardTitle>
            <CardDescription className="text-gray-400">
              Masukkan kredensial Anda untuk mengakses dashboard
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleLogin} className="space-y-5">
              {/* Error alert */}
              {error && (
                <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2.5 text-sm text-red-400">
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 3h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  </svg>
                  {error}
                </div>
              )}

              {/* Username */}
              <div className="space-y-2">
                <Label htmlFor="username" className="text-gray-300 text-sm font-medium">
                  Username
                </Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                    <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <Input
                    id="username"
                    placeholder="Masukkan username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="pl-9 bg-[#0d1117] border-white/10 text-white placeholder:text-gray-600 focus-visible:ring-green-500/50 focus-visible:border-green-500/50 h-11"
                    autoComplete="username"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-2">
                <Label htmlFor="password" className="text-gray-300 text-sm font-medium">
                  Password
                </Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                    <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Masukkan password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9 bg-[#0d1117] border-white/10 text-white placeholder:text-gray-600 focus-visible:ring-green-500/50 focus-visible:border-green-500/50 h-11"
                    autoComplete="current-password"
                  />
                </div>
              </div>

              {/* Lupa password */}
              <div className="flex justify-end">
                <button
                  type="button"
                  className="text-xs text-green-400/70 hover:text-green-400 transition-colors"
                >
                  Lupa password?
                </button>
              </div>

              {/* Submit */}
              <Button
                id="login-button"
                type="submit"
                disabled={loading}
                className="w-full h-11 bg-green-600 hover:bg-green-500 text-white font-semibold text-sm transition-all duration-200 shadow-lg shadow-green-900/30 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Memproses...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    Masuk
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </span>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-gray-600 text-xs mt-6">
          &copy; {new Date().getFullYear()} Berkat Jaya &mdash; Semua hak dilindungi
        </p>
      </div>
    </main>
  )
}
