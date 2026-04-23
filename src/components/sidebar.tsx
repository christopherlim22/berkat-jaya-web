"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { createClient } from "@/utils/supabase/client"
import { useState, useEffect } from "react"
import { getUserRole } from "@/utils/supabase/getUserRole"

const navItems = [
  { icon: "▦", label: "Dashboard", href: "/dashboard", allowedRoles: ['admin'] },
  { icon: "📦", label: "Pesanan & Pengiriman", href: "/dashboard/pesanan", allowedRoles: ['admin','kasir'] },
  { icon: "🛒", label: "Kasir", href: "/dashboard/kasir", allowedRoles: ['admin','kasir'] },
  { icon: "🧾", label: "Transaksi", href: "/dashboard/transaksi", allowedRoles: ['admin','kasir'] },
  { icon: "📝", label: "Piutang", href: "/dashboard/piutang", allowedRoles: ['admin'] },
  { icon: "🧾", label: "Utang", href: "/dashboard/utang-supplier", allowedRoles: ['admin'] },
  { icon: "🐔", label: "Stok", href: "/dashboard/stok-ayam", allowedRoles: ['admin','kasir'] },
  { icon: "💸", label: "Pengeluaran", href: "/dashboard/pengeluaran", allowedRoles: ['admin'] },
  { icon: "🗄️", label: "Master Data", href: "/dashboard/master-data", allowedRoles: ['admin'] },
  { icon: "📊", label: "Laporan", href: "/dashboard/laporan", allowedRoles: ['admin'] },
  { icon: "📋", label: "Rekap", href: "/dashboard/rekap", allowedRoles: ['admin'] },
  { icon: "⚙️", label: "Pengaturan", href: "/dashboard/pengaturan", allowedRoles: ['admin'] },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [role, setRole] = useState<'admin' | 'kasir' | null>(null)

  useEffect(() => {
    getUserRole().then(r => setRole(r))
  }, [])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.refresh()
    router.push("/")
  }

  return (
    <>
      {/* Mobile header bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 z-30 bg-[#161b22] border-b border-white/[0.06] flex items-center px-4 gap-3">
        <button
          onClick={() => setIsOpen(true)}
          className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-white text-lg"
          aria-label="Buka menu"
        >
          ☰
        </button>
        <div className="flex items-center gap-2">
          <span className="text-xl">🐔</span>
          <span className="font-bold text-white text-base">Berkat Jaya</span>
        </div>
      </div>

      {/* Backdrop (mobile) */}
      {isOpen && (
        <div
          className="md:hidden fixed inset-0 z-30 bg-black/60 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-72 bg-[#161b22] border-r border-white/[0.06] flex flex-col z-40 transition-transform duration-300 ease-in-out
          ${isOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}
      >
        {/* Brand */}
        <div className="px-6 py-6 border-b border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center shrink-0">
              <span className="text-2xl">🐔</span>
            </div>
            <div>
              <p className="font-bold text-white text-lg leading-tight">Berkat Jaya</p>
              <p className="text-xs text-green-400/70 leading-tight mt-0.5">Distribusi Ayam</p>
            </div>
          </div>
          {/* Close button (mobile) */}
          <button
            onClick={() => setIsOpen(false)}
            className="md:hidden w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400"
            aria-label="Tutup menu"
          >
            ✕
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-4 py-5 space-y-1.5 overflow-y-auto">
          {role && navItems.filter(item => item.allowedRoles.includes(role)).map((item) => {
            const isActive =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href)

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={`flex items-center gap-3.5 px-4 py-3 rounded-xl text-base font-medium transition-all duration-150 ${
                  isActive
                    ? "bg-green-500/10 text-green-400 border border-green-500/20"
                    : "text-gray-400 hover:bg-white/5 hover:text-white border border-transparent"
                }`}
              >
                <span className="text-xl w-6 text-center">{item.icon}</span>
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* User + Logout */}
        <div className="px-4 py-5 border-t border-white/[0.06]">
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 mb-2">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 ${role === 'kasir' ? 'bg-blue-600' : 'bg-green-600'}`}>
              {role === 'kasir' ? 'KS' : 'AD'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-semibold text-white truncate">{role === 'kasir' ? 'Kasir' : 'Admin'}</p>
              <div className="mt-1">
                {role === 'kasir' ? (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">KASIR</span>
                ) : (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/20">ADMIN</span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm text-gray-500 hover:text-red-400 hover:bg-red-500/5 transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Keluar
          </button>
        </div>
      </aside>
    </>
  )
}
