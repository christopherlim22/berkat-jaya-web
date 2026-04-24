"use client"

import { useState, useEffect, useMemo } from "react"
import { supabase } from "@/utils/supabase/client"

type UtangSupplier = {
  id: number
  hpp_id: number
  tanggal: string
  nama_supplier: string
  nama_produk: string
  total: number
  terbayar: number
  sisa: number
  status: string
}

type GroupedSupplier = {
  nama_supplier: string
  total_sisa: number
  isLunas: boolean
  records: UtangSupplier[]
}

export default function UtangSupplierPage() {
  const [utangData, setUtangData] = useState<UtangSupplier[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>("Belum Lunas")
  const [searchQuery, setSearchQuery] = useState<string>("")

  // Modal Detail
  const [selectedSupplierDetail, setSelectedSupplierDetail] = useState<GroupedSupplier | null>(null)

  // Modal bayar
  const [selectedSupplierPayment, setSelectedSupplierPayment] = useState<GroupedSupplier | null>(null)
  const [amountPaid, setAmountPaid] = useState<string>("")
  const [paymentDate, setPaymentDate] = useState<string>("")
  const [paymentVia, setPaymentVia] = useState<string>("Tunai")
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    fetchUtang()
  }, [])

  const fetchUtang = async () => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('utang_supplier')
        .select('*')
        .order('tanggal', { ascending: false })
      if (error) throw error
      setUtangData(data as UtangSupplier[])
    } catch (err) {
      console.error("Error fetching utang_supplier:", err)
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

  // 1. Grouping data by supplier
  const groupedData = useMemo(() => {
    const map = new Map<string, GroupedSupplier>()
    
    utangData.forEach(item => {
      const exists = map.get(item.nama_supplier)
      if (exists) {
        exists.records.push(item)
        exists.total_sisa += item.sisa
        if (item.status === 'belum lunas') {
          exists.isLunas = false
        }
      } else {
        map.set(item.nama_supplier, {
          nama_supplier: item.nama_supplier,
          total_sisa: item.sisa,
          isLunas: item.status === 'lunas',
          records: [item]
        })
      }
    })
    
    return Array.from(map.values())
  }, [utangData])

  // Summary Metrics
  const { totalBelumLunas, jumlahSupplier } = useMemo(() => {
    let belumLunas = 0
    let supplierBerutang = 0
    
    groupedData.forEach(group => {
      if (!group.isLunas && group.total_sisa > 0) {
        belumLunas += group.total_sisa
        supplierBerutang += 1
      }
    })
    
    return { totalBelumLunas: belumLunas, jumlahSupplier: supplierBerutang }
  }, [groupedData])

  // Apply filters on grouped data
  const filteredData = useMemo(() => {
    return groupedData.filter(group => {
      let passStatus = false
      if (statusFilter === "Semua") passStatus = true
      else if (statusFilter === "Belum Lunas") passStatus = !group.isLunas && group.total_sisa > 0
      else if (statusFilter === "Lunas") passStatus = group.isLunas || group.total_sisa === 0
      
      const passSearch = !searchQuery || group.nama_supplier.toLowerCase().includes(searchQuery.toLowerCase())
      
      return passStatus && passSearch
    })
  }, [groupedData, statusFilter, searchQuery])

  const searchSisaTotal = useMemo(() => {
    if (!searchQuery) return 0
    return filteredData.reduce((acc, item) => acc + (item.total_sisa || 0), 0)
  }, [filteredData, searchQuery])

  // 3. Tombol Bayar
  const openPaymentModal = (group: GroupedSupplier) => {
    setSelectedSupplierPayment(group)
    setAmountPaid(group.total_sisa.toString())
    setPaymentVia("Tunai")
    const tzOffset = (new Date()).getTimezoneOffset() * 60000
    const localISOTime = (new Date(Date.now() - tzOffset)).toISOString().split('T')[0]
    setPaymentDate(localISOTime)
  }

  const handlePaymentSubmit = async () => {
    if (!selectedSupplierPayment || !amountPaid || !paymentDate) return
    let remainingPayment = parseFloat(amountPaid)
    if (isNaN(remainingPayment) || remainingPayment <= 0) { alert("Masukkan nominal yang valid!"); return }
    if (remainingPayment > selectedSupplierPayment.total_sisa) { alert("Nominal pembayaran tidak boleh lebih dari total sisa utang supplier ini!"); return }

    setIsSubmitting(true)
    try {
      // 3. Distribusikan pembayaran dari yang terlama dulu
      const unpaidRecords = [...selectedSupplierPayment.records]
         .filter(r => r.status === 'belum lunas' && r.sisa > 0)
         .sort((a, b) => new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime())

      const updatesPromises = []
      
      for (const record of unpaidRecords) {
         if (remainingPayment <= 0.001) break // use epsilon for float comparison safety
         
         const sisaUtangItem = record.sisa
         const payForThisItem = Math.min(sisaUtangItem, remainingPayment)
         
         const newTerbayar = record.terbayar + payForThisItem
         const newSisa = sisaUtangItem - payForThisItem
         const newStatus = newSisa <= 0.001 ? 'lunas' : 'belum lunas'
         
         remainingPayment -= payForThisItem
         
         updatesPromises.push(
            supabase.from('utang_supplier')
               .update({ terbayar: newTerbayar, sisa: newSisa, status: newStatus })
               .eq('id', record.id)
         )
      }
      
      await Promise.all(updatesPromises)
      
      alert(remainingPayment <= 0.001 ? "Pembayaran berhasil didistribusikan dan dicatat!" : "Pembayaran utang berhasil dicatat sebagian!")
      setSelectedSupplierPayment(null)
      fetchUtang() // Refresh data from server to avoid manual sync complex array mutation
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
          <h2 className="text-3xl font-bold text-white tracking-tight">Utang Supplier</h2>
          <p className="text-base text-gray-500 mt-1">Kelola hutang pembelian ke supplier (Accounts Payable)</p>
        </div>
      </header>

      <main className="p-8 space-y-8">
        <div className="grid grid-cols-2 gap-6">
          <div className="bg-[#161b22] border border-white/[0.05] rounded-2xl p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 rounded-full blur-3xl -mr-10 -mt-10"></div>
            <div className="relative z-10">
              <p className="text-gray-400 font-medium mb-1">Total Utang Belum Lunas</p>
              <h3 className="text-3xl font-bold text-red-400">{formatRp(totalBelumLunas)}</h3>
            </div>
          </div>
          <div className="bg-[#161b22] border border-white/[0.05] rounded-2xl p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl -mr-10 -mt-10"></div>
            <div className="relative z-10">
              <p className="text-gray-400 font-medium mb-1">Jumlah Supplier Berutang</p>
              <h3 className="text-3xl font-bold text-orange-400">{jumlahSupplier} <span className="text-lg text-gray-500 font-normal">supplier</span></h3>
            </div>
          </div>
        </div>

        <div className="bg-[#161b22] border border-white/[0.05] rounded-2xl overflow-hidden shadow-xl">
          <div className="p-5 border-b border-white/[0.05] flex flex-row gap-4 justify-between items-center bg-[#0d1117]/50">
            <div className="flex items-center gap-3 flex-1">
              <div className="relative w-full max-w-sm h-10">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">🔍</span>
                <input type="text" placeholder="Cari nama supplier..." value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-10 bg-[#0d1117] border border-white/10 text-white text-sm rounded-xl pl-9 pr-4 focus:outline-none focus:border-green-500/50 hover:border-white/20 transition-colors"
                />
              </div>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
                className="h-10 bg-[#0d1117] border border-white/10 text-white text-sm rounded-xl px-4 focus:outline-none focus:border-green-500/50"
              >
                <option value="Semua">Tampilkan Semua</option>
                <option value="Belum Lunas">Belum Lunas</option>
                <option value="Lunas">Lunas</option>
              </select>
            </div>
            <button onClick={fetchUtang}
              className="h-10 bg-white/5 hover:bg-white/10 text-white px-4 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 border border-white/5"
            >
              🔄 Segarkan Data
            </button>
          </div>

          <div className="overflow-x-auto min-h-[400px]">
            {isLoading ? (
              <div className="p-12 text-center text-gray-400 flex flex-col items-center">
                <div className="w-8 h-8 border-4 border-green-500/30 border-t-green-500 rounded-full animate-spin mb-4"></div>
                Memuat data utang...
              </div>
            ) : filteredData.length === 0 ? (
              <div className="p-20 text-center text-gray-500 flex flex-col items-center">
                <span className="text-5xl mb-4 grayscale opacity-40">🧾</span>
                <p className="text-lg">Tidak ada data utang yang sesuai filter.</p>
              </div>
            ) : (
              <table className="w-full text-left text-sm text-gray-300">
                <thead className="text-xs text-gray-400 uppercase bg-[#0d1117]/80 border-b border-white/[0.05]">
                  <tr>
                    <th className="px-6 py-4 font-medium">Nama Supplier</th>
                    <th className="px-6 py-4 font-medium text-right">Total Utang (Sisa)</th>
                    <th className="px-6 py-4 font-medium text-center">Status</th>
                    <th className="px-6 py-4 font-medium text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.02]">
                  {filteredData.map((group, idx) => {
                    const isLunas = group.isLunas || group.total_sisa <= 0
                    return (
                      <tr key={idx} className="hover:bg-white/[0.01] transition-colors">
                        <td className="px-6 py-4 font-medium text-white text-base">{group.nama_supplier}</td>
                        <td className={`px-6 py-4 text-right font-bold ${isLunas ? 'text-gray-500' : 'text-red-400'}`}>{formatRp(group.total_sisa)}</td>
                        <td className="px-6 py-4 text-center">
                          <span className={`px-3 py-1.5 text-xs font-semibold rounded-full border ${isLunas ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                            {isLunas ? 'Lunas' : 'Belum Lunas'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center flex justify-center items-center gap-2">
                          <button onClick={() => setSelectedSupplierDetail(group)}
                            className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 px-4 py-2 rounded-lg text-xs font-semibold transition-all border border-blue-500/20"
                          >
                            Detail
                          </button>
                          {!isLunas ? (
                            <button onClick={() => openPaymentModal(group)}
                              className="bg-green-500/10 hover:bg-green-500/20 text-green-400 px-4 py-2 rounded-lg text-xs font-semibold transition-all border border-green-500/20"
                            >
                              Bayar
                            </button>
                          ) : (
                            <span className="text-gray-500 text-xs italic px-4 py-2">Selesai</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                {searchQuery && filteredData.length > 0 && (
                  <tfoot className="border-t border-white/10 bg-[#0d1117]">
                    <tr>
                      <td className="px-6 py-5 text-right font-medium text-gray-400">
                        Total sisa utang untuk "{searchQuery}":
                      </td>
                      <td className="px-6 py-5 text-right font-bold text-red-400 text-base">{formatRp(searchSisaTotal)}</td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            )}
          </div>
        </div>
      </main>

      {/* MODAL DETAIL */}
      {selectedSupplierDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#161b22] border border-white/10 rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b border-white/5 bg-black/20">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <span className="text-blue-500">📋</span> Detail Utang - {selectedSupplierDetail.nama_supplier}
              </h3>
              <button onClick={() => setSelectedSupplierDetail(null)}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400"
              >✕</button>
            </div>

            <div className="p-0 overflow-y-auto max-h-[70vh]">
               <table className="w-full text-left text-sm text-gray-300">
                <thead className="text-xs text-gray-400 uppercase bg-[#0d1117]/80 border-b border-white/[0.05] sticky top-0 backdrop-blur-md">
                  <tr>
                    <th className="px-6 py-4 font-medium">Tanggal</th>
                    <th className="px-6 py-4 font-medium">Produk</th>
                    <th className="px-6 py-4 font-medium text-right">Total Modal</th>
                    <th className="px-6 py-4 font-medium text-right">Terbayar</th>
                    <th className="px-6 py-4 font-medium text-right">Sisa Utang</th>
                    <th className="px-6 py-4 font-medium text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.02]">
                  {selectedSupplierDetail.records.sort((a,b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime()).map(record => {
                     const isRecordLunas = record.status === 'lunas' || record.sisa <= 0
                     return (
                        <tr key={record.id} className="hover:bg-white/[0.01] transition-colors">
                           <td className="px-6 py-4 whitespace-nowrap">{formatDate(record.tanggal)}</td>
                           <td className="px-6 py-4 text-gray-300">{record.nama_produk}</td>
                           <td className="px-6 py-4 text-right text-gray-400">{formatRp(record.total)}</td>
                           <td className="px-6 py-4 text-right text-green-400">{formatRp(record.terbayar)}</td>
                           <td className={`px-6 py-4 text-right font-bold ${isRecordLunas ? 'text-gray-500' : 'text-red-400'}`}>{formatRp(record.sisa)}</td>
                           <td className="px-6 py-4 text-center">
                              <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${isRecordLunas ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                                 {isRecordLunas ? 'Lunas' : 'Belum Lunas'}
                              </span>
                           </td>
                        </tr>
                     )
                  })}
                </tbody>
               </table>
            </div>
            
            <div className="p-6 border-t border-white/5 flex gap-3 bg-black/20 rounded-b-2xl justify-end">
               <button onClick={() => setSelectedSupplierDetail(null)}
                  className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl font-medium transition-colors"
               >Tutup Detail</button>
            </div>
         </div>
         </div>
      )}

      {/* PAYMENT MODAL */}
      {selectedSupplierPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#161b22] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b border-white/5 bg-black/20">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <span className="text-green-500">💳</span> Bayar Utang Supplier
              </h3>
              <button onClick={() => !isSubmitting && setSelectedSupplierPayment(null)}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400"
                disabled={isSubmitting}
              >✕</button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5">
              <div className="bg-[#0d1117] p-4 rounded-xl border border-white/5 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-400 text-sm">Supplier:</span>
                  <span className="text-white font-medium">{selectedSupplierPayment.nama_supplier}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 text-sm">Jumlah Item Utang:</span>
                  <span className="text-white font-medium">{selectedSupplierPayment.records.filter(r => r.status === 'belum lunas').length} baris</span>
                </div>
                <p className="text-xs text-orange-400 mt-1 italic leading-snug">Pembayaran akan didistribusikan dari utang paling lama terlebih dahulu.</p>
                <div className="flex justify-between text-lg pt-2 border-t border-white/5 mt-2">
                  <span className="text-gray-300 font-medium">Total Sisa Utang:</span>
                  <span className="text-red-400 font-bold">{formatRp(selectedSupplierPayment.total_sisa)}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-gray-300 text-sm font-medium">Nominal Pembayaran (Rp)</label>
                <div className="flex items-center bg-[#0d1117] border border-white/10 rounded-xl overflow-hidden focus-within:border-green-500 focus-within:ring-1 focus-within:ring-green-500 transition-all">
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    max={selectedSupplierPayment.total_sisa}
                    value={amountPaid}
                    onChange={e => setAmountPaid(e.target.value)}
                    onWheel={(e) => (e.target as HTMLInputElement).blur()}
                    className="flex-1 bg-transparent text-white text-lg px-4 py-3 focus:outline-none font-mono [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    placeholder="0"
                  />
                  <div className="flex flex-col border-l border-white/10">
                    <button
                      type="button"
                      onClick={() => setAmountPaid(prev => Math.min(selectedSupplierPayment.total_sisa, (parseFloat(prev) || 0) + 1000).toString())}
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
                  <p className="text-xs text-gray-500">Total sisa setelah bayar:</p>
                  <p className={`text-sm font-bold ${selectedSupplierPayment.total_sisa - (parseFloat(amountPaid) || 0) <= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {formatRp(Math.max(0, selectedSupplierPayment.total_sisa - (parseFloat(amountPaid) || 0)))}
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-gray-300 text-sm font-medium">Bayar Via</label>
                <select value={paymentVia} onChange={e => setPaymentVia(e.target.value)}
                  className="w-full bg-[#0d1117] border border-white/10 text-white text-base rounded-xl px-4 py-3 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all"
                >
                  <option value="Tunai">💵 Tunai (Cash)</option>
                  <option value="Transfer">💳 Transfer Bank</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-gray-300 text-sm font-medium">Tanggal Pembayaran</label>
                <input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} onClick={e => (e.target as any).showPicker?.()}
                  className="w-full cursor-pointer bg-[#0d1117] border border-white/10 text-white text-base rounded-xl px-4 py-3 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert"
                />
              </div>
            </div>

            <div className="p-6 border-t border-white/5 flex gap-3 bg-black/20 rounded-b-2xl">
              <button onClick={() => setSelectedSupplierPayment(null)} disabled={isSubmitting}
                className="flex-1 px-6 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl font-medium transition-colors"
              >Batal</button>
              <button onClick={handlePaymentSubmit} disabled={isSubmitting}
                className="flex-1 px-6 py-3 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white rounded-xl font-bold transition-all shadow-lg shadow-green-900/20"
              >{isSubmitting ? "Menyimpan..." : "Simpan Pembayaran"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
