"use client"

import { useState, useEffect, useMemo } from "react"
import { supabase } from "@/utils/supabase/client"
import { fetchAllRows } from "@/lib/fetchAll"
import { buildLayersAtDate, hitungHPPFIFO } from "@/lib/fifo"

type Transaksi = {
  id: number; no_nota: string; tanggal: string
  nama_pembeli: string; jenis_pembayaran: string; total: number
}
type TransaksiDetail = {
  id: number; transaksi_id: number; nama_produk: string
  qty: number; harga: number; subtotal: number
}
type Piutang = {
  id: number; nama_pembeli: string; sisa: number
}
type HPPLatest = {
  nama_produk: string; hpp_satuan: number
}

const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
]

const currentDate = new Date()
const thisYear = currentDate.getFullYear()
const years = Array.from({ length: thisYear - 2024 + 2 }, (_, i) => 2024 + i)

export default function RekapPage() {
  const [activeTab, setActiveTab] = useState<'pembeli' | 'produk'>('pembeli')
  const [filterBulan, setFilterBulan] = useState(0)
  const [filterTahun, setFilterTahun] = useState(thisYear)
  const [isLoading, setIsLoading] = useState(true)

  const [transaksiAll, setTransaksiAll] = useState<any[]>([])
  const [detailAll, setDetailAll] = useState<any[]>([])
  const [piutangAll, setPiutangAll] = useState<any[]>([])
  const [hppAll, setHppAll] = useState<any[]>([])
  const [stokAwalMap, setStokAwalMap] = useState<any>({})
  const [konversiDetailAll, setKonversiDetailAll] = useState<any[]>([])

  // Modal detail pembeli
  const [modalPembeli, setModalPembeli] = useState<string | null>(null)
  
  // State Filter & Sort Rekap Pembeli
  const [searchPembeli, setSearchPembeli] = useState("")
  const [sortPembeli, setSortPembeli] = useState("total_desc")

  const formatRp = (n: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n)
  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    setIsLoading(true)
    try {
      const [trxData, detailRaw, piutangData, hppData, produkData, konversiData] = await Promise.all([
        fetchAllRows('transaksi', '*', { order: ['tanggal', false] }),
        fetchAllRows('transaksi_detail', '*'),
        fetchAllRows('piutang', 'nama_pembeli, sisa'),
        fetchAllRows('hpp', '*', { order: ['tanggal', true] }),
        supabase.from('produk').select('*'),
        fetchAllRows('konversi_stok_detail', '*, konversi_stok(tanggal)')
      ])
      
      const trxMap = Object.fromEntries(trxData.map(t => [t.id, t]))
      const joinedDetail = detailRaw.map(d => ({
        ...d,
        transaksi: trxMap[d.transaksi_id] || null
      }))

      setTransaksiAll(trxData)
      setDetailAll(joinedDetail)
      setPiutangAll(piutangData)
      setHppAll(hppData)
      setKonversiDetailAll(konversiData)

      const saMap: Record<string, any> = {}
      if (produkData.data) {
        produkData.data.forEach((p: any) => {
          const hppPertama = hppData.filter((h: any) => h.nama_produk === p.nama)
            .sort((a: any, b: any) => new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime())[0]
          saMap[p.nama] = { qty: p.stok_awal || 0, hpp_satuan: hppPertama?.hpp_satuan || 0, tanggal: '2026-03-30' }
        })
      }
      setStokAwalMap(saMap)
    } catch (e) { console.error(e) }
    finally { setIsLoading(false) }
  }

  // Filter transaksi by bulan/tahun (0 = semua)
  const filteredTrx = useMemo(() => transaksiAll.filter(t => {
    const d = new Date(t.tanggal)
    if (filterTahun !== 0 && d.getFullYear() !== filterTahun) return false
    if (filterBulan !== 0 && d.getMonth() + 1 !== filterBulan) return false
    return true
  }), [transaksiAll, filterBulan, filterTahun])

  const filteredTrxIds = useMemo(() => new Set(filteredTrx.map(t => t.id)), [filteredTrx])

  const filteredDetail = useMemo(() =>
    detailAll.filter(d => filteredTrxIds.has(d.transaksi_id)),
    [detailAll, filteredTrxIds]
  )

  // ===== REKAP PEMBELI =====
  const rekapPembeli = useMemo(() => {
    const map: Record<string, { trx: Transaksi[] }> = {}
    filteredTrx.forEach(t => {
      if (!map[t.nama_pembeli]) map[t.nama_pembeli] = { trx: [] }
      map[t.nama_pembeli].trx.push(t)
    })

    // Aggregate piutang per pembeli
    const piutangMap: Record<string, number> = {}
    piutangAll.forEach(p => {
      piutangMap[p.nama_pembeli] = (piutangMap[p.nama_pembeli] || 0) + p.sisa
    })

    return Object.entries(map).map(([nama, { trx }]) => {
      const totalBeli = trx.reduce((acc, t) => acc + t.total, 0)
      const jmlTrx = trx.length
      const rataRata = jmlTrx > 0 ? totalBeli / jmlTrx : 0
      const terakhir = trx.reduce((latest, t) => t.tanggal > latest ? t.tanggal : latest, trx[0].tanggal)
      const sisaPiutang = piutangMap[nama] || 0
      return { nama, jmlTrx, totalBeli, rataRata, terakhir, sisaPiutang, trxList: trx }
    }).sort((a, b) => b.totalBeli - a.totalBeli)
  }, [filteredTrx, piutangAll])

  const filteredPembeli = useMemo(() => {
    let list = rekapPembeli
    
    // Filter search
    if (searchPembeli) {
      list = list.filter(p => p.nama.toLowerCase().includes(searchPembeli.toLowerCase()))
    }
    
    // Sort
    switch (sortPembeli) {
      case 'total_desc': list = [...list].sort((a, b) => b.totalBeli - a.totalBeli); break
      case 'total_asc': list = [...list].sort((a, b) => a.totalBeli - b.totalBeli); break
      case 'trx_desc': list = [...list].sort((a, b) => b.jmlTrx - a.jmlTrx); break
      case 'trx_asc': list = [...list].sort((a, b) => a.jmlTrx - b.jmlTrx); break
      case 'piutang_desc': list = [...list].sort((a, b) => (b.sisaPiutang || 0) - (a.sisaPiutang || 0)); break
      case 'piutang_asc': list = [...list].sort((a, b) => (a.sisaPiutang || 0) - (b.sisaPiutang || 0)); break
      case 'nama_az': list = [...list].sort((a, b) => a.nama.localeCompare(b.nama)); break
      case 'nama_za': list = [...list].sort((a, b) => b.nama.localeCompare(a.nama)); break
      case 'terakhir_desc': list = [...list].sort((a, b) => new Date(b.terakhir).getTime() - new Date(a.terakhir).getTime()); break
    }
    
    return list
  }, [rekapPembeli, searchPembeli, sortPembeli])

  // ===== REKAP PRODUK =====
  const rekapProduk = useMemo(() => {
    const map: Record<string, { qty: number; total_omzet: number; satuan: string }> = {}
    filteredDetail.forEach((d: any) => {
      if (!map[d.nama_produk]) map[d.nama_produk] = { qty: 0, total_omzet: 0, satuan: "" }
      map[d.nama_produk].qty += d.qty
      map[d.nama_produk].total_omzet += d.subtotal
    })

    return Object.entries(map).map(([nama, { qty, total_omzet }]) => {
      // Dapatkan semua transaksi produk ini urut tanggal
      const detailProduk = detailAll
        .filter((d: any) => d.nama_produk === nama)
        .sort((a: any, b: any) => {
          const tA = Array.isArray(a.transaksi) ? a.transaksi[0]?.tanggal : a.transaksi?.tanggal
          const tB = Array.isArray(b.transaksi) ? b.transaksi[0]?.tanggal : b.transaksi?.tanggal
          return new Date(tA || 0).getTime() - new Date(tB || 0).getTime()
        })

      // Hitung HPP FIFO secara kumulatif per transaksi
      let total_hpp_fifo = 0
      let layersCurrent = buildLayersAtDate(hppAll, [], [], stokAwalMap, nama, new Date('2026-03-31'))
      
      // Tambah semua pembelian dari awal
      hppAll
        .filter((h: any) => h.nama_produk === nama)
        .sort((a: any, b: any) => new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime())
        .forEach((h: any) => layersCurrent.push({ tanggal: h.tanggal, qty_awal: h.qty, qty_sisa: h.qty, hpp_satuan: h.hpp_satuan }))

      detailProduk.forEach((d: any) => {
        const fifo = hitungHPPFIFO(layersCurrent, d.qty)
        // Kalau d.id ada di filteredDetail, maka kita tambahkan ke total_hpp_fifo
        // Wait, the FIFO must consume ALL transactions from beginning to ensure correct stock matching.
        // So we consume all, but only add to total_hpp_fifo if this detail is inside `filteredDetail`.
        // Wait, `filteredDetail` contains the transactions for the selected filter period!
        if (filteredTrxIds.has(d.transaksi_id)) {
          total_hpp_fifo += fifo.total_hpp
        }
        
        // Consume layers
        let remaining = d.qty
        for (const layer of layersCurrent) {
          if (remaining <= 0) break
          const consumed = Math.min(remaining, layer.qty_sisa)
          layer.qty_sisa -= consumed
          remaining -= consumed
        }
      })

      const laba_kotor_fifo = total_omzet - total_hpp_fifo
      const margin_fifo = total_omzet > 0 ? (laba_kotor_fifo / total_omzet) * 100 : 0
      
      return { nama, qty, total_omzet, total_hpp_fifo, laba_kotor_fifo, margin_fifo }
    }).sort((a, b) => b.total_omzet - a.total_omzet)
  }, [filteredDetail, detailAll, hppAll, stokAwalMap, filteredTrxIds])

  const totalRekapProduk = useMemo(() => rekapProduk.reduce(
    (acc, r) => ({
      qty: acc.qty + r.qty,
      total_omzet: acc.total_omzet + r.total_omzet,
      total_hpp_fifo: acc.total_hpp_fifo + r.total_hpp_fifo,
      laba_kotor_fifo: acc.laba_kotor_fifo + r.laba_kotor_fifo,
    }),
    { qty: 0, total_omzet: 0, total_hpp_fifo: 0, laba_kotor_fifo: 0 }
  ), [rekapProduk])

  // Transaksi modal pembeli
  const modalTrxList = useMemo(() => {
    if (!modalPembeli) return []
    return transaksiAll.filter(t => t.nama_pembeli === modalPembeli).sort((a, b) => b.tanggal.localeCompare(a.tanggal))
  }, [modalPembeli, transaksiAll])

  const FilterBar = () => (
    <div className="flex items-center gap-3">
      <select value={filterBulan} onChange={e => setFilterBulan(parseInt(e.target.value))}
        className="bg-[#161b22] border border-white/10 text-white rounded-xl px-4 h-10 text-sm focus:outline-none focus:border-green-500">
        <option value={0}>Semua Bulan</option>
        {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
      </select>
      <select value={filterTahun} onChange={e => setFilterTahun(parseInt(e.target.value))}
        className="bg-[#161b22] border border-white/10 text-white rounded-xl px-4 h-10 text-sm focus:outline-none focus:border-green-500">
        <option value={0}>Semua Tahun</option>
        {years.map(y => <option key={y} value={y}>{y}</option>)}
      </select>
    </div>
  )

  return (
    <>
      <header className="sticky top-0 z-10 flex items-center justify-between px-8 py-5 bg-[#0d1117]/80 backdrop-blur border-b border-white/[0.05]">
        <div>
          <h2 className="text-2xl font-bold text-white">Rekap</h2>
          <p className="text-sm text-gray-500 mt-0.5">Analisa per pembeli dan per produk</p>
        </div>
        <button onClick={fetchAll} className="bg-white/5 hover:bg-white/10 text-white text-sm font-medium px-4 py-2.5 rounded-xl border border-white/10 transition-colors">
          🔄 Refresh
        </button>
      </header>

      <main className="p-8 space-y-6">
        {/* Tabs */}
        <div className="flex gap-2 border-b border-white/[0.05]">
          {[
            { key: 'pembeli', label: '👤 Rekap Pembeli' },
            { key: 'produk', label: '📦 Rekap Produk' },
          ].map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
              className={`px-5 py-3 text-sm font-semibold rounded-t-xl transition-colors ${activeTab === tab.key ? 'bg-[#161b22] text-white border border-b-0 border-white/10' : 'text-gray-500 hover:text-gray-300'}`}>
              {tab.label}
            </button>
          ))}
        </div>

        <FilterBar />

        {isLoading ? (
          <div className="p-20 flex flex-col items-center text-gray-400">
            <div className="w-10 h-10 border-4 border-green-500/30 border-t-green-500 rounded-full animate-spin mb-4"></div>
            Memuat data...
          </div>
        ) : (
          <>
            {/* ===== REKAP PEMBELI ===== */}
            {activeTab === 'pembeli' && (
              <div className="bg-[#161b22] border border-white/[0.05] rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-white/[0.05] flex items-center justify-between">
                  <h3 className="font-bold text-white">Daftar Pembeli</h3>
                  <span className="text-xs text-gray-500">{filteredPembeli.length} pembeli</span>
                </div>
                
                {/* Filter & Sort Bar */}
                <div className="px-6 py-4 border-b border-white/[0.05] bg-[#0d1117]/50">
                  <div className="flex gap-3 items-center">
                    <input
                      value={searchPembeli}
                      onChange={e => setSearchPembeli(e.target.value)}
                      placeholder="🔍 Cari nama pembeli..."
                      className="flex-1 bg-[#161b22] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-green-500/50"
                    />
                    <select
                      value={sortPembeli}
                      onChange={e => setSortPembeli(e.target.value)}
                      className="bg-[#161b22] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none cursor-pointer"
                    >
                      <option value="total_desc">Total Beli Terbesar</option>
                      <option value="total_asc">Total Beli Terkecil</option>
                      <option value="trx_desc">Transaksi Terbanyak</option>
                      <option value="trx_asc">Transaksi Tersedikit</option>
                      <option value="piutang_desc">Piutang Terbesar</option>
                      <option value="piutang_asc">Piutang Terkecil</option>
                      <option value="nama_az">Nama A-Z</option>
                      <option value="nama_za">Nama Z-A</option>
                      <option value="terakhir_desc">Transaksi Terbaru</option>
                    </select>
                  </div>
                </div>

                {filteredPembeli.length === 0 ? (
                  <div className="p-12 text-center text-gray-500">
                    <span className="text-4xl block mb-3 opacity-40">👤</span>
                    Tidak ada pembeli yang sesuai.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-gray-300">
                      <thead className="text-xs text-gray-400 uppercase bg-[#0d1117]/80 border-b border-white/[0.05]">
                        <tr>
                          <th className="px-4 py-3 text-left">No</th>
                          <th className="px-4 py-3 text-left">Nama Pembeli</th>
                          <th className="px-4 py-3 text-right">Jml Transaksi</th>
                          <th className="px-4 py-3 text-right">Total Beli</th>
                          <th className="px-4 py-3 text-right">Rata-rata/Trx</th>
                          <th className="px-4 py-3 text-left">Trx Terakhir</th>
                          <th className="px-4 py-3 text-right">Sisa Piutang</th>
                          <th className="px-4 py-3 text-center">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.02]">
                        {filteredPembeli.map((r, i) => (
                          <tr key={r.nama} className="hover:bg-white/[0.01] transition-colors">
                            <td className="px-4 py-3 text-gray-500">{i + 1}</td>
                            <td className="px-4 py-3 font-semibold text-white">{r.nama}</td>
                            <td className="px-4 py-3 text-right text-gray-300">{r.jmlTrx}x</td>
                            <td className="px-4 py-3 text-right font-semibold text-green-400">{formatRp(r.totalBeli)}</td>
                            <td className="px-4 py-3 text-right text-gray-400">{formatRp(r.rataRata)}</td>
                            <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{formatDate(r.terakhir)}</td>
                            <td className="px-4 py-3 text-right">
                              {r.sisaPiutang > 0
                                ? <span className="font-semibold text-orange-400">{formatRp(r.sisaPiutang)}</span>
                                : <span className="text-gray-600">-</span>
                              }
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button onClick={() => setModalPembeli(r.nama)}
                                className="bg-green-500/10 hover:bg-green-500/20 text-green-400 px-3 py-1.5 rounded-lg text-xs font-semibold border border-green-500/20 transition-all">
                                Lihat Detail
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ===== REKAP PRODUK ===== */}
            {activeTab === 'produk' && (
              <div className="bg-[#161b22] border border-white/[0.05] rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-white/[0.05] flex items-center justify-between">
                  <h3 className="font-bold text-white">Rekap per Produk</h3>
                  <span className="text-xs text-gray-500">{rekapProduk.length} produk</span>
                </div>
                {rekapProduk.length === 0 ? (
                  <div className="p-12 text-center text-gray-500">
                    <span className="text-4xl block mb-3 opacity-40">📦</span>
                    Tidak ada data penjualan pada periode ini
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-gray-300">
                      <thead className="text-xs text-gray-400 uppercase bg-[#0d1117]/80 border-b border-white/[0.05]">
                        <tr>
                          <th className="px-4 py-3 text-left">No</th>
                          <th className="px-4 py-3 text-left">Produk</th>
                          <th className="px-4 py-3 text-right">Qty Terjual</th>
                          <th className="px-4 py-3 text-right">Omzet</th>
                          <th className="px-4 py-3 text-right">HPP Total FIFO</th>
                          <th className="px-4 py-3 text-right">Laba Kotor FIFO</th>
                          <th className="px-4 py-3 text-right">Margin FIFO</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.02]">
                        {rekapProduk.map((r, i) => (
                          <tr key={r.nama} className="hover:bg-white/[0.01] transition-colors">
                            <td className="px-4 py-3 text-gray-500">{i + 1}</td>
                            <td className="px-4 py-3 font-semibold text-white">{r.nama}</td>
                            <td className="px-4 py-3 text-right text-gray-300">{r.qty.toLocaleString("id-ID")}</td>
                            <td className="px-4 py-3 text-right font-semibold text-green-400">{formatRp(r.total_omzet)}</td>
                            <td className="px-4 py-3 text-right text-red-400">{formatRp(r.total_hpp_fifo)}</td>
                            <td className={`px-4 py-3 text-right font-semibold ${r.laba_kotor_fifo >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
                              {formatRp(r.laba_kotor_fifo)}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className={`px-2 py-0.5 rounded text-xs font-bold ${r.margin_fifo >= 20 ? 'bg-green-500/10 text-green-400 border border-green-500/20' : r.margin_fifo >= 10 ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                                {r.margin_fifo.toFixed(1)}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="border-t border-white/10 bg-[#0d1117]/60">
                        <tr className="font-bold">
                          <td colSpan={2} className="px-4 py-3 text-gray-400">Total</td>
                          <td className="px-4 py-3 text-right text-white">{totalRekapProduk.qty.toLocaleString("id-ID")}</td>
                          <td className="px-4 py-3 text-right text-green-400">{formatRp(totalRekapProduk.total_omzet)}</td>
                          <td className="px-4 py-3 text-right text-red-400">{formatRp(totalRekapProduk.total_hpp_fifo)}</td>
                          <td className={`px-4 py-3 text-right ${totalRekapProduk.laba_kotor_fifo >= 0 ? 'text-blue-400' : 'text-red-400'}`}>{formatRp(totalRekapProduk.laba_kotor_fifo)}</td>
                          <td className="px-4 py-3 text-right text-gray-400 text-xs">
                            {totalRekapProduk.total_omzet > 0 ? ((totalRekapProduk.laba_kotor_fifo / totalRekapProduk.total_omzet) * 100).toFixed(1) + '%' : '-'}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>

      {/* Modal Detail Pembeli */}
      {modalPembeli && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#161b22] border border-white/10 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between p-6 border-b border-white/5">
              <div>
                <h3 className="text-lg font-bold text-white">Detail Transaksi</h3>
                <p className="text-sm text-green-400 mt-0.5">{modalPembeli}</p>
              </div>
              <button onClick={() => setModalPembeli(null)}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400">✕</button>
            </div>
            <div className="overflow-y-auto flex-1">
              {modalTrxList.length === 0 ? (
                <div className="p-12 text-center text-gray-500">Tidak ada transaksi</div>
              ) : (
                <table className="w-full text-sm text-gray-300">
                  <thead className="text-xs text-gray-400 uppercase bg-[#0d1117]/80 border-b border-white/[0.05] sticky top-0">
                    <tr>
                      <th className="px-5 py-3 text-left">Tanggal</th>
                      <th className="px-5 py-3 text-left">No Nota</th>
                      <th className="px-5 py-3 text-left">Pembayaran</th>
                      <th className="px-5 py-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.02]">
                    {modalTrxList.map(t => (
                      <tr key={t.id} className="hover:bg-white/[0.01]">
                        <td className="px-5 py-3 text-gray-400 whitespace-nowrap">{formatDate(t.tanggal)}</td>
                        <td className="px-5 py-3 font-mono text-gray-300">{t.no_nota}</td>
                        <td className="px-5 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded border font-semibold ${t.jenis_pembayaran === 'Tunai' ? 'bg-green-500/10 text-green-400 border-green-500/20' : t.jenis_pembayaran === 'Transfer' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-orange-500/10 text-orange-400 border-orange-500/20'}`}>
                            {t.jenis_pembayaran}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right font-semibold text-green-400">{formatRp(t.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t border-white/10 bg-[#0d1117]/60">
                    <tr>
                      <td colSpan={3} className="px-5 py-3 text-gray-400 font-semibold">Total</td>
                      <td className="px-5 py-3 text-right font-bold text-green-400 text-base">
                        {formatRp(modalTrxList.reduce((acc, t) => acc + t.total, 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
            <div className="p-4 border-t border-white/5">
              <button onClick={() => setModalPembeli(null)}
                className="w-full py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl font-medium transition-colors">
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}