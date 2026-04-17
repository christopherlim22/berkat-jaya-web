import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Dashboard | Berkat Jaya",
  description: "Dashboard Sistem Manajemen Distribusi Ayam Berkat Jaya",
}

const stats = [
  { label: "Total Penjualan Hari Ini", value: "Rp 8.450.000", change: "+12%", up: true, icon: "💰" },
  { label: "Pesanan Aktif", value: "24", change: "+3", up: true, icon: "📦" },
  { label: "Stok Ayam (kg)", value: "1.240 kg", change: "-80 kg", up: false, icon: "🐔" },
  { label: "Pengiriman Hari Ini", value: "18", change: "+5", up: true, icon: "🚚" },
]

const recentOrders = [
  { id: "ORD-001", customer: "Pasar Induk Bogor", qty: "200 kg", status: "Dikirim", time: "08:30" },
  { id: "ORD-002", customer: "Restoran Padang Jaya", qty: "50 kg", status: "Diproses", time: "09:15" },
  { id: "ORD-003", customer: "Supermarket Sejahtera", qty: "150 kg", status: "Menunggu", time: "10:00" },
  { id: "ORD-004", customer: "Warung Bu Sari", qty: "30 kg", status: "Selesai", time: "07:00" },
  { id: "ORD-005", customer: "Hotel Grand Nusantara", qty: "80 kg", status: "Dikirim", time: "09:45" },
]

const statusColors: Record<string, string> = {
  Dikirim: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
  Diproses: "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20",
  Menunggu: "bg-gray-500/10 text-gray-400 border border-gray-500/20",
  Selesai: "bg-green-500/10 text-green-400 border border-green-500/20",
}

export default function DashboardPage() {
  return (
    <>
      {/* Top bar */}
      <header className="sticky top-0 z-10 flex items-center justify-between px-8 py-5 bg-[#0d1117]/80 backdrop-blur border-b border-white/[0.05]">
        <div>
          <h2 className="text-2xl font-bold text-white">Dashboard</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {new Date().toLocaleDateString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
        <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 px-4 py-2 rounded-xl">
          <div className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" />
          <span className="text-sm text-green-400 font-semibold">Sistem Aktif</span>
        </div>
      </header>

      <main className="p-8">
        {/* Welcome */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Selamat datang, Admin 👋</h1>
          <p className="text-gray-400 text-base mt-1.5">
            Berikut ringkasan operasional Berkat Jaya hari ini.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-5 mb-8">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="bg-[#161b22] border border-white/[0.06] rounded-2xl p-6 hover:border-green-500/20 transition-colors"
            >
              <div className="flex items-start justify-between mb-4">
                <span className="text-3xl">{stat.icon}</span>
                <span
                  className={`text-sm font-semibold px-2.5 py-1 rounded-full ${
                    stat.up
                      ? "bg-green-500/10 text-green-400"
                      : "bg-red-500/10 text-red-400"
                  }`}
                >
                  {stat.change}
                </span>
              </div>
              <p className="text-3xl font-bold text-white">{stat.value}</p>
              <p className="text-sm text-gray-400 mt-2 leading-snug">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Recent Orders */}
        <div className="bg-[#161b22] border border-white/[0.06] rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-7 py-5 border-b border-white/[0.06]">
            <h3 className="font-bold text-white text-lg">Pesanan Terbaru</h3>
            <button className="text-sm text-green-400 hover:text-green-300 transition-colors font-medium">
              Lihat semua →
            </button>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {recentOrders.map((order) => (
              <div
                key={order.id}
                className="flex items-center gap-5 px-7 py-5 hover:bg-white/[0.02] transition-colors"
              >
                <div className="w-20 text-sm text-gray-500 font-mono">{order.id}</div>
                <div className="flex-1">
                  <p className="text-base text-white font-semibold">{order.customer}</p>
                  <p className="text-sm text-gray-500 mt-0.5">{order.qty}</p>
                </div>
                <span className={`text-sm px-3 py-1.5 rounded-full font-medium ${statusColors[order.status]}`}>
                  {order.status}
                </span>
                <div className="text-sm text-gray-500 w-14 text-right font-medium">{order.time}</div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </>
  )
}
