import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Pengiriman | Berkat Jaya",
}

const deliveries = [
  { id: "DEL-001", sopir: "Budi Santoso", tujuan: "Pasar Induk Bogor", muatan: "200 kg", berangkat: "07:00", estimasi: "08:30", status: "Selesai" },
  { id: "DEL-002", sopir: "Hendra Wijaya", tujuan: "Hotel Grand Nusantara", muatan: "80 kg", berangkat: "09:00", estimasi: "10:00", status: "Dalam Perjalanan" },
  { id: "DEL-003", sopir: "Slamet Riyadi", tujuan: "Supermarket Sejahtera", muatan: "150 kg", berangkat: "10:30", estimasi: "11:30", status: "Menunggu" },
  { id: "DEL-004", sopir: "Agus Prasetyo", tujuan: "Restoran Padang Jaya", muatan: "50 kg", berangkat: "11:00", estimasi: "12:00", status: "Menunggu" },
]

const statusColors: Record<string, string> = {
  Selesai: "bg-green-500/10 text-green-400 border border-green-500/20",
  "Dalam Perjalanan": "bg-blue-500/10 text-blue-400 border border-blue-500/20",
  Menunggu: "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20",
}

export default function PengirimanPage() {
  return (
    <>
      <header className="sticky top-0 z-10 flex items-center justify-between px-8 py-5 bg-[#0d1117]/80 backdrop-blur border-b border-white/[0.05]">
        <div>
          <h2 className="text-2xl font-bold text-white">Pengiriman</h2>
          <p className="text-sm text-gray-500 mt-0.5">Pantau status pengiriman hari ini</p>
        </div>
        <button className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors">
          <span className="text-base">+</span> Jadwalkan Pengiriman
        </button>
      </header>

      <main className="p-8">
        <div className="grid grid-cols-3 gap-5 mb-8">
          {[
            { label: "Total Pengiriman", value: "18", icon: "🚚" },
            { label: "Selesai", value: "12", icon: "✅" },
            { label: "Dalam Perjalanan", value: "6", icon: "🟡" },
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
            <h3 className="font-bold text-white text-lg">Jadwal Pengiriman</h3>
          </div>
          <div className="grid grid-cols-7 gap-3 px-7 py-3 bg-white/[0.02] border-b border-white/[0.04] text-sm font-semibold text-gray-500 uppercase tracking-wide">
            <div>ID</div>
            <div>Sopir</div>
            <div className="col-span-2">Tujuan</div>
            <div>Berangkat</div>
            <div>Estimasi</div>
            <div>Status</div>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {deliveries.map((d) => (
              <div key={d.id} className="grid grid-cols-7 gap-3 items-center px-7 py-5 hover:bg-white/[0.02] transition-colors">
                <div className="text-sm font-mono text-gray-400">{d.id}</div>
                <div className="text-base font-semibold text-white">{d.sopir}</div>
                <div className="col-span-2">
                  <p className="text-base text-white">{d.tujuan}</p>
                  <p className="text-sm text-gray-500 mt-0.5">{d.muatan}</p>
                </div>
                <div className="text-base text-gray-300">{d.berangkat}</div>
                <div className="text-base text-gray-300">{d.estimasi}</div>
                <div>
                  <span className={`text-sm px-3 py-1.5 rounded-full font-medium ${statusColors[d.status]}`}>
                    {d.status}
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
