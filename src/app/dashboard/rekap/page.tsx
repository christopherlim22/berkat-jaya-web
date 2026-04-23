"use client"

import { useState, useEffect, useMemo } from "react"
import { supabase } from "@/utils/supabase/client"

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

  const [transaksiAll, setTransaksiAll] = useState<Transaksi[]>([])
  const [detailAll, setDetailAll] = useState<TransaksiDetail[]>([])
  const [piutangAll, setPiutangAll] = useState<Piutang[]>([])
  const [hppLatest, setHppLatest] = useState<HPPLatest[]>([])

  // Modal detail pembeli
  const [modalPembeli, setModalPembeli] = useState<string | null>(null)

  const formatRp = (n: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n)
  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    setIsLoading(true)
    try {
      const [trxRes, detailRes, piutangRes, hppRes] = await Promise.all([
        supabase.from('transaksi').select('*').order('tanggal', { ascending: false }),
        supabase.from('transaksi_detail').select('*'),
        supabase.from('piutang').select('nama_pembeli, sisa'),
        supabase.from('hpp').select('nama_produk, hpp_satuan, tanggal').order('tanggal', { ascending: false }),
      ])
      if (trxRes.data) setTransaksiAll(trxRes.data as Transaksi[])
      if (detailRes.data) setDetailAll(detailRes.data as TransaksiDetail[])
      if (piutangRes.data) setPiutangAll(piutangRes.data as Piutang[])

      // Keep only latest HPP per produk
      if (hppRes.data) {
        const seen = new Set<string>()
        const latest: HPPLatest[] = []
        for (const row of hppRes.data as any[]) {
          if (!seen.has(row.nama_produk)) {
            seen.add(row.nama_produk)
            latest.push({ nama_produk: row.nama_produk, hpp_satuan: row.hpp_satuan })
          }
        }
        setHppLatest(latest)
      }
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

  // ===== REKAP PRODUK =====
  const rekapProduk = useMemo(() => {
    const map: Record<string, { qty: number; omzet: number; satuan: string }> = {}
    filteredDetail.forEach(d => {
      if (!map[d.nama_produk]) map[d.nama_produk] = { qty: 0, omzet: 0, satuan: "" }
      map[d.nama_produk].qty += d.qty
      map[d.nama_produk].omzet += d.subtotal
    })

    const hppMap: Record<string, number> = {}
    hppLatest.forEach(h => { hppMap[h.nama_produk] = h.hpp_satuan })

    return Object.entries(map).map(([nama, { qty, omzet }]) => {
      const hppSatuan = hppMap[nama] || 0
      const hppTotal = qty * hppSatuan
      const labaKotor = omzet - hppTotal
      const margin = omzet > 0 ? (labaKotor / omzet) * 100 : 0
      return { nama, qty, omzet, hppTotal, labaKotor, margin }
    }).sort((a, b) => b.omzet - a.omzet)
  }, [filteredDetail, hppLatest])

  const totalRekapProduk = useMemo(() => rekapProduk.reduce(
    (acc, r) => ({
      qty: acc.qty + r.qty,
      omzet: acc.omzet + r.omzet,
      hppTotal: acc.hppTotal + r.hppTotal,
      labaKotor: acc.labaKotor + r.labaKotor,
    }),
    { qty: 0, omzet: 0, hppTotal: 0, labaKotor: 0 }
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
                  <span className="text-xs text-gray-500">{rekapPembeli.length} pembeli</span>
                </div>
                {rekapPembeli.length === 0 ? (
                  <div className="p-12 text-center text-gray-500">
                    <span className="text-4xl block mb-3 opacity-40">👤</span>
                    Tidak ada transaksi pada periode ini
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
                        {rekapPembeli.map((r, i) => (
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
                          <th className="px-4 py-3 text-right">HPP Total</th>
                          <th className="px-4 py-3 text-right">Laba Kotor</th>
                          <th className="px-4 py-3 text-right">Margin</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.02]">
                        {rekapProduk.map((r, i) => (
                          <tr key={r.nama} className="hover:bg-white/[0.01] transition-colors">
                            <td className="px-4 py-3 text-gray-500">{i + 1}</td>
                            <td className="px-4 py-3 font-semibold text-white">{r.nama}</td>
                            <td className="px-4 py-3 text-right text-gray-300">{r.qty.toLocaleString("id-ID")}</td>
                            <td className="px-4 py-3 text-right font-semibold text-green-400">{formatRp(r.omzet)}</td>
                            <td className="px-4 py-3 text-right text-red-400">{formatRp(r.hppTotal)}</td>
                            <td className={`px-4 py-3 text-right font-semibold ${r.labaKotor >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
                              {formatRp(r.labaKotor)}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className={`px-2 py-0.5 rounded text-xs font-bold ${r.margin >= 20 ? 'bg-green-500/10 text-green-400 border border-green-500/20' : r.margin >= 10 ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                                {r.margin.toFixed(1)}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="border-t border-white/10 bg-[#0d1117]/60">
                        <tr className="font-bold">
                          <td colSpan={2} className="px-4 py-3 text-gray-400">Total</td>
                          <td className="px-4 py-3 text-right text-white">{totalRekapProduk.qty.toLocaleString("id-ID")}</td>
                          <td className="px-4 py-3 text-right text-green-400">{formatRp(totalRekapProduk.omzet)}</td>
                          <td className="px-4 py-3 text-right text-red-400">{formatRp(totalRekapProduk.hppTotal)}</td>
                          <td className={`px-4 py-3 text-right ${totalRekapProduk.labaKotor >= 0 ? 'text-blue-400' : 'text-red-400'}`}>{formatRp(totalRekapProduk.labaKotor)}</td>
                          <td className="px-4 py-3 text-right text-gray-400 text-xs">
                            {totalRekapProduk.omzet > 0 ? ((totalRekapProduk.labaKotor / totalRekapProduk.omzet) * 100).toFixed(1) + '%' : '-'}
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