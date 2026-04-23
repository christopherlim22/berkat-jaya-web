"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { createClient } from "@/utils/supabase/client"
import { useState } from "react"

const navItems = [
  { icon: "▦", label: "Dashboard", href: "/dashboard" },
  { icon: "📦", label: "Pesanan", href: "/dashboard/pesanan" },
  { icon: "🛒", label: "Kasir", href: "/dashboard/kasir" },
  { icon: "🧾", label: "Transaksi", href: "/dashboard/transaksi" },
  { icon: "📝", label: "Piutang", href: "/dashboard/piutang" },
  { icon: "🧾", label: "Utang", href: "/dashboard/utang-supplier" },
  { icon: "🐔", label: "Stok", href: "/dashboard/stok-ayam" },
  { icon: "💸", label: "Pengeluaran", href: "/dashboard/pengeluaran" },
  { icon: "🚚", label: "Pengiriman", href: "/dashboard/pengiriman" },
  { icon: "🗄️", label: "Master Data", href: "/dashboard/master-data" },
  { icon: "📊", label: "Laporan", href: "/dashboard/laporan" },
  { icon: "💧", label: "Arus Kas", href: "/dashboard/arus-kas" },
  { icon: "📋", label: "Rekap", href: "/dashboard/rekap" },
  { icon: "⚙️", label: "Pengaturan", href: "/dashboard/pengaturan" },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)

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
          {navItems.map((item) => {
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
            <div className="w-10 h-10 rounded-full bg-green-600 flex items-center justify-center text-sm font-bold text-white shrink-0">
              AD
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-semibold text-white truncate">Admin</p>
              <p className="text-xs text-gray-500 truncate">admin@berkatjaya.id</p>
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
