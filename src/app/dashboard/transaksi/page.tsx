"use client"

import { useState, useEffect, useMemo } from "react"
import { supabase } from "@/lib/supabase"

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

export default function TransaksiPage() {
  const [transactions, setTransactions] = useState<Transaksi[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [dateFilter, setDateFilter] = useState<string>("")
  const [paymentFilter, setPaymentFilter] = useState<string>("Semua")
  
  // Modal state
  const [selectedTx, setSelectedTx] = useState<Transaksi | null>(null)

  useEffect(() => {
    // Set default date to today in local YYYY-MM-DD
    const today = new Date()
    const tzOffset = today.getTimezoneOffset() * 60000
    const localISOTime = (new Date(today.getTime() - tzOffset)).toISOString().split('T')[0]
    setDateFilter(localISOTime)
  }, [])

  useEffect(() => {
    fetchTransactions()
  }, [])

  const fetchTransactions = async () => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('transaksi')
        .select(`
          *,
          transaksi_detail (*)
        `)
        .order('tanggal', { ascending: false })

      if (error) {
        console.error("Error fetching transactions:", error)
        return
      }

      setTransactions(data as Transaksi[])
    } catch (err) {
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  const formatRp = (num: number) => {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(num)
  }

  const formatDate = (isoString: string) => {
    if (!isoString) return "-"
    return new Date(isoString).toLocaleDateString("id-ID", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    })
  }

  // Derived state
  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      let passDate = true
      let passPayment = true

      if (dateFilter) {
        if (tx.tanggal) {
          const txDate = new Date(tx.tanggal)
          const tzOffset = txDate.getTimezoneOffset() * 60000
          const localISOTime = (new Date(txDate.getTime() - tzOffset)).toISOString().split('T')[0]
          
          if (localISOTime !== dateFilter) {
            passDate = false
          }
        } else {
          passDate = false
        }
      }

      if (paymentFilter !== "Semua") {
        if (tx.jenis_pembayaran !== paymentFilter) {
          passPayment = false
        }
      }

      return passDate && passPayment
    })
  }, [transactions, dateFilter, paymentFilter])

  const totalOmzet = useMemo(() => {
    return filteredTransactions.reduce((acc, tx) => acc + (tx.total || 0), 0)
  }, [filteredTransactions])

  return (
    <>
      <header className="flex items-center justify-between px-8 py-6 bg-[#0d1117] border-b border-white/[0.05]">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight">Data Transaksi</h2>
          <p className="text-base text-gray-500 mt-1">Kelola dan pantau seluruh riwayat transaksi penjualan</p>
        </div>
      </header>

      <main className="p-8 space-y-8">
        {/* SUMMARY CARDS */}
        <div className="grid grid-cols-2 gap-6">
          <div className="bg-[#161b22] border border-white/[0.05] rounded-2xl p-6 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-all group-hover:bg-blue-500/20"></div>
            <div className="relative z-10">
              <p className="text-gray-400 font-medium mb-1">Total Transaksi Hari Ini</p>
              <h3 className="text-4xl font-bold text-white">{filteredTransactions.length} <span className="text-lg text-gray-500 font-normal">transaksi</span></h3>
            </div>
          </div>
          <div className="bg-[#161b22] border border-white/[0.05] rounded-2xl p-6 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-all group-hover:bg-green-500/20"></div>
            <div className="relative z-10">
              <p className="text-gray-400 font-medium mb-1">Total Omzet Hari Ini</p>
              <h3 className="text-4xl font-bold text-green-400">{formatRp(totalOmzet)}</h3>
            </div>
          </div>
        </div>

        {/* FILTERS & TABLE */}
        <div className="bg-[#161b22] border border-white/[0.05] rounded-2xl overflow-hidden shadow-xl">
          <div className="p-5 border-b border-white/[0.05] flex flex-col md:flex-row gap-4 justify-between items-center bg-[#0d1117]/50">
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value)}
                className="bg-[#0d1117] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-green-500/50 hover:border-white/20 transition-colors"
              >
                <option value="Semua">Semua Pembayaran</option>
                <option value="Tunai">Tunai</option>
                <option value="Transfer">Transfer</option>
                <option value="Piutang">Piutang</option>
              </select>
              
              <input 
                type="date" 
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="bg-[#0d1117] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-green-500/50 hover:border-white/20 transition-colors [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert"
              />
              
              {dateFilter && (
                <button 
                  onClick={() => setDateFilter('')}
                  className="text-xs text-gray-500 hover:text-red-400 transition-colors px-2 font-medium"
                >
                  ✕ Hapus Filter Tanggal
                </button>
              )}
            </div>
            
            <button 
              onClick={fetchTransactions}
              className="bg-white/5 hover:bg-white/10 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 border border-white/5"
            >
              🔄 Segarkan Data
            </button>
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
                <p className="text-sm mt-1">Coba ubah tanggal atau jenis pembayaran.</p>
              </div>
            ) : (
              <table className="w-full text-left text-sm text-gray-300">
                <thead className="text-xs text-gray-400 uppercase bg-[#0d1117]/80 border-b border-white/[0.05]">
                  <tr>
                    <th scope="col" className="px-6 py-4 font-medium">No. Nota</th>
                    <th scope="col" className="px-6 py-4 font-medium">Tanggal</th>
                    <th scope="col" className="px-6 py-4 font-medium">Nama Pembeli</th>
                    <th scope="col" className="px-6 py-4 font-medium text-center">Pembayaran</th>
                    <th scope="col" className="px-6 py-4 font-medium text-right">Total</th>
                    <th scope="col" className="px-6 py-4 font-medium text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.02]">
                  {filteredTransactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-4 font-mono text-gray-300 whitespace-nowrap">{tx.no_nota}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{formatDate(tx.tanggal)}</td>
                      <td className="px-6 py-4 font-medium text-white">{tx.nama_pembeli}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-3 py-1.5 text-xs font-semibold rounded-full border ${
                          tx.jenis_pembayaran === 'Tunai' 
                            ? 'bg-green-500/10 text-green-400 border-green-500/20' 
                            : tx.jenis_pembayaran === 'Transfer'
                            ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                            : tx.jenis_pembayaran === 'Piutang'
                            ? 'bg-red-500/10 text-red-400 border-red-500/20'
                            : 'bg-gray-500/10 text-gray-400 border-gray-500/20'
                        }`}>
                          {tx.jenis_pembayaran}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-medium text-white">{formatRp(tx.total)}</td>
                      <td className="px-6 py-4 text-center">
                        <button 
                          onClick={() => setSelectedTx(tx)}
                          className="bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white px-4 py-2 rounded-lg text-xs font-medium transition-all border border-white/5 shadow-sm"
                        >
                          Detail 🔍
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>

      {/* DETAIL MODAL */}
      {selectedTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm transition-opacity">
          <div className="bg-[#161b22] border border-white/10 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b border-white/5 bg-black/20">
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <span className="text-green-500">🧾</span> Detail Transaksi
                </h3>
                <p className="text-sm text-gray-400 mt-1 font-mono">{selectedTx.no_nota}</p>
              </div>
              <button 
                onClick={() => setSelectedTx(null)}
                className="w-10 h-10 rounded-full bg-white/5 hover:bg-red-500/10 hover:text-red-400 flex items-center justify-center text-gray-400 transition-colors"
                title="Tutup"
              >
                ✕
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 shadow-sm gap-4 mb-6 bg-[#0d1117] p-5 rounded-xl border border-white/5">
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
                  <p className="text-white inline-flex px-2.5 py-0.5 rounded-md text-xs font-semibold border bg-white/5 border-white/10">
                    {selectedTx.jenis_pembayaran}
                  </p>
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
              
              <div className="bg-[#0d1117] border border-white/5 rounded-xl overflow-hidden shadow-inner">
                <table className="w-full text-left text-sm text-gray-300">
                  <thead className="bg-[#161b22] border-b border-white/5 text-xs text-gray-400 uppercase tracking-wider">
                    <tr>
                      <th className="px-5 py-3 font-semibold">Produk</th>
                      <th className="px-5 py-3 font-semibold text-center">Qty</th>
                      <th className="px-5 py-3 font-semibold text-right">Harga</th>
                      <th className="px-5 py-3 font-semibold text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.02]">
                    {(selectedTx.transaksi_detail || []).map((item) => (
                      <tr key={item.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-5 py-4">
                          <p className="font-semibold text-white text-base">{item.nama_produk}</p>
                          {item.keterangan && (
                            <p className="text-xs text-gray-500 mt-1 flex items-start gap-1">
                              <span className="text-gray-600">↳</span> {item.keterangan}
                            </p>
                          )}
                        </td>
                        <td className="px-5 py-4 text-center font-medium bg-white/[0.01]">{item.qty}</td>
                        <td className="px-5 py-4 text-right">{formatRp(item.harga)}</td>
                        <td className="px-5 py-4 text-right font-medium text-white bg-white/[0.01]">{formatRp(item.subtotal)}</td>
                      </tr>
                    ))}
                    {(!selectedTx.transaksi_detail || selectedTx.transaksi_detail.length === 0) && (
                      <tr>
                        <td colSpan={4} className="px-5 py-8 text-center text-gray-500 italic">
                          Tidak ada detail produk (data legacy).
                        </td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot className="border-t border-white/10 bg-[#161b22]">
                    <tr>
                      <td colSpan={3} className="px-5 py-4 text-right font-bold text-gray-400 uppercase">Total Akhir :</td>
                      <td className="px-5 py-4 text-right font-bold text-green-400 text-lg">{formatRp(selectedTx.total)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
            
            <div className="p-6 border-t border-white/5 flex justify-end bg-black/30 rounded-b-2xl">
              <button 
                onClick={() => setSelectedTx(null)}
                className="px-6 py-2.5 bg-gray-600/20 hover:bg-gray-600/40 text-white rounded-xl font-medium transition-colors border border-white/10"
              >
                Tutup Detail
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
