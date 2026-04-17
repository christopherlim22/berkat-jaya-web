import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Laporan | Berkat Jaya",
}

const monthlyData = [
  { bulan: "Oktober 2025", penjualan: "Rp 62.400.000", pesanan: 142, kg: "3.900 kg" },
  { bulan: "November 2025", penjualan: "Rp 71.200.000", pesanan: 168, kg: "4.450 kg" },
  { bulan: "Desember 2025", penjualan: "Rp 98.500.000", pesanan: 215, kg: "6.156 kg" },
  { bulan: "Januari 2026", penjualan: "Rp 55.800.000", pesanan: 130, kg: "3.488 kg" },
  { bulan: "Februari 2026", penjualan: "Rp 64.300.000", pesanan: 151, kg: "4.019 kg" },
  { bulan: "Maret 2026", penjualan: "Rp 79.600.000", pesanan: 188, kg: "4.975 kg" },
]

export default function LaporanPage() {
  return (
    <>
      <header className="sticky top-0 z-10 flex items-center justify-between px-8 py-5 bg-[#0d1117]/80 backdrop-blur border-b border-white/[0.05]">
        <div>
          <h2 className="text-2xl font-bold text-white">Laporan</h2>
          <p className="text-sm text-gray-500 mt-0.5">Ringkasan performa bisnis Berkat Jaya</p>
        </div>
        <button className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors">
          <span>⬇</span> Unduh Laporan
        </button>
      </header>

      <main className="p-8">
        {/* KPI summary */}
        <div className="grid grid-cols-3 gap-5 mb-8">
          {[
            { label: "Total Pendapatan (6 Bln)", value: "Rp 431.800.000", icon: "💰", change: "+14%", up: true },
            { label: "Total Pesanan (6 Bln)", value: "994 Pesanan", icon: "📦", change: "+8%", up: true },
            { label: "Rata-rata per Bulan", value: "Rp 71.967.000", icon: "📊", change: "+6%", up: true },
          ].map((card) => (
            <div key={card.label} className="bg-[#161b22] border border-white/[0.06] rounded-2xl p-6">
              <div className="flex items-start justify-between mb-4">
                <span className="text-3xl">{card.icon}</span>
                <span className={`text-sm font-semibold px-2.5 py-1 rounded-full ${card.up ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
                  {card.change}
                </span>
              </div>
              <p className="text-2xl font-bold text-white">{card.value}</p>
              <p className="text-sm text-gray-400 mt-1">{card.label}</p>
            </div>
          ))}
        </div>

        {/* Monthly table */}
        <div className="bg-[#161b22] border border-white/[0.06] rounded-2xl overflow-hidden">
          <div className="px-7 py-5 border-b border-white/[0.06]">
            <h3 className="font-bold text-white text-lg">Rekap Bulanan</h3>
          </div>
          <div className="grid grid-cols-4 gap-4 px-7 py-3 bg-white/[0.02] border-b border-white/[0.04] text-sm font-semibold text-gray-500 uppercase tracking-wide">
            <div>Bulan</div>
            <div>Penjualan</div>
            <div>Jumlah Pesanan</div>
            <div>Total (kg)</div>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {monthlyData.map((row, i) => (
              <div
                key={row.bulan}
                className={`grid grid-cols-4 gap-4 items-center px-7 py-5 hover:bg-white/[0.02] transition-colors ${i === monthlyData.length - 1 ? "bg-green-500/[0.03]" : ""}`}
              >
                <div className="text-base font-medium text-white">{row.bulan}</div>
                <div className="text-base font-bold text-green-400">{row.penjualan}</div>
                <div className="text-base text-gray-300">{row.pesanan} pesanan</div>
                <div className="text-base text-gray-300">{row.kg}</div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </>
  )
}
