"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { supabase } from "@/utils/supabase/client"
import { fetchAllRows } from "@/utils/supabase/fetchAllRows"

type Piutang = {
  id: number
  no_nota: string
  tanggal: string
  nama_pembeli: string
  total: number
  sisa: number
  status: string
  terbayar?: number | null
  tanggal_lunas?: string | null
  metode_bayar?: string | null
}

export default function PiutangPage() {
  const [piutangData, setPiutangData] = useState<Piutang[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>("Belum Lunas")
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [activeTab, setActiveTab] = useState<'list' | 'kartu'>('list')

  // Kartu Piutang
  const [kartuPembeli, setKartuPembeli] = useState<string>("")

  const [selectedTx, setSelectedTx] = useState<Piutang | null>(null)
  const [amountPaid, setAmountPaid] = useState<string>("")
  const [paymentDate, setPaymentDate] = useState<string>("")
  const [metodeBayar, setMetodeBayar] = useState<'Tunai' | 'Transfer'>('Tunai')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const modalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (selectedTx) setTimeout(() => modalRef.current?.focus(), 100)
  }, [selectedTx])

  const handleModalKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      const inputs = Array.from(e.currentTarget.querySelectorAll('input:not([disabled]), select:not([disabled]), textarea:not([disabled])')) as HTMLElement[]
      const activeEl = document.activeElement as HTMLElement
      const activeIndex = inputs.indexOf(activeEl)
      
      if (activeIndex > -1 && activeIndex < inputs.length - 1) {
        inputs[activeIndex + 1].focus()
      } else {
        handlePaymentSubmit()
      }
    }
  }

  useEffect(() => {
    fetchPiutang()
  }, [])

  const fetchPiutang = async () => {
    setIsLoading(true)
    try {
      const data = await fetchAllRows('piutang', '*', { order: ['tanggal', false] })
      setPiutangData(data as Piutang[])
    } catch (err) {
      console.error("Error fetching piutang:", err)
    } finally {
      setIsLoading(false)
    }
  }

  const formatRp = (num: number) => {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(num)
  }

  const formatDate = (isoString?: string | null) => {
    if (!isoString) return "-"
    return new Date(isoString).toLocaleDateString("id-ID", { year: "numeric", month: "short", day: "numeric" })
  }

  const { totalBelumLunas, jumlahPembeli, totalLunasBulanIni } = useMemo(() => {
    let belumLunas = 0
    const pembeliSet = new Set<string>()
    let lunasBulanIni = 0
    const now = new Date()
    piutangData.forEach(tx => {
      if (tx.status === 'belum lunas') {
        belumLunas += (tx.sisa || 0)
        pembeliSet.add(tx.nama_pembeli)
      } else if (tx.status === 'lunas' && tx.tanggal_lunas) {
        const lunasDate = new Date(tx.tanggal_lunas)
        if (lunasDate.getMonth() === now.getMonth() && lunasDate.getFullYear() === now.getFullYear()) {
          lunasBulanIni += (tx.total || 0)
        }
      }
    })
    return { totalBelumLunas: belumLunas, jumlahPembeli: pembeliSet.size, totalLunasBulanIni: lunasBulanIni }
  }, [piutangData])

  const filteredData = useMemo(() => {
    return piutangData.filter(tx => {
      const passStatus = statusFilter === "Semua" || tx.status.toLowerCase() === statusFilter.toLowerCase()
      const passSearch = !searchQuery || tx.nama_pembeli.toLowerCase().includes(searchQuery.toLowerCase())
      return passStatus && passSearch
    })
  }, [piutangData, statusFilter, searchQuery])

  const searchSisaTotal = useMemo(() => {
    if (!searchQuery) return 0
    return filteredData.reduce((acc, tx) => acc + (tx.sisa || 0), 0)
  }, [filteredData, searchQuery])

  const allPembeli = useMemo(() => {
    const names = Array.from(new Set(piutangData.map(tx => tx.nama_pembeli))).sort()
    return names
  }, [piutangData])

  const kartuStats = useMemo(() => {
    if (!kartuPembeli) return null
    const txList = piutangData.filter(tx => tx.nama_pembeli === kartuPembeli)
    return {
      totalTrx: txList.length,
      totalNilai: txList.reduce((acc, tx) => acc + tx.total, 0),
      totalTerbayar: txList.reduce((acc, tx) => acc + (tx.terbayar || 0), 0),
      totalSisa: txList.reduce((acc, tx) => acc + tx.sisa, 0),
    }
  }, [piutangData, kartuPembeli])

  const kartuRiwayat = useMemo(() => {
    if (!kartuPembeli) return []
    return piutangData
      .filter(tx => tx.nama_pembeli === kartuPembeli)
      .sort((a, b) => b.sisa - a.sisa)
  }, [piutangData, kartuPembeli])

  const openPaymentModal = (tx: Piutang) => {
    setSelectedTx(tx)
    setAmountPaid(tx.sisa.toString())
    setMetodeBayar('Tunai')
    const tzOffset = (new Date()).getTimezoneOffset() * 60000
    const localISOTime = (new Date(Date.now() - tzOffset)).toISOString().split('T')[0]
    setPaymentDate(localISOTime)
  }

  const handlePaymentSubmit = async () => {
    if (!selectedTx || !amountPaid || !paymentDate) return
    const paidAmt = parseFloat(amountPaid)
    if (isNaN(paidAmt) || paidAmt <= 0) { alert("Masukkan nominal yang valid!"); return }
    if (paidAmt > selectedTx.sisa) { alert("Nominal pembayaran tidak boleh lebih dari sisa hutang!"); return }

    setIsSubmitting(true)
    try {
      const newTerbayar = (selectedTx.terbayar || 0) + paidAmt
      const newSisa = selectedTx.sisa - paidAmt
      const newStatus = newSisa <= 0 ? 'lunas' : 'belum lunas'
      const newTanggalLunas = newSisa <= 0 ? new Date(paymentDate).toISOString() : selectedTx.tanggal_lunas

      const { data, error } = await supabase
        .from('piutang')
        .update({ terbayar: newTerbayar, sisa: newSisa, status: newStatus, tanggal_lunas: newTanggalLunas, metode_bayar: metodeBayar })
        .eq('id', selectedTx.id)
        .select()
        .single()

      if (error) throw error
      setPiutangData(prev => prev.map(item => item.id === selectedTx.id ? (data as Piutang) : item))
      alert(newSisa <= 0 ? "Hutang berhasil dilunasi!" : "Pembayaran cicilan berhasil dicatat!")
      setSelectedTx(null)
    } catch (err: any) {
      alert("Gagal mencatat pembayaran: " + err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <header className="flex items-center justify-between px-8 py-6 bg-[#0d1117] border-b border-white/[0.05]">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight">Data Piutang</h2>
          <p className="text-base text-gray-500 mt-1">Kelola hutang pelanggan (Accounts Receivable)</p>
        </div>
        <div className="flex bg-[#161b22] border border-white/10 rounded-xl overflow-hidden h-10">
          <button onClick={() => setActiveTab('list')}
            className={`px-5 h-full text-sm font-medium transition-colors ${activeTab === 'list' ? 'bg-orange-600 text-white' : 'text-gray-400 hover:text-white'}`}>
            📋 Daftar Piutang
          </button>
          <button onClick={() => setActiveTab('kartu')}
            className={`px-5 h-full text-sm font-medium transition-colors ${activeTab === 'kartu' ? 'bg-orange-600 text-white' : 'text-gray-400 hover:text-white'}`}>
            🗂️ Kartu Piutang
          </button>
        </div>
      </header>

      <main className="p-8 space-y-8">

        {/* KARTU PIUTANG TAB */}
        {activeTab === 'kartu' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Pembeli selector */}
            <div className="bg-[#161b22] border border-white/[0.05] rounded-2xl p-5 flex flex-col md:flex-row items-center gap-4">
              <label className="text-gray-300 text-sm font-medium whitespace-nowrap">Pilih Pembeli:</label>
              <select value={kartuPembeli} onChange={e => setKartuPembeli(e.target.value)}
                className="flex-1 h-10 bg-[#0d1117] border border-white/10 text-white text-sm rounded-xl px-4 focus:outline-none focus:border-orange-500/50 max-w-sm">
                <option value="">-- Pilih nama pembeli --</option>
                {allPembeli.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>

            {!kartuPembeli ? (
              <div className="p-20 text-center text-gray-500 flex flex-col items-center bg-[#161b22] border border-white/[0.05] rounded-2xl">
                <span className="text-5xl mb-4 grayscale opacity-40">🗂️</span>
                <p className="text-lg">Pilih nama pembeli untuk melihat kartu piutang.</p>
              </div>
            ) : (
              <>
                {/* Summary cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-[#161b22] border border-white/[0.05] rounded-2xl p-5">
                    <p className="text-gray-400 text-xs mb-1">Total Transaksi</p>
                    <h3 className="text-2xl font-bold text-white">{kartuStats?.totalTrx ?? 0} <span className="text-sm text-gray-500 font-normal">nota</span></h3>
                  </div>
                  <div className="bg-[#161b22] border border-white/[0.05] rounded-2xl p-5">
                    <p className="text-gray-400 text-xs mb-1">Total Nilai</p>
                    <h3 className="text-xl font-bold text-white">{formatRp(kartuStats?.totalNilai ?? 0)}</h3>
                  </div>
                  <div className="bg-[#161b22] border border-white/[0.05] rounded-2xl p-5">
                    <p className="text-gray-400 text-xs mb-1">Total Terbayar</p>
                    <h3 className="text-xl font-bold text-green-400">{formatRp(kartuStats?.totalTerbayar ?? 0)}</h3>
                  </div>
                  <div className="bg-[#161b22] border border-white/[0.05] rounded-2xl p-5 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-red-500/10 rounded-full blur-2xl -mr-4 -mt-4"></div>
                    <div className="relative z-10">
                      <p className="text-gray-400 text-xs mb-1">Sisa Piutang</p>
                      <h3 className={`text-xl font-bold ${(kartuStats?.totalSisa ?? 0) > 0 ? 'text-red-400' : 'text-gray-500'}`}>
                        {formatRp(kartuStats?.totalSisa ?? 0)}
                      </h3>
                    </div>
                  </div>
                </div>

                {/* Riwayat table */}
                <div className="bg-[#161b22] border border-white/[0.05] rounded-2xl overflow-hidden shadow-xl">
                  <div className="p-5 border-b border-white/[0.05] bg-[#0d1117]/50">
                    <h4 className="text-white font-semibold">Riwayat Piutang — {kartuPembeli}</h4>
                    <p className="text-xs text-gray-500 mt-0.5">Diurutkan berdasarkan sisa hutang terbesar</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-gray-300">
                      <thead className="text-xs text-gray-400 uppercase bg-[#0d1117]/80 border-b border-white/[0.05]">
                        <tr>
                          <th className="px-6 py-4 font-medium">No. Nota</th>
                          <th className="px-6 py-4 font-medium">Tanggal</th>
                          <th className="px-6 py-4 font-medium text-right">Total</th>
                          <th className="px-6 py-4 font-medium text-right">Terbayar</th>
                          <th className="px-6 py-4 font-medium text-right">Sisa</th>
                          <th className="px-6 py-4 font-medium text-center">Status</th>
                          <th className="px-6 py-4 font-medium text-center">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.02]">
                        {kartuRiwayat.map(tx => {
                          const isLunas = tx.status === 'lunas'
                          return (
                            <tr key={tx.id} className="hover:bg-white/[0.01] transition-colors">
                              <td className="px-6 py-4 font-mono text-gray-400 whitespace-nowrap">{tx.no_nota}</td>
                              <td className="px-6 py-4 whitespace-nowrap">{formatDate(tx.tanggal)}</td>
                              <td className="px-6 py-4 text-right text-white">{formatRp(tx.total)}</td>
                              <td className="px-6 py-4 text-right text-gray-400">{formatRp(tx.terbayar || 0)}</td>
                              <td className={`px-6 py-4 text-right font-bold ${isLunas ? 'text-gray-500' : 'text-red-400'}`}>{formatRp(tx.sisa)}</td>
                              <td className="px-6 py-4 text-center">
                                <span className={`px-3 py-1.5 text-xs font-semibold rounded-full border ${isLunas ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                                  {isLunas ? 'Lunas' : 'Belum Lunas'}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-center">
                                {!isLunas ? (
                                  <button onClick={() => openPaymentModal(tx)}
                                    className="bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 px-4 py-2 rounded-lg text-xs font-semibold transition-all border border-orange-500/20">
                                    Bayar
                                  </button>
                                ) : (
                                  <span className="text-gray-500 text-xs italic">Selesai</span>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                      {kartuStats && (
                        <tfoot className="border-t border-white/10 bg-[#0d1117]/50 text-sm">
                          <tr>
                            <td colSpan={2} className="px-6 py-4 text-right font-medium text-gray-400">Total:</td>
                            <td className="px-6 py-4 text-right font-bold text-white">{formatRp(kartuStats.totalNilai)}</td>
                            <td className="px-6 py-4 text-right font-bold text-green-400">{formatRp(kartuStats.totalTerbayar)}</td>
                            <td className={`px-6 py-4 text-right font-bold ${kartuStats.totalSisa > 0 ? 'text-red-400' : 'text-gray-500'}`}>{formatRp(kartuStats.totalSisa)}</td>
                            <td colSpan={2}></td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* DAFTAR PIUTANG TAB */}
        {activeTab === 'list' && <div className="space-y-8">
        <div className="grid grid-cols-3 gap-6">
          <div className="bg-[#161b22] border border-white/[0.05] rounded-2xl p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 rounded-full blur-3xl -mr-10 -mt-10"></div>
            <div className="relative z-10">
              <p className="text-gray-400 font-medium mb-1">Total Piutang Belum Lunas</p>
              <h3 className="text-3xl font-bold text-red-400">{formatRp(totalBelumLunas)}</h3>
            </div>
          </div>
          <div className="bg-[#161b22] border border-white/[0.05] rounded-2xl p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl -mr-10 -mt-10"></div>
            <div className="relative z-10">
              <p className="text-gray-400 font-medium mb-1">Jumlah Pembeli Berpiutang</p>
              <h3 className="text-3xl font-bold text-orange-400">{jumlahPembeli} <span className="text-lg text-gray-500 font-normal">orang</span></h3>
            </div>
          </div>
          <div className="bg-[#161b22] border border-white/[0.05] rounded-2xl p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/10 rounded-full blur-3xl -mr-10 -mt-10"></div>
            <div className="relative z-10">
              <p className="text-gray-400 font-medium mb-1">Total Piutang Lunas Bulan Ini</p>
              <h3 className="text-3xl font-bold text-green-400">{formatRp(totalLunasBulanIni)}</h3>
            </div>
          </div>
        </div>

        <div className="bg-[#161b22] border border-white/[0.05] rounded-2xl overflow-hidden shadow-xl">
          <div className="p-5 border-b border-white/[0.05] flex flex-col md:flex-row gap-4 justify-between items-center bg-[#0d1117]/50">
            <div className="flex items-center gap-3 w-full md:w-auto flex-1">
              <div className="relative w-full max-w-sm h-10">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">🔍</span>
                <input type="text" placeholder="Cari nama pembeli..." value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-10 bg-[#0d1117] border border-white/10 text-white text-sm rounded-xl pl-9 pr-4 focus:outline-none focus:border-orange-500/50 hover:border-white/20 transition-colors"
                />
              </div>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
                className="h-10 bg-[#0d1117] border border-white/10 text-white text-sm rounded-xl px-4 focus:outline-none focus:border-orange-500/50"
              >
                <option value="Semua">Tampilkan Semua</option>
                <option value="Belum Lunas">Belum Lunas</option>
                <option value="Lunas">Lunas</option>
              </select>
            </div>
            <button onClick={fetchPiutang}
              className="h-10 bg-white/5 hover:bg-white/10 text-white px-4 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 border border-white/5"
            >
              🔄 Segarkan Data
            </button>
          </div>

          <div className="overflow-x-auto min-h-[400px]">
            {isLoading ? (
              <div className="p-12 text-center text-gray-400 flex flex-col items-center">
                <div className="w-8 h-8 border-4 border-orange-500/30 border-t-orange-500 rounded-full animate-spin mb-4"></div>
                Memuat data piutang...
              </div>
            ) : filteredData.length === 0 ? (
              <div className="p-20 text-center text-gray-500 flex flex-col items-center">
                <span className="text-5xl mb-4 grayscale opacity-40">📝</span>
                <p className="text-lg">Tidak ada data piutang yang sesuai filter.</p>
              </div>
            ) : (
              <table className="w-full text-left text-sm text-gray-300">
                <thead className="text-xs text-gray-400 uppercase bg-[#0d1117]/80 border-b border-white/[0.05]">
                  <tr>
                    <th className="px-6 py-4 font-medium">No. Nota</th>
                    <th className="px-6 py-4 font-medium">Tanggal</th>
                    <th className="px-6 py-4 font-medium">Pembeli</th>
                    <th className="px-6 py-4 font-medium text-right">Total Transaksi</th>
                    <th className="px-6 py-4 font-medium text-right">Terbayar</th>
                    <th className="px-6 py-4 font-medium text-center">Metode Bayar</th>
                    <th className="px-6 py-4 font-medium text-right">Sisa Hutang</th>
                    <th className="px-6 py-4 font-medium text-center">Status</th>
                    <th className="px-6 py-4 font-medium text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.02]">
                  {filteredData.map((tx) => {
                    const isLunas = tx.status === 'lunas'
                    return (
                      <tr key={tx.id} className="hover:bg-white/[0.01] transition-colors">
                        <td className="px-6 py-4 font-mono text-gray-400 whitespace-nowrap">{tx.no_nota}</td>
                        <td className="px-6 py-4 whitespace-nowrap">{formatDate(tx.tanggal)}</td>
                        <td className="px-6 py-4 font-medium text-white text-base">{tx.nama_pembeli}</td>
                        <td className="px-6 py-4 text-right text-white">{formatRp(tx.total)}</td>
                        <td className="px-6 py-4 text-right text-gray-400">{formatRp(tx.terbayar || 0)}</td>
                        <td className="px-6 py-4 text-center">
                          {isLunas && tx.metode_bayar ? (
                            <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wide border ${
                              tx.metode_bayar === 'Transfer'
                                ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                : 'bg-green-500/10 text-green-400 border-green-500/20'
                            }`}>
                              {tx.metode_bayar === 'Transfer' ? '🏦 Transfer' : '💵 Tunai'}
                            </span>
                          ) : (
                            <span className="text-gray-500">-</span>
                          )}
                        </td>
                        <td className={`px-6 py-4 text-right font-bold ${isLunas ? 'text-gray-500' : 'text-red-400'}`}>{formatRp(tx.sisa)}</td>
                        <td className="px-6 py-4 text-center">
                          <span className={`px-3 py-1.5 text-xs font-semibold rounded-full border ${isLunas ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                            {isLunas ? 'Lunas' : 'Belum Lunas'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          {!isLunas ? (
                            <button onClick={() => openPaymentModal(tx)}
                              className="bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 px-4 py-2 rounded-lg text-xs font-semibold transition-all border border-orange-500/20 w-28"
                            >
                              Bayar
                            </button>
                          ) : (
                            <span className="text-gray-500 text-xs italic px-4 py-2 block w-28 mx-auto">Selesai</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                {searchQuery && filteredData.length > 0 && (
                  <tfoot className="border-t border-white/10 bg-[#0d1117]">
                    <tr>
                      <td colSpan={6} className="px-6 py-5 text-right font-medium text-gray-400">
                        Total sisa hutang untuk "{searchQuery}":
                      </td>
                      <td className="px-6 py-5 text-right font-bold text-orange-400 text-base">{formatRp(searchSisaTotal)}</td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            )}
          </div>
        </div>
        </div>}
      </main>

      {/* PAYMENT MODAL */}
      {selectedTx && (
        <div ref={modalRef} tabIndex={-1} onKeyDown={handleModalKeyDown} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm outline-none">
          <div className="bg-[#161b22] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b border-white/5 bg-black/20">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <span className="text-orange-500">💰</span> Terima Pembayaran
              </h3>
              <button onClick={() => !isSubmitting && setSelectedTx(null)}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400"
                disabled={isSubmitting}
              >✕</button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5">
              <div className="bg-[#0d1117] p-4 rounded-xl border border-white/5 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-400 text-sm">Pembeli:</span>
                  <span className="text-white font-medium">{selectedTx.nama_pembeli}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 text-sm">No Nota:</span>
                  <span className="text-white font-mono text-sm">{selectedTx.no_nota}</span>
                </div>
                <div className="flex justify-between text-lg pt-2 border-t border-white/5">
                  <span className="text-gray-300 font-medium">Sisa Hutang:</span>
                  <span className="text-red-400 font-bold">{formatRp(selectedTx.sisa)}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-gray-300 text-sm font-medium">Nominal Pembayaran (Rp)</label>
                {/* Custom input dengan step 1000 */}
                <div className="flex items-center bg-[#0d1117] border border-white/10 rounded-xl overflow-hidden focus-within:border-orange-500 focus-within:ring-1 focus-within:ring-orange-500 transition-all">
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    max={selectedTx.sisa}
                    value={amountPaid}
                    onChange={e => setAmountPaid(e.target.value)}
                    onWheel={(e) => (e.target as HTMLInputElement).blur()}
                    className="flex-1 bg-transparent text-white text-lg px-4 py-3 focus:outline-none font-mono [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    placeholder="0"
                  />
                  <div className="flex flex-col border-l border-white/10">
                    <button
                      type="button"
                      onClick={() => setAmountPaid(prev => Math.min(selectedTx.sisa, (parseFloat(prev) || 0) + 1000).toString())}
                      className="px-3 py-1.5 text-gray-300 hover:bg-white/10 hover:text-white transition-colors text-xs font-bold border-b border-white/10"
                    >▲</button>
                    <button
                      type="button"
                      onClick={() => setAmountPaid(prev => Math.max(0, (parseFloat(prev) || 0) - 1000).toString())}
                      className="px-3 py-1.5 text-gray-300 hover:bg-white/10 hover:text-white transition-colors text-xs font-bold"
                    >▼</button>
                  </div>
                </div>
                <div className="flex justify-between items-center mt-2 px-1">
                  <p className="text-xs text-gray-500">Sisa setelah bayar:</p>
                  <p className={`text-sm font-bold ${selectedTx.sisa - (parseFloat(amountPaid) || 0) <= 0 ? 'text-green-400' : 'text-orange-400'}`}>
                    {formatRp(Math.max(0, selectedTx.sisa - (parseFloat(amountPaid) || 0)))}
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-gray-300 text-sm font-medium">Metode Pembayaran</label>
                <div className="flex gap-2">
                  {['Tunai', 'Transfer'].map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMetodeBayar(m as 'Tunai' | 'Transfer')}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
                        metodeBayar === m
                          ? m === 'Tunai'
                            ? 'bg-green-600 border-green-500 text-white'
                            : 'bg-blue-600 border-blue-500 text-white'
                          : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                      }`}
                    >
                      {m === 'Tunai' ? '💵 Tunai' : '🏦 Transfer'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-gray-300 text-sm font-medium">Tanggal Pembayaran</label>
                <input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} onClick={e => (e.target as any).showPicker?.()}
                  className="w-full cursor-pointer bg-[#0d1117] border border-white/10 text-white text-base rounded-xl px-4 py-3 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert"
                />
              </div>
            </div>

            <div className="p-6 border-t border-white/5 flex gap-3 bg-black/20 rounded-b-2xl">
              <button onClick={() => setSelectedTx(null)} disabled={isSubmitting}
                className="flex-1 px-6 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl font-medium transition-colors"
              >Batal</button>
              <button onClick={handlePaymentSubmit} disabled={isSubmitting}
                className="flex-1 px-6 py-3 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white rounded-xl font-bold transition-all shadow-lg shadow-orange-900/20"
              >{isSubmitting ? "Menyimpan..." : "Simpan Pembayaran"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
