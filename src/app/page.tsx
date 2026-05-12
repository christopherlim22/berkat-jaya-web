"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/utils/supabase/client"

type Transaksi = {
  id: number
  no_nota: string
  tanggal: string
  nama_pembeli: string
  jenis_pembayaran: string
  total: number
}

export default function DashboardPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [omzetHariIni, setOmzetHariIni] = useState(0)
  const [jumlahTransaksi, setJumlahTransaksi] = useState(0)
  const [totalPiutang, setTotalPiutang] = useState(0)
  const [jumlahPelanggan, setJumlahPelanggan] = useState(0)
  const [recentTransaksi, setRecentTransaksi] = useState<Transaksi[]>([])

  const formatRp = (num: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(num)

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    setIsLoading(true)
    try {
      // Today's date range (local)
      const now = new Date()
      const tzOffset = now.getTimezoneOffset() * 60000
      const todayLocal = new Date(now.getTime() - tzOffset).toISOString().split('T')[0]
      const startOfDay = new Date(todayLocal + 'T00:00:00.000Z').toISOString()
      const endOfDay = new Date(todayLocal + 'T23:59:59.999Z').toISOString()

      // Transaksi hari ini
      const { data: txHariIni } = await supabase
        .from('transaksi')
        .select('total')
        .gte('tanggal', startOfDay)
        .lte('tanggal', endOfDay)

      if (txHariIni) {
        setJumlahTransaksi(txHariIni.length)
        setOmzetHariIni(txHariIni.reduce((acc, tx) => acc + (tx.total || 0), 0))
      }

      // Total piutang belum lunas
      const { data: piutangData } = await supabase
        .from('piutang')
        .select('sisa')
        .eq('status', 'belum lunas')

      if (piutangData) {
        setTotalPiutang(piutangData.reduce((acc, p) => acc + (p.sisa || 0), 0))
      }

      // Jumlah pelanggan
      const { count: pelangganCount } = await supabase
        .from('pelanggan')
        .select('*', { count: 'exact', head: true })

      setJumlahPelanggan(pelangganCount || 0)

      // 5 transaksi terbaru
      const { data: recent } = await supabase
        .from('transaksi')
        .select('*')
        .order('tanggal', { ascending: false })
        .limit(5)

      if (recent) setRecentTransaksi(recent as Transaksi[])

    } catch (err) {
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  const paymentColor = (jenis: string) => {
    if (jenis === 'Tunai') return 'bg-green-500/10 text-green-400 border-green-500/20'
    if (jenis === 'Transfer') return 'bg-blue-500/10 text-blue-400 border-blue-500/20'
    if (jenis === 'Piutang') return 'bg-red-500/10 text-red-400 border-red-500/20'
    return 'bg-gray-500/10 text-gray-400 border-gray-500/20'
  }

  return (
    <>
      <header className="sticky top-0 z-10 flex items-center justify-between px-8 py-5 bg-[#0d1117]/80 backdrop-blur border-b border-white/[0.05]">
        <div>
          <h2 className="text-2xl font-bold text-white">Dashboard</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {new Date().toLocaleDateString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchDashboardData}
            className="text-sm text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/5 px-4 py-2 rounded-xl transition-colors"
          >
            🔄 Refresh
          </button>
          <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 px-4 py-2 rounded-xl">
            <div className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-sm text-green-400 font-semibold">Sistem Aktif</span>
          </div>
        </div>
      </header>

      <main className="p-8 space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Selamat datang, Christopher 👋</h1>
          <p className="text-gray-400 text-base mt-1.5">Berikut ringkasan operasional Berkat Jaya hari ini.</p>
        </div>

        {/* KPI CARDS */}
        {isLoading ? (
          <div className="grid grid-cols-4 gap-5">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-[#161b22] border border-white/[0.06] rounded-2xl p-6 animate-pulse h-36" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-5">
            <div className="bg-[#161b22] border border-white/[0.06] rounded-2xl p-6 hover:border-green-500/20 transition-colors">
              <div className="flex items-start justify-between mb-4">
                <span className="text-3xl">💰</span>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-green-500/10 text-green-400">Hari ini</span>
              </div>
              <p className="text-2xl font-bold text-white">{formatRp(omzetHariIni)}</p>
              <p className="text-sm text-gray-400 mt-2">Total Omzet Hari Ini</p>
            </div>

            <div className="bg-[#161b22] border border-white/[0.06] rounded-2xl p-6 hover:border-blue-500/20 transition-colors">
              <div className="flex items-start justify-between mb-4">
                <span className="text-3xl">🧾</span>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400">Hari ini</span>
              </div>
              <p className="text-2xl font-bold text-white">{jumlahTransaksi} <span className="text-base text-gray-500 font-normal">transaksi</span></p>
              <p className="text-sm text-gray-400 mt-2">Jumlah Transaksi</p>
            </div>

            <div className="bg-[#161b22] border border-white/[0.06] rounded-2xl p-6 hover:border-red-500/20 transition-colors">
              <div className="flex items-start justify-between mb-4">
                <span className="text-3xl">📝</span>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-red-500/10 text-red-400">Belum lunas</span>
              </div>
              <p className="text-2xl font-bold text-red-400">{formatRp(totalPiutang)}</p>
              <p className="text-sm text-gray-400 mt-2">Total Piutang</p>
            </div>

            <div className="bg-[#161b22] border border-white/[0.06] rounded-2xl p-6 hover:border-purple-500/20 transition-colors">
              <div className="flex items-start justify-between mb-4">
                <span className="text-3xl">👥</span>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-400">Total</span>
              </div>
              <p className="text-2xl font-bold text-white">{jumlahPelanggan} <span className="text-base text-gray-500 font-normal">orang</span></p>
              <p className="text-sm text-gray-400 mt-2">Jumlah Pelanggan</p>
            </div>
          </div>
        )}

        {/* TRANSAKSI TERBARU */}
        <div className="bg-[#161b22] border border-white/[0.06] rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-7 py-5 border-b border-white/[0.06]">
            <h3 className="font-bold text-white text-lg">Transaksi Terbaru</h3>
            <a href="/dashboard/transaksi" className="text-sm text-green-400 hover:text-green-300 transition-colors font-medium">
              Lihat semua →
            </a>
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-gray-500">Memuat data...</div>
          ) : recentTransaksi.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <span className="text-4xl block mb-3 opacity-40">📭</span>
              Belum ada transaksi
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {recentTransaksi.map((tx) => (
                <div key={tx.id} className="flex items-center gap-5 px-7 py-4 hover:bg-white/[0.02] transition-colors">
                  <div className="w-36 text-xs text-gray-500 font-mono">{tx.no_nota}</div>
                  <div className="flex-1">
                    <p className="text-base text-white font-semibold">{tx.nama_pembeli}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{formatDate(tx.tanggal)}</p>
                  </div>
                  <span className={`text-xs px-3 py-1.5 rounded-full font-medium border ${paymentColor(tx.jenis_pembayaran)}`}>
                    {tx.jenis_pembayaran}
                  </span>
                  <div className="text-base font-semibold text-white w-32 text-right">{formatRp(tx.total)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  )
}
