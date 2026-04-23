"use client"

import { useState, useEffect, useMemo } from "react"
import { supabase } from "@/utils/supabase/client"

type TransaksiDetail = {
  id: number
  transaksi_id: number
  nama_produk: string
  qty: number
  harga: number
  subtotal: number
  keterangan: string | null
}

type Transaksi = {
  id: number
  no_nota: string
  tanggal: string
  nama_pembeli: string
  jenis_pembayaran: string
  total: number
  created_at: string
  transaksi_detail: TransaksiDetail[]
}

const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
]

export default function TransaksiPage() {
  const [transactions, setTransactions] = useState<Transaksi[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Filter mode: 'harian' | 'bulanan'
  const [filterMode, setFilterMode] = useState<'harian' | 'bulanan'>('harian')

  // Harian filters
  const [dateFilter, setDateFilter] = useState<string>("")

  // Bulanan filters
  const today = new Date()
  const [bulanFilter, setBulanFilter] = useState<number>(today.getMonth())
  const [tahunFilter, setTahunFilter] = useState<number>(today.getFullYear())

  // Common filters
  const [paymentFilter, setPaymentFilter] = useState<string>("Semua")
  const [searchQuery, setSearchQuery] = useState<string>("")

  // Modal
  const [selectedTx, setSelectedTx] = useState<Transaksi | null>(null)
  const [hppMap, setHppMap] = useState<Record<string, number>>({})
  const [isHppLoading, setIsHppLoading] = useState(false)

  useEffect(() => {
    const now = new Date()
    const tzOffset = now.getTimezoneOffset() * 60000
    const todayLocal = (new Date(now.getTime() - tzOffset)).toISOString().split('T')[0]
    setDateFilter(todayLocal)
  }, [])

  useEffect(() => { fetchTransactions() }, [])

  useEffect(() => {
    if (!selectedTx) { setHppMap({}); return }
    const produkNames = Array.from(new Set((selectedTx.transaksi_detail || []).map(d => d.nama_produk)))
    if (produkNames.length === 0) return
    setIsHppLoading(true)
    Promise.all(
      produkNames.map(nama =>
        supabase.from('hpp').select('hpp_satuan').eq('nama_produk', nama).order('tanggal', { ascending: false }).limit(1).single()
          .then(({ data }) => ({ nama, hpp_satuan: data?.hpp_satuan ?? 0 }))
      )
    ).then(results => {
      const map: Record<string, number> = {}
      results.forEach(r => { map[r.nama] = r.hpp_satuan })
      setHppMap(map)
    }).finally(() => setIsHppLoading(false))
  }, [selectedTx])

  const fetchTransactions = async () => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('transaksi')
        .select(`*, transaksi_detail (*)`)
        .order('tanggal', { ascending: false })
      if (error) { console.error(error); return }
      setTransactions(data as Transaksi[])
    } catch (err) { console.error(err) }
    finally { setIsLoading(false) }
  }

  const formatRp = (num: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(num)

  const formatDate = (isoString: string) => {
    if (!isoString) return "-"
    return new Date(isoString).toLocaleDateString("id-ID", {
      year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit"
    })
  }

  const getLocalDate = (isoString: string) => {
    const d = new Date(isoString)
    const tzOffset = d.getTimezoneOffset() * 60000
    return new Date(d.getTime() - tzOffset).toISOString().split('T')[0]
  }

  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      // Date filter
      let passDate = true
      if (filterMode === 'harian' && dateFilter) {
        passDate = getLocalDate(tx.tanggal) === dateFilter
      } else if (filterMode === 'bulanan') {
        const d = new Date(tx.tanggal)
        passDate = d.getMonth() === bulanFilter && d.getFullYear() === tahunFilter
      }

      // Payment filter
      const passPayment = paymentFilter === "Semua" || tx.jenis_pembayaran === paymentFilter

      // Search filter
      const passSearch = !searchQuery || tx.nama_pembeli.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tx.no_nota.toLowerCase().includes(searchQuery.toLowerCase())

      return passDate && passPayment && passSearch
    })
  }, [transactions, filterMode, dateFilter, bulanFilter, tahunFilter, paymentFilter, searchQuery])

  const totalOmzet = useMemo(() =>
    filteredTransactions.reduce((acc, tx) => acc + (tx.total || 0), 0),
    [filteredTransactions])

  const omzetTunai = useMemo(() =>
    filteredTransactions.filter(tx => tx.jenis_pembayaran === 'Tunai').reduce((acc, tx) => acc + tx.total, 0),
    [filteredTransactions])

  const omzetTransfer = useMemo(() =>
    filteredTransactions.filter(tx => tx.jenis_pembayaran === 'Transfer').reduce((acc, tx) => acc + tx.total, 0),
    [filteredTransactions])

  const omzetPiutang = useMemo(() =>
    filteredTransactions.filter(tx => tx.jenis_pembayaran === 'Piutang').reduce((acc, tx) => acc + tx.total, 0),
    [filteredTransactions])

  const periodLabel = filterMode === 'harian'
    ? dateFilter ? new Date(dateFilter + 'T00:00:00').toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "Semua Tanggal"
    : `${MONTHS[bulanFilter]} ${tahunFilter}`

  // Generate year options (5 years back)
  const yearOptions = Array.from({ length: 6 }, (_, i) => today.getFullYear() - i)

  const paymentColor = (jenis: string) => {
    if (jenis === 'Tunai') return 'bg-green-500/10 text-green-400 border-green-500/20'
    if (jenis === 'Transfer') return 'bg-blue-500/10 text-blue-400 border-blue-500/20'
    if (jenis === 'Piutang') return 'bg-red-500/10 text-red-400 border-red-500/20'
    return 'bg-gray-500/10 text-gray-400 border-gray-500/20'
  }

  return (
    <>
      <header className="flex items-center justify-between px-8 py-6 bg-[#0d1117] border-b border-white/[0.05]">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight">Data Transaksi</h2>
          <p className="text-base text-gray-500 mt-1">Kelola dan pantau seluruh riwayat transaksi penjualan</p>
        </div>
        <button onClick={fetchTransactions}
          className="bg-white/5 hover:bg-white/10 text-white px-4 py-2.5 rounded-xl text-sm font-medium border border-white/5 transition-colors flex items-center gap-2">
          🔄 Segarkan Data
        </button>
      </header>

      <main className="p-8 space-y-6">
        {/* SUMMARY CARDS */}
        <div className="grid grid-cols-4 gap-5">
          <div className="bg-[#161b22] border border-white/[0.05] rounded-2xl p-5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-3xl -mr-6 -mt-6"></div>
            <div className="relative z-10">
              <p className="text-gray-400 text-sm mb-1">Jumlah Transaksi</p>
              <h3 className="text-3xl font-bold text-white">{filteredTransactions.length} <span className="text-sm text-gray-500 font-normal">nota</span></h3>
              <p className="text-xs text-gray-500 mt-1">{periodLabel}</p>
            </div>
          </div>
          <div className="bg-[#161b22] border border-white/[0.05] rounded-2xl p-5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-green-500/10 rounded-full blur-3xl -mr-6 -mt-6"></div>
            <div className="relative z-10">
              <p className="text-gray-400 text-sm mb-1">Total Omzet</p>
              <h3 className="text-2xl font-bold text-green-400">{formatRp(totalOmzet)}</h3>
              <p className="text-xs text-gray-500 mt-1">{periodLabel}</p>
            </div>
          </div>
          <div className="bg-[#161b22] border border-white/[0.05] rounded-2xl p-5">
            <p className="text-gray-400 text-sm mb-2">Breakdown Pembayaran</p>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-green-400">Tunai</span>
                <span className="text-white font-medium">{formatRp(omzetTunai)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-blue-400">Transfer</span>
                <span className="text-white font-medium">{formatRp(omzetTransfer)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-red-400">Piutang</span>
                <span className="text-white font-medium">{formatRp(omzetPiutang)}</span>
              </div>
            </div>
          </div>
          <div className="bg-[#161b22] border border-white/[0.05] rounded-2xl p-5">
            <p className="text-gray-400 text-sm mb-2">Rata-rata per Transaksi</p>
            <h3 className="text-2xl font-bold text-white">
              {filteredTransactions.length > 0 ? formatRp(totalOmzet / filteredTransactions.length) : 'Rp 0'}
            </h3>
            <p className="text-xs text-gray-500 mt-1">{periodLabel}</p>
          </div>
        </div>

        {/* FILTERS */}
        <div className="bg-[#161b22] border border-white/[0.05] rounded-2xl overflow-hidden shadow-xl">
          <div className="p-5 border-b border-white/[0.05] flex flex-wrap justify-between items-center gap-4 bg-[#0d1117]/50">
            {/* Mode toggle + filters */}
            <div className="flex flex-wrap items-center gap-3 flex-1">
              {/* Mode toggle */}
              <div className="flex bg-[#0d1117] border border-white/10 rounded-xl overflow-hidden h-10 items-center">
                <button onClick={() => setFilterMode('harian')}
                  className={`px-4 h-full text-sm font-medium transition-colors flex items-center ${filterMode === 'harian' ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                  📅 Harian
                </button>
                <button onClick={() => setFilterMode('bulanan')}
                  className={`px-4 h-full text-sm font-medium transition-colors flex items-center ${filterMode === 'bulanan' ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                  📆 Bulanan
                </button>
              </div>

              {/* Harian: date picker */}
              {filterMode === 'harian' && (
                <>
                  <div className="w-full max-w-[180px]">
                    <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} onClick={e => (e.target as any).showPicker?.()}
                      className="w-full cursor-pointer h-10 bg-[#0d1117] border border-white/10 text-white text-sm rounded-xl px-4 focus:outline-none focus:border-green-500/50 [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert" />
                  </div>
                  {dateFilter && (
                    <button onClick={() => setDateFilter('')} className="h-10 text-xs text-gray-500 hover:text-red-400 transition-colors px-2 font-medium flex items-center">
                      ✕ Hapus Filter
                    </button>
                  )}
                </>
              )}

              {/* Bulanan: bulan + tahun picker */}
              {filterMode === 'bulanan' && (
                <>
                  <select value={bulanFilter} onChange={e => setBulanFilter(parseInt(e.target.value))}
                    className="h-10 bg-[#0d1117] border border-white/10 text-white text-sm rounded-xl px-4 focus:outline-none focus:border-green-500/50">
                    {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
                  </select>
                  <select value={tahunFilter} onChange={e => setTahunFilter(parseInt(e.target.value))}
                    className="h-10 bg-[#0d1117] border border-white/10 text-white text-sm rounded-xl px-4 focus:outline-none focus:border-green-500/50">
                    {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </>
              )}

              {/* Payment filter */}
              <select value={paymentFilter} onChange={e => setPaymentFilter(e.target.value)}
                className="h-10 bg-[#0d1117] border border-white/10 text-white text-sm rounded-xl px-4 focus:outline-none focus:border-green-500/50">
                <option value="Semua">Semua Pembayaran</option>
                <option value="Tunai">Tunai</option>
                <option value="Transfer">Transfer</option>
                <option value="Piutang">Piutang</option>
              </select>
            </div>

            {/* Search */}
            <div className="relative w-full max-w-sm">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">🔍</span>
              <input type="text" placeholder="Cari nama pembeli atau no. nota..."
                value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                className="w-full h-10 bg-[#0d1117] border border-white/10 text-white text-sm rounded-xl pl-9 pr-4 focus:outline-none focus:border-green-500/50 hover:border-white/20 transition-colors" />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute inset-y-0 right-3 flex items-center text-gray-500 hover:text-red-400 text-xs h-full">✕</button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto min-h-[400px]">
            {isLoading ? (
              <div className="p-12 text-center text-gray-400 flex flex-col items-center">
                <div className="w-8 h-8 border-4 border-green-500/30 border-t-green-500 rounded-full animate-spin mb-4"></div>
                Memuat data transaksi...
              </div>
            ) : filteredTransactions.length === 0 ? (
              <div className="p-20 text-center text-gray-500 flex flex-col items-center">
                <span className="text-5xl mb-4 grayscale opacity-40">📭</span>
                <p className="text-lg">Tidak ada data transaksi yang sesuai filter.</p>
                <p className="text-sm mt-1">Coba ubah periode atau kata kunci pencarian.</p>
              </div>
            ) : (
              <table className="w-full text-left text-sm text-gray-300">
                <thead className="text-xs text-gray-400 uppercase bg-[#0d1117]/80 border-b border-white/[0.05]">
                  <tr>
                    <th className="px-6 py-4 font-medium">No. Nota</th>
                    <th className="px-6 py-4 font-medium">Tanggal</th>
                    <th className="px-6 py-4 font-medium">Nama Pembeli</th>
                    <th className="px-6 py-4 font-medium text-center">Pembayaran</th>
                    <th className="px-6 py-4 font-medium text-right">Total</th>
                    <th className="px-6 py-4 font-medium text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.02]">
                  {filteredTransactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-4 font-mono text-gray-300 whitespace-nowrap">{tx.no_nota}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{formatDate(tx.tanggal)}</td>
                      <td className="px-6 py-4 font-medium text-white">{tx.nama_pembeli}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-3 py-1.5 text-xs font-semibold rounded-full border ${paymentColor(tx.jenis_pembayaran)}`}>
                          {tx.jenis_pembayaran}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-medium text-white">{formatRp(tx.total)}</td>
                      <td className="px-6 py-4 text-center">
                        <button onClick={() => setSelectedTx(tx)}
                          className="bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white px-4 py-2 rounded-lg text-xs font-medium transition-all border border-white/5">
                          Detail 🔍
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t border-white/10 bg-[#0d1117]/50">
                  <tr>
                    <td colSpan={4} className="px-6 py-4 text-right font-medium text-gray-400">
                      Total {filteredTransactions.length} transaksi:
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-green-400 text-base">{formatRp(totalOmzet)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </div>
      </main>

      {/* DETAIL MODAL */}
      {selectedTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#161b22] border border-white/10 rounded-2xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b border-white/5 bg-black/20">
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <span className="text-green-500">🧾</span> Detail Transaksi
                </h3>
                <p className="text-sm text-gray-400 mt-1 font-mono">{selectedTx.no_nota}</p>
              </div>
              <button onClick={() => setSelectedTx(null)}
                className="w-10 h-10 rounded-full bg-white/5 hover:bg-red-500/10 hover:text-red-400 flex items-center justify-center text-gray-400 transition-colors">
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-4 mb-6 bg-[#0d1117] p-5 rounded-xl border border-white/5">
                <div>
                  <p className="text-xs text-gray-500 font-bold mb-1">NAMA PEMBELI</p>
                  <p className="text-white font-medium text-lg">{selectedTx.nama_pembeli}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-bold mb-1">TANGGAL TRANSAKSI</p>
                  <p className="text-white">{formatDate(selectedTx.tanggal)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-bold mb-1">JENIS PEMBAYARAN</p>
                  <span className={`inline-flex px-2.5 py-0.5 rounded-md text-xs font-semibold border ${paymentColor(selectedTx.jenis_pembayaran)}`}>
                    {selectedTx.jenis_pembayaran}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-bold mb-1">TOTAL TRANSAKSI</p>
                  <p className="text-green-400 font-bold text-xl">{formatRp(selectedTx.total)}</p>
                </div>
              </div>

              <h4 className="text-sm font-bold text-gray-300 uppercase tracking-widest mb-3 flex items-center gap-2">
                <span className="w-4 h-0.5 bg-green-500/50 rounded-full"></span>
                Daftar Produk
              </h4>

              <div className="bg-[#0d1117] border border-white/5 rounded-xl overflow-hidden">
                {isHppLoading && (
                  <div className="px-5 py-2 text-xs text-gray-500 flex items-center gap-2 border-b border-white/5">
                    <div className="w-3 h-3 border-2 border-green-500/30 border-t-green-500 rounded-full animate-spin"></div>
                    Memuat data HPP...
                  </div>
                )}
                <table className="w-full text-left text-sm text-gray-300">
                  <thead className="bg-[#161b22] border-b border-white/5 text-xs text-gray-400 uppercase">
                    <tr>
                      <th className="px-5 py-3">Produk</th>
                      <th className="px-5 py-3 text-center">Qty</th>
                      <th className="px-5 py-3 text-right">Harga</th>
                      <th className="px-5 py-3 text-right">Subtotal</th>
                      <th className="px-5 py-3 text-right">HPP</th>
                      <th className="px-5 py-3 text-right">Laba Kotor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.02]">
                    {(selectedTx.transaksi_detail || []).map((item) => {
                      const hppTotal = item.qty * (hppMap[item.nama_produk] ?? 0)
                      const labaKotor = item.subtotal - hppTotal
                      return (
                        <tr key={item.id} className="hover:bg-white/[0.02]">
                          <td className="px-5 py-4">
                            <p className="font-semibold text-white">{item.nama_produk}</p>
                            {item.keterangan && <p className="text-xs text-gray-500 mt-1">↳ {item.keterangan}</p>}
                          </td>
                          <td className="px-5 py-4 text-center">{item.qty}</td>
                          <td className="px-5 py-4 text-right">{formatRp(item.harga)}</td>
                          <td className="px-5 py-4 text-right font-medium text-white">{formatRp(item.subtotal)}</td>
                          <td className="px-5 py-4 text-right text-red-400">{formatRp(hppTotal)}</td>
                          <td className={`px-5 py-4 text-right font-semibold ${labaKotor >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatRp(labaKotor)}</td>
                        </tr>
                      )
                    })}
                    {(!selectedTx.transaksi_detail || selectedTx.transaksi_detail.length === 0) && (
                      <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-500 italic">Tidak ada detail produk.</td></tr>
                    )}
                  </tbody>
                  <tfoot className="border-t border-white/10 bg-[#161b22] text-sm">
                    {(() => {
                      const details = selectedTx.transaksi_detail || []
                      const totalHpp = details.reduce((acc, item) => acc + item.qty * (hppMap[item.nama_produk] ?? 0), 0)
                      const totalLaba = selectedTx.total - totalHpp
                      const margin = selectedTx.total > 0 ? (totalLaba / selectedTx.total) * 100 : 0
                      return (
                        <>
                          <tr className="border-t border-white/5">
                            <td colSpan={3} className="px-5 py-3 text-right text-gray-400">Total Omzet:</td>
                            <td className="px-5 py-3 text-right font-bold text-green-400">{formatRp(selectedTx.total)}</td>
                            <td colSpan={2}></td>
                          </tr>
                          <tr>
                            <td colSpan={3} className="px-5 py-3 text-right text-gray-400">Total HPP:</td>
                            <td></td>
                            <td className="px-5 py-3 text-right font-bold text-red-400">{formatRp(totalHpp)}</td>
                            <td></td>
                          </tr>
                          <tr className="border-t border-white/5">
                            <td colSpan={3} className="px-5 py-3 text-right text-gray-400">Laba Kotor:</td>
                            <td></td>
                            <td></td>
                            <td className={`px-5 py-3 text-right font-bold text-lg ${totalLaba >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatRp(totalLaba)}</td>
                          </tr>
                          <tr>
                            <td colSpan={5} className="px-5 py-3 text-right text-gray-500 text-xs">Margin:</td>
                            <td className={`px-5 py-3 text-right font-semibold text-sm ${margin >= 0 ? 'text-blue-400' : 'text-red-400'}`}>{margin.toFixed(1)}%</td>
                          </tr>
                        </>
                      )
                    })()}
                  </tfoot>
                </table>
              </div>
            </div>

            <div className="p-6 border-t border-white/5 flex justify-end bg-black/30 rounded-b-2xl">
              <button onClick={() => setSelectedTx(null)}
                className="px-6 py-2.5 bg-gray-600/20 hover:bg-gray-600/40 text-white rounded-xl font-medium border border-white/10">
                Tutup Detail
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
