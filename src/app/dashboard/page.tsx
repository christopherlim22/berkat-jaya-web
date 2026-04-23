"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/utils/supabase/client"
import Link from "next/link"

type Transaksi = {
  id: number
  no_nota: string
  tanggal: string
  nama_pembeli: string
  jenis_pembayaran: string
  total: number
}

type StokAkhirItem = {
  produk_id: number
  nama_produk: string
  satuan: string
  stok_akhir: number
}

export default function DashboardPage() {
  const [filterMode, setFilterMode] = useState<'harian' | 'bulanan'>('harian')
  const [isLoading, setIsLoading] = useState(true)

  // KPI States
  const [omzet, setOmzet] = useState(0)
  const [pengeluaran, setPengeluaran] = useState(0)
  const [jumlahTransaksi, setJumlahTransaksi] = useState(0)
  const [belumKirim, setBelumKirim] = useState(0)

  // Status Pengiriman States
  const [statusPengiriman, setStatusPengiriman] = useState({ belum: 0, terkirim: 0, nota_kembali: 0 })

  // Stok Menipis State
  const [stokMenipis, setStokMenipis] = useState<StokAkhirItem[]>([])

  // Recent Transaksi
  const [recentTransaksi, setRecentTransaksi] = useState<Transaksi[]>([])

  const formatRp = (num: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(num)

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })

  const getMonthName = (date: Date) => {
    return date.toLocaleDateString('id-ID', { month: 'long' })
  }

  const getTodayDateStr = () => {
    return new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
  }

  useEffect(() => {
    fetchDashboardData()
  }, [filterMode])

  const fetchDashboardData = async () => {
    setIsLoading(true)
    try {
      const now = new Date()
      const tzOffset = now.getTimezoneOffset() * 60000
      const localNow = new Date(now.getTime() - tzOffset)
      const todayLocalStr = localNow.toISOString().split('T')[0]

      let startOfDay: string
      const endOfDay = new Date(todayLocalStr + 'T23:59:59.999Z').toISOString()

      if (filterMode === 'harian') {
        startOfDay = new Date(todayLocalStr + 'T00:00:00.000Z').toISOString()
      } else {
        const firstDayOfMonth = new Date(localNow.getFullYear(), localNow.getMonth(), 1)
        const firstDayLocalStr = new Date(firstDayOfMonth.getTime() - tzOffset).toISOString().split('T')[0]
        startOfDay = new Date(firstDayLocalStr + 'T00:00:00.000Z').toISOString()
      }

      // 1. KPI Data (Transaksi)
      const { data: txData } = await supabase
        .from('transaksi')
        .select('total')
        .gte('tanggal', startOfDay)
        .lte('tanggal', endOfDay)

      if (txData) {
        setJumlahTransaksi(txData.length)
        setOmzet(txData.reduce((acc, tx) => acc + (tx.total || 0), 0))
      } else {
        setJumlahTransaksi(0)
        setOmzet(0)
      }

      // 1. KPI Data (Pengeluaran)
      const { data: pengData } = await supabase
        .from('pengeluaran')
        .select('jumlah')
        .gte('tanggal', startOfDay.split('T')[0])
        .lte('tanggal', endOfDay.split('T')[0])

      if (pengData) {
        setPengeluaran(pengData.reduce((acc, p) => acc + (p.jumlah || 0), 0))
      } else {
        setPengeluaran(0)
      }

      // 2. Status Pengiriman (Real-time, not affected by filter)
      const { data: pengirimanData } = await supabase.from('pengiriman').select('status')
      if (pengirimanData) {
        let blm = 0, trk = 0, nk = 0
        pengirimanData.forEach(p => {
          if (p.status === 'belum_kirim') blm++
          if (p.status === 'terkirim') trk++
          if (p.status === 'nota_kembali') nk++
        })
        setBelumKirim(blm)
        setStatusPengiriman({ belum: blm, terkirim: trk, nota_kembali: nk })
      }

      // 3. Stok Menipis (Real-time, not affected by filter)
      const [pRes, hRes, tdRes, oRes, saRes] = await Promise.all([
        supabase.from('produk').select('id, nama, satuan'),
        supabase.from('hpp').select('produk_id, qty'),
        supabase.from('transaksi_detail').select('nama_produk, qty'),
        supabase.from('opname').select('produk_id, selisih'),
        supabase.from('stok_awal').select('produk_id, qty')
      ])

      const produkList = pRes.data || []
      const hppList = hRes.data || []
      const tdList = tdRes.data || []
      const opnameList = oRes.data || []
      const saList = saRes.data || []

      const stokAkhirMap = produkList.map(p => {
        const stokAwal = saList.find(s => s.produk_id === p.id)?.qty || 0
        const totalMasuk = hppList.filter(h => h.produk_id === p.id).reduce((sum, item) => sum + item.qty, 0)
        const totalKeluar = tdList.filter(t => t.nama_produk === p.nama).reduce((sum, item) => sum + item.qty, 0)
        const totalKoreksi = opnameList.filter(o => o.produk_id === p.id).reduce((sum, item) => sum + item.selisih, 0)

        const stok_akhir = stokAwal + totalMasuk - totalKeluar + totalKoreksi
        return { produk_id: p.id, nama_produk: p.nama, satuan: p.satuan, stok_akhir }
      })

      const menipis = stokAkhirMap.filter(s => s.stok_akhir <= 5)
      menipis.sort((a, b) => a.stok_akhir - b.stok_akhir)
      setStokMenipis(menipis)

      // 4. Recent Transaksi
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
    if (!jenis) return 'bg-gray-500/10 text-gray-400 border-gray-500/20'
    if (jenis === 'Tunai') return 'bg-green-500/10 text-green-400 border-green-500/20'
    if (jenis === 'Transfer') return 'bg-blue-500/10 text-blue-400 border-blue-500/20'
    if (jenis === 'Tempo') return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
    return 'bg-gray-500/10 text-gray-400 border-gray-500/20'
  }

  const todayLabel = filterMode === 'harian' ? 'Hari Ini' : 'Bulan Ini'

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
          <h1 className="text-3xl font-bold text-white mb-4">Selamat datang, Christopher 👋</h1>
          
          <div className="flex bg-[#161b22] border border-white/10 w-max rounded-xl overflow-hidden">
            <button 
              onClick={() => setFilterMode('harian')}
              className={`px-5 py-2 text-sm font-medium transition-colors border-r border-white/5 ${filterMode === 'harian' ? 'bg-green-600 text-white' : 'bg-white/5 text-gray-400 hover:text-white'}`}
            >
              Hari Ini
            </button>
            <button 
              onClick={() => setFilterMode('bulanan')}
              className={`px-5 py-2 text-sm font-medium transition-colors ${filterMode === 'bulanan' ? 'bg-green-600 text-white' : 'bg-white/5 text-gray-400 hover:text-white'}`}
            >
              Bulan Ini
            </button>
          </div>
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
            <div className="bg-[#161b22] border border-white/[0.06] rounded-2xl p-6 relative hover:border-green-500/30 transition-colors">
              <div className="flex justify-between items-start mb-4">
                <span className="text-3xl">💰</span>
              </div>
              <p className="text-2xl font-bold text-green-400">{formatRp(omzet)}</p>
              <p className="text-sm text-gray-400 mt-1">Omzet {todayLabel}</p>
              {filterMode === 'bulanan' && (
                <p className="text-xs text-gray-500 mt-2">1 {getMonthName(new Date())} — {getTodayDateStr()}</p>
              )}
            </div>

            <div className="bg-[#161b22] border border-white/[0.06] rounded-2xl p-6 hover:border-red-500/30 transition-colors">
              <div className="flex justify-between items-start mb-4">
                <span className="text-3xl">💸</span>
              </div>
              <p className="text-2xl font-bold text-red-400">{formatRp(pengeluaran)}</p>
              <p className="text-sm text-gray-400 mt-1">Pengeluaran {todayLabel}</p>
              {filterMode === 'bulanan' && (
                <p className="text-xs text-gray-500 mt-2">1 {getMonthName(new Date())} — {getTodayDateStr()}</p>
              )}
            </div>

            <div className="bg-[#161b22] border border-white/[0.06] rounded-2xl p-6 hover:border-blue-500/30 transition-colors">
              <div className="flex justify-between items-start mb-4">
                <span className="text-3xl">🧾</span>
              </div>
              <p className="text-2xl font-bold text-blue-400">{jumlahTransaksi} <span className="text-sm text-gray-500 font-normal">trx</span></p>
              <p className="text-sm text-gray-400 mt-1">Transaksi {todayLabel}</p>
            </div>

            <Link href="/dashboard/pesanan" className="block">
              <div className="bg-[#161b22] border border-white/[0.06] rounded-2xl p-6 hover:border-orange-500/30 transition-colors cursor-pointer h-full">
                <div className="flex justify-between items-start mb-4">
                  <span className="text-3xl">🚚</span>
                </div>
                <p className="text-2xl font-bold text-orange-400">{belumKirim} <span className="text-sm text-gray-500 font-normal">resi</span></p>
                <p className="text-sm text-gray-400 mt-1">Belum Dikirim</p>
              </div>
            </Link>
          </div>
        )}

        {/* STATUS PENGIRIMAN & STOK */}
        <div className="grid grid-cols-2 gap-5">
          {/* Status Pengiriman */}
          <div className="bg-[#161b22] border border-white/[0.06] rounded-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
              <h3 className="font-bold text-white text-lg">🚚 Status Pengiriman</h3>
              <Link href="/dashboard/pesanan" className="text-sm text-green-400 hover:text-green-300 font-medium">Lihat semua →</Link>
            </div>
            {isLoading ? (
               <div className="p-8 text-center text-gray-500">Memuat data...</div>
            ) : (
              <div className="p-6 space-y-2 flex-1">
                <div className="flex justify-between items-center py-2 border-b border-white/5">
                  <span className="text-gray-300">Belum Kirim</span>
                  <span className="text-red-400 font-bold text-lg">{statusPengiriman.belum}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-white/5">
                  <span className="text-gray-300">Terkirim (Nota Belum)</span>
                  <span className="text-yellow-400 font-bold text-lg">{statusPengiriman.terkirim}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-gray-300">Nota Kembali</span>
                  <span className="text-green-400 font-bold text-lg">{statusPengiriman.nota_kembali}</span>
                </div>
              </div>
            )}
          </div>

          {/* Stok Menipis */}
          <div className="bg-[#161b22] border border-white/[0.06] rounded-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
              <h3 className="font-bold text-white text-lg">⚠️ Stok Perlu Perhatian</h3>
              <Link href="/dashboard/stok-ayam" className="text-sm text-green-400 hover:text-green-300 font-medium">Lihat Stok →</Link>
            </div>
            {isLoading ? (
               <div className="p-8 text-center text-gray-500">Memuat data...</div>
            ) : (
              <div className="p-6 flex-1 overflow-y-auto max-h-64">
                {stokMenipis.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-green-400 font-medium gap-2">
                    ✅ Semua stok aman
                  </div>
                ) : (
                  <div className="space-y-1">
                    {stokMenipis.map((stok, idx) => (
                      <div key={idx} className="flex justify-between items-center py-2 border-b border-white/5 last:border-0">
                        <span className="text-gray-300 truncate max-w-[200px]">{stok.nama_produk}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-white font-bold">{stok.stok_akhir} {stok.satuan}</span>
                          <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium border
                            ${stok.stok_akhir <= 0 ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'}
                          `}>
                            {stok.stok_akhir <= 0 ? 'Habis' : 'Menipis'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* TRANSAKSI TERBARU */}
        <div className="bg-[#161b22] border border-white/[0.06] rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-7 py-5 border-b border-white/[0.06]">
            <h3 className="font-bold text-white text-lg">Transaksi Terbaru</h3>
            <Link href="/dashboard/transaksi" className="text-sm text-green-400 hover:text-green-300 transition-colors font-medium">
              Lihat semua →
            </Link>
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
                  <span className={`text-[10px] px-2.5 py-1 rounded font-bold uppercase tracking-wide border ${paymentColor(tx.jenis_pembayaran)}`}>
                    {tx.jenis_pembayaran || 'POS / KASIR'}
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
