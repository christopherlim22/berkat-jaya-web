import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Stok Ayam | Berkat Jaya",
}

const stocks = [
  { id: "STK-001", jenis: "Ayam Broiler", stok: "850 kg", harga: "Rp 16.000/kg", masuk: "200 kg", status: "Tersedia" },
  { id: "STK-002", jenis: "Ayam Kampung", stok: "320 kg", harga: "Rp 32.000/kg", masuk: "100 kg", status: "Tersedia" },
  { id: "STK-003", jenis: "Ayam Pejantan", stok: "70 kg", harga: "Rp 20.000/kg", masuk: "50 kg", status: "Menipis" },
  { id: "STK-004", jenis: "Ayam Petelur Afkir", stok: "0 kg", harga: "Rp 18.000/kg", masuk: "0 kg", status: "Habis" },
  { id: "STK-005", jenis: "Bebek Potong", stok: "140 kg", harga: "Rp 28.000/kg", masuk: "80 kg", status: "Tersedia" },
]

const statusColors: Record<string, string> = {
  Tersedia: "bg-green-500/10 text-green-400 border border-green-500/20",
  Menipis: "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20",
  Habis: "bg-red-500/10 text-red-400 border border-red-500/20",
}

export default function StokAyamPage() {
  return (
    <>
      <header className="sticky top-0 z-10 flex items-center justify-between px-8 py-5 bg-[#0d1117]/80 backdrop-blur border-b border-white/[0.05]">
        <div>
          <h2 className="text-2xl font-bold text-white">Stok Ayam</h2>
          <p className="text-sm text-gray-500 mt-0.5">Pantau ketersediaan stok unggas</p>
        </div>
        <button className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors">
          <span className="text-base">+</span> Tambah Stok
        </button>
      </header>

      <main className="p-8">
        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-5 mb-8">
          {[
            { label: "Total Stok", value: "1.380 kg", icon: "🐔", color: "green" },
            { label: "Jenis Tersedia", value: "4 Jenis", icon: "✅", color: "blue" },
            { label: "Stok Menipis/Habis", value: "2 Jenis", icon: "⚠️", color: "yellow" },
          ].map((card) => (
            <div key={card.label} className="bg-[#161b22] border border-white/[0.06] rounded-2xl p-6">
              <span className="text-3xl">{card.icon}</span>
              <p className="text-3xl font-bold text-white mt-3">{card.value}</p>
              <p className="text-sm text-gray-400 mt-1">{card.label}</p>
            </div>
          ))}
        </div>

        <div className="bg-[#161b22] border border-white/[0.06] rounded-2xl overflow-hidden">
          <div className="px-7 py-5 border-b border-white/[0.06]">
            <h3 className="font-bold text-white text-lg">Daftar Stok</h3>
          </div>
          <div className="grid grid-cols-6 gap-4 px-7 py-3 bg-white/[0.02] border-b border-white/[0.04] text-sm font-semibold text-gray-500 uppercase tracking-wide">
            <div>Kode</div>
            <div className="col-span-2">Jenis Ayam</div>
            <div>Stok</div>
            <div>Harga</div>
            <div>Status</div>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {stocks.map((item) => (
              <div key={item.id} className="grid grid-cols-6 gap-4 items-center px-7 py-5 hover:bg-white/[0.02] transition-colors">
                <div className="text-sm font-mono text-gray-400">{item.id}</div>
                <div className="col-span-2">
                  <p className="text-base font-semibold text-white">{item.jenis}</p>
                  <p className="text-sm text-gray-500 mt-0.5">Masuk hari ini: {item.masuk}</p>
                </div>
                <div className="text-base font-semibold text-white">{item.stok}</div>
                <div className="text-base text-gray-300">{item.harga}</div>
                <div>
                  <span className={`text-sm px-3 py-1.5 rounded-full font-medium ${statusColors[item.status]}`}>
                    {item.status}
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
