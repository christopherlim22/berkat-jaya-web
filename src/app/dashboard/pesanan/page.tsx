import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Pesanan | Berkat Jaya",
}

const orders = [
  { id: "ORD-001", customer: "Pasar Induk Bogor", qty: "200 kg", total: "Rp 3.200.000", status: "Dikirim", date: "16 Apr 2026" },
  { id: "ORD-002", customer: "Restoran Padang Jaya", qty: "50 kg", total: "Rp 800.000", status: "Diproses", date: "16 Apr 2026" },
  { id: "ORD-003", customer: "Supermarket Sejahtera", qty: "150 kg", total: "Rp 2.400.000", status: "Menunggu", date: "16 Apr 2026" },
  { id: "ORD-004", customer: "Warung Bu Sari", qty: "30 kg", total: "Rp 480.000", status: "Selesai", date: "16 Apr 2026" },
  { id: "ORD-005", customer: "Hotel Grand Nusantara", qty: "80 kg", total: "Rp 1.280.000", status: "Dikirim", date: "15 Apr 2026" },
  { id: "ORD-006", customer: "Rumah Makan Sederhana", qty: "60 kg", total: "Rp 960.000", status: "Selesai", date: "15 Apr 2026" },
]

const statusColors: Record<string, string> = {
  Dikirim: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
  Diproses: "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20",
  Menunggu: "bg-gray-500/10 text-gray-400 border border-gray-500/20",
  Selesai: "bg-green-500/10 text-green-400 border border-green-500/20",
}

export default function PesananPage() {
  return (
    <>
      <header className="sticky top-0 z-10 flex items-center justify-between px-8 py-5 bg-[#0d1117]/80 backdrop-blur border-b border-white/[0.05]">
        <div>
          <h2 className="text-2xl font-bold text-white">Pesanan</h2>
          <p className="text-sm text-gray-500 mt-0.5">Kelola semua pesanan pelanggan</p>
        </div>
        <button className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors">
          <span className="text-base">+</span> Tambah Pesanan
        </button>
      </header>

      <main className="p-8">
        <div className="bg-[#161b22] border border-white/[0.06] rounded-2xl overflow-hidden">
          <div className="px-7 py-5 border-b border-white/[0.06]">
            <h3 className="font-bold text-white text-lg">Daftar Pesanan</h3>
          </div>
          {/* Table header */}
          <div className="grid grid-cols-6 gap-4 px-7 py-3 bg-white/[0.02] border-b border-white/[0.04] text-sm font-semibold text-gray-500 uppercase tracking-wide">
            <div>No. Pesanan</div>
            <div className="col-span-2">Pelanggan</div>
            <div>Jumlah</div>
            <div>Total</div>
            <div>Status</div>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {orders.map((order) => (
              <div key={order.id} className="grid grid-cols-6 gap-4 items-center px-7 py-5 hover:bg-white/[0.02] transition-colors">
                <div className="text-sm font-mono text-gray-400">{order.id}</div>
                <div className="col-span-2">
                  <p className="text-base font-semibold text-white">{order.customer}</p>
                  <p className="text-sm text-gray-500 mt-0.5">{order.date}</p>
                </div>
                <div className="text-base text-white">{order.qty}</div>
                <div className="text-base font-semibold text-white">{order.total}</div>
                <div>
                  <span className={`text-sm px-3 py-1.5 rounded-full font-medium ${statusColors[order.status]}`}>
                    {order.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </>
  )
}
