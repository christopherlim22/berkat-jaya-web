"use client"

import { useState, useEffect, useMemo } from "react"
import { supabase } from "@/utils/supabase/client"
import { Calendar, DollarSign, Package, Users, Banknote, CreditCard, Wallet, TrendingUp } from "lucide-react"
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, Sector
} from "recharts"

type Transaksi = {
  id: number
  no_nota: string
  tanggal: string
  nama_pembeli: string
  jenis_pembayaran: string
  total: number
}

type TransaksiDetail = {
  id: number
  transaksi_id: number
  nama_produk: string
  qty: number
  harga: number
  subtotal: number
}

type Pengeluaran = {
  id: number
  tanggal: string
  kategori: string
  keterangan: string
  sub_kategori: string
  jumlah: number
}

type HPP = {
  id: number
  tanggal: string
  total_modal: number
}

type HPPFull = {
  id: number
  tanggal: string
  nama_produk: string
  qty: number
  hpp_satuan: number
  total_modal: number
}

type ProdukRow = {
  id: number
  nama: string
  stok_awal: number
}

type OpnameRecord = {
  id: number
  tanggal: string
  nama_produk: string
  selisih: number
}

type DetailWithDate = {
  nama_produk: string
  qty: number
  transaksi: { tanggal: string }[] | { tanggal: string } | null
}

const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
]

type Tab = 'penjualan' | 'pengeluaran' | 'laba'

export default function LaporanPage() {
  const currentDate = new Date()
  const [activeTab, setActiveTab] = useState<Tab>('penjualan')
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth())
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear())

  const [transaksi, setTransaksi] = useState<Transaksi[]>([])
  const [transaksiDetail, setTransaksiDetail] = useState<TransaksiDetail[]>([])
  const [pengeluaran, setPengeluaran] = useState<Pengeluaran[]>([])
  const [hppList, setHppList] = useState<HPP[]>([])
  const [produkList, setProdukList] = useState<ProdukRow[]>([])
  const [hppAllList, setHppAllList] = useState<HPPFull[]>([])
  const [opnameAllList, setOpnameAllList] = useState<OpnameRecord[]>([])
  const [detailAllList, setDetailAllList] = useState<DetailWithDate[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const years = Array.from({ length: currentDate.getFullYear() - 2024 + 2 }, (_, i) => 2024 + i)

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)

      const startDate = new Date(selectedYear, selectedMonth, 1)
      const endDate = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59, 999)
      const startStr = startDate.toISOString().split('T')[0]
      const endStr = endDate.toISOString().split('T')[0]

      const [trxRes, pengeluaranRes, hppRes, produkRes, hppAllRes, opnameAllRes, detailAllRes] = await Promise.all([
        supabase.from("transaksi").select("*").gte("tanggal", startDate.toISOString()).lte("tanggal", endDate.toISOString()),
        supabase.from("pengeluaran").select("*").gte("tanggal", startStr).lte("tanggal", endStr).order("tanggal", { ascending: false }),
        supabase.from("hpp").select("id, tanggal, total_modal").gte("tanggal", startStr).lte("tanggal", endStr),
        supabase.from("produk").select("id, nama, stok_awal"),
        supabase.from("hpp").select("id, tanggal, nama_produk, qty, hpp_satuan, total_modal").order("tanggal", { ascending: true }),
        supabase.from("opname").select("id, tanggal, nama_produk, selisih").order("tanggal", { ascending: true }),
        supabase.from("transaksi_detail").select("nama_produk, qty, transaksi!inner(tanggal)"),
      ])

      const trxData = trxRes.data as Transaksi[] || []
      setTransaksi(trxData)
      if (pengeluaranRes.data) setPengeluaran(pengeluaranRes.data as Pengeluaran[])
      if (hppRes.data) setHppList(hppRes.data as HPP[])
      if (produkRes.data) setProdukList(produkRes.data as ProdukRow[])
      if (hppAllRes.data) setHppAllList(hppAllRes.data as HPPFull[])
      if (opnameAllRes.data) setOpnameAllList(opnameAllRes.data as OpnameRecord[])
      if (detailAllRes.data) setDetailAllList(detailAllRes.data as unknown as DetailWithDate[])

      if (trxData.length > 0) {
        const trxIds = trxData.map(t => t.id)
        const { data: detailData } = await supabase.from("transaksi_detail").select("*").in("transaksi_id", trxIds)
        setTransaksiDetail(detailData as TransaksiDetail[] || [])
      } else {
        setTransaksiDetail([])
      }

      setIsLoading(false)
    }

    fetchData()
  }, [selectedMonth, selectedYear])

  const formatRp = (num: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(num)

  // Penjualan
  const omzet = useMemo(() => {
    let total = 0, tunai = 0, transfer = 0, piutang = 0
    transaksi.forEach(t => {
      total += t.total
      if (t.jenis_pembayaran === "Tunai") tunai += t.total
      else if (t.jenis_pembayaran === "Transfer") transfer += t.total
      else if (t.jenis_pembayaran === "Piutang") piutang += t.total
    })
    return { total, tunai, transfer, piutang }
  }, [transaksi])

  const topProducts = useMemo(() => {
    const map: Record<string, number> = {}
    transaksiDetail.forEach(td => { map[td.nama_produk] = (map[td.nama_produk] || 0) + td.qty })
    return Object.entries(map).map(([nama, qty]) => ({ nama, qty })).sort((a, b) => b.qty - a.qty).slice(0, 10)
  }, [transaksiDetail])

  const topCustomers = useMemo(() => {
    const map: Record<string, number> = {}
    transaksi.forEach(t => { map[t.nama_pembeli] = (map[t.nama_pembeli] || 0) + t.total })
    return Object.entries(map).map(([nama, total]) => ({ nama, total })).sort((a, b) => b.total - a.total).slice(0, 10)
  }, [transaksi])

  // Pengeluaran
  const totalPengeluaran = useMemo(() => pengeluaran.reduce((acc, p) => acc + p.jumlah, 0), [pengeluaran])

  const breakdownKategori = useMemo(() => {
    const map: Record<string, number> = {}
    pengeluaran.forEach(p => { map[p.kategori] = (map[p.kategori] || 0) + p.jumlah })
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5)
  }, [pengeluaran])

  // Laba
  const totalHPP = useMemo(() => hppList.reduce((acc, h) => acc + h.total_modal, 0), [hppList])

  const cogsData = useMemo(() => {
    const startDate = new Date(selectedYear, selectedMonth, 1)
    const endDate = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59, 999)

    const allNama = Array.from(new Set([
      ...produkList.map(p => p.nama),
      ...hppAllList.map(h => h.nama_produk),
    ]))

    const hppSatuanMap: Record<string, number> = {}
    hppAllList.forEach(h => { hppSatuanMap[h.nama_produk] = h.hpp_satuan })

    const stokAwalProduk: Record<string, number> = {}
    produkList.forEach(p => { stokAwalProduk[p.nama] = p.stok_awal })

    const getTanggal = (d: DetailWithDate): string | null => {
      if (!d.transaksi) return null
      if (Array.isArray(d.transaksi)) return d.transaksi[0]?.tanggal ?? null
      return d.transaksi.tanggal
    }

    let totalNilaiStokAwal = 0
    let totalNilaiStokAkhir = 0

    for (const nama of allNama) {
      const hppSatuan = hppSatuanMap[nama] || 0
      if (!hppSatuan) continue

      const masukSebelum = hppAllList.filter(h => h.nama_produk === nama && new Date(h.tanggal) < startDate).reduce((a, h) => a + h.qty, 0)
      const keluarSebelum = detailAllList.filter(d => { const t = getTanggal(d); return d.nama_produk === nama && t && new Date(t) < startDate }).reduce((a, d) => a + d.qty, 0)
      const opnameSebelum = opnameAllList.filter(o => o.nama_produk === nama && new Date(o.tanggal) < startDate).reduce((a, o) => a + o.selisih, 0)
      const stokAwalQty = (stokAwalProduk[nama] || 0) + masukSebelum - keluarSebelum + opnameSebelum

      const masukBulan = hppAllList.filter(h => h.nama_produk === nama && new Date(h.tanggal) >= startDate && new Date(h.tanggal) <= endDate).reduce((a, h) => a + h.qty, 0)
      const keluarBulan = detailAllList.filter(d => { const t = getTanggal(d); return d.nama_produk === nama && t && new Date(t) >= startDate && new Date(t) <= endDate }).reduce((a, d) => a + d.qty, 0)
      const opnameBulan = opnameAllList.filter(o => o.nama_produk === nama && new Date(o.tanggal) >= startDate && new Date(o.tanggal) <= endDate).reduce((a, o) => a + o.selisih, 0)
      const stokAkhirQty = stokAwalQty + masukBulan - keluarBulan + opnameBulan

      totalNilaiStokAwal += Math.max(0, stokAwalQty) * hppSatuan
      totalNilaiStokAkhir += Math.max(0, stokAkhirQty) * hppSatuan
    }

    const pembelianBulan = totalHPP
    const cogs = totalNilaiStokAwal + pembelianBulan - totalNilaiStokAkhir
    return { totalNilaiStokAwal, pembelianBulan, totalNilaiStokAkhir, cogs }
  }, [produkList, hppAllList, detailAllList, opnameAllList, selectedMonth, selectedYear, totalHPP])

  const labaKotor = omzet.total - cogsData.cogs
  const labaBersih = labaKotor - totalPengeluaran

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const fmtShort = (v: number) => {
    if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}jt`
    if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(0)}rb`
    return `${v}`
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    return (
      <div className="bg-[#0d1117] border border-white/10 rounded-xl px-4 py-3 shadow-xl text-sm">
        <p className="text-gray-400 mb-2 font-medium">{label}</p>
        {payload.map((p: any, i: number) => (
          <p key={i} style={{ color: p.color }} className="font-semibold">
            {p.name}: {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(p.value)}
          </p>
        ))}
      </div>
    )
  }

  const CustomTooltipQty = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    return (
      <div className="bg-[#0d1117] border border-white/10 rounded-xl px-4 py-3 shadow-xl text-sm">
        <p className="text-gray-400 mb-2 font-medium">{label}</p>
        {payload.map((p: any, i: number) => (
          <p key={i} style={{ color: p.color }} className="font-semibold">{p.name}: {p.value}</p>
        ))}
      </div>
    )
  }

  // ── Chart data: Penjualan per hari ──────────────────────────────────────────
  const dailySalesData = useMemo(() => {
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate()
    const map: Record<number, { omzet: number; tunai: number; transfer: number; piutang: number }> = {}
    for (let d = 1; d <= daysInMonth; d++) map[d] = { omzet: 0, tunai: 0, transfer: 0, piutang: 0 }
    transaksi.forEach(t => {
      const d = new Date(t.tanggal).getDate()
      if (!map[d]) return
      map[d].omzet += t.total
      if (t.jenis_pembayaran === 'Tunai') map[d].tunai += t.total
      else if (t.jenis_pembayaran === 'Transfer') map[d].transfer += t.total
      else if (t.jenis_pembayaran === 'Piutang') map[d].piutang += t.total
    })
    return Object.entries(map).map(([day, v]) => ({ day: Number(day), label: `${day}`, ...v }))
  }, [transaksi, selectedMonth, selectedYear])

  // ── Chart data: Pengeluaran per hari & per kategori ─────────────────────────
  const dailyExpenseData = useMemo(() => {
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate()
    const map: Record<number, number> = {}
    for (let d = 1; d <= daysInMonth; d++) map[d] = 0
    pengeluaran.forEach(p => {
      const d = new Date(p.tanggal).getDate()
      if (map[d] !== undefined) map[d] += p.jumlah
    })
    return Object.entries(map).map(([day, jumlah]) => ({ label: `${day}`, jumlah }))
  }, [pengeluaran, selectedMonth, selectedYear])

  const PIE_COLORS = ['#f97316', '#ef4444', '#f43f5e', '#a855f7', '#3b82f6', '#22c55e']

  const pieData = useMemo(() => {
    const map: Record<string, number> = {}
    pengeluaran.forEach(p => { map[p.kategori] = (map[p.kategori] || 0) + p.jumlah })
    return Object.entries(map).map(([name, value]) => ({ name, value }))
  }, [pengeluaran])

  // ── Chart data: 12 bulan terakhir (Laba tab) ─────────────────────────────────
  const [monthlyTrendData, setMonthlyTrendData] = useState<{ label: string; omzet: number; hpp: number; laba: number }[]>([])

  useEffect(() => {
    const fetchTrend = async () => {
      const results: { label: string; omzet: number; hpp: number; laba: number }[] = []
      const now = new Date()
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const start = new Date(d.getFullYear(), d.getMonth(), 1)
        const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999)
        const [trxRes, hppRes, penRes] = await Promise.all([
          supabase.from('transaksi').select('total').gte('tanggal', start.toISOString()).lte('tanggal', end.toISOString()),
          supabase.from('hpp').select('total_modal').gte('tanggal', start.toISOString().split('T')[0]).lte('tanggal', end.toISOString().split('T')[0]),
          supabase.from('pengeluaran').select('jumlah').gte('tanggal', start.toISOString().split('T')[0]).lte('tanggal', end.toISOString().split('T')[0]),
        ])
        const omzetMonth = (trxRes.data || []).reduce((a: number, t: any) => a + t.total, 0)
        const hppMonth = (hppRes.data || []).reduce((a: number, h: any) => a + h.total_modal, 0)
        const opexMonth = (penRes.data || []).reduce((a: number, p: any) => a + p.jumlah, 0)
        const labaMonth = omzetMonth - hppMonth - opexMonth
        results.push({
          label: `${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear().toString().slice(2)}`,
          omzet: omzetMonth, hpp: hppMonth, laba: labaMonth
        })
      }
      setMonthlyTrendData(results)
    }
    fetchTrend()
  }, [])

  const FilterBar = () => (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2 bg-[#161b22] px-3 py-2 rounded-xl border border-white/10 shadow-sm">
        <Calendar className="w-5 h-5 text-gray-400" />
        <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))}
          className="bg-transparent text-white border-none focus:ring-0 text-sm outline-none cursor-pointer">
          {MONTHS.map((m, i) => <option key={i} value={i} className="bg-[#161b22] text-white">{m}</option>)}
        </select>
      </div>
      <div className="flex items-center gap-2 bg-[#161b22] px-3 py-2 rounded-xl border border-white/10 shadow-sm">
        <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}
          className="bg-transparent text-white border-none focus:ring-0 text-sm outline-none cursor-pointer">
          {years.map(y => <option key={y} value={y} className="bg-[#161b22] text-white">{y}</option>)}
        </select>
      </div>
    </div>
  )

  return (
    <div className="flex flex-col h-full bg-[#0d1117] min-h-screen">
      <header className="sticky top-0 z-10 flex items-center justify-between px-8 py-6 bg-[#0d1117]/80 backdrop-blur border-b border-white/[0.05]">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <TrendingUp className="text-green-500" />
            Laporan
          </h2>
          <p className="text-sm text-gray-400 mt-1">Ringkasan penjualan, pengeluaran, dan laba bersih</p>
        </div>
        <FilterBar />
      </header>

      <main className="flex-1 p-8 overflow-y-auto space-y-6">
        {/* Tabs */}
        <div className="flex gap-2 border-b border-white/[0.05]">
          {[
            { key: 'penjualan', label: '📈 Penjualan' },
            { key: 'pengeluaran', label: '💸 Pengeluaran' },
            { key: 'laba', label: '💰 Laba Bersih' },
          ].map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key as Tab)}
              className={`px-5 py-3 text-sm font-semibold rounded-t-xl transition-colors ${activeTab === tab.key ? 'bg-[#161b22] text-white border border-b-0 border-white/10' : 'text-gray-500 hover:text-gray-300'}`}>
              {tab.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center p-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
          </div>
        ) : (
          <>
            {/* ===== TAB PENJUALAN ===== */}
            {activeTab === 'penjualan' && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="bg-[#161b22] border border-white/[0.05] rounded-2xl p-6 relative overflow-hidden group">
                    <div className="absolute -right-4 -bottom-4 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity">
                      <DollarSign className="w-32 h-32" />
                    </div>
                    <div className="flex items-center gap-4 mb-4">
                      <div className="p-3 bg-green-500/10 rounded-xl border border-green-500/20">
                        <DollarSign className="w-6 h-6 text-green-500" />
                      </div>
                      <div>
                        <h3 className="text-gray-400 text-sm font-medium">Total Penjualan</h3>
                        <p className="text-white text-2xl font-bold tracking-tight mt-0.5">{formatRp(omzet.total)}</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-[#161b22] border border-white/[0.05] rounded-2xl p-6 relative overflow-hidden group">
                    <div className="absolute -right-4 -bottom-4 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity">
                      <Banknote className="w-32 h-32" />
                    </div>
                    <div className="flex items-center gap-4 mb-4">
                      <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20">
                        <Banknote className="w-6 h-6 text-blue-500" />
                      </div>
                      <div>
                        <h3 className="text-gray-400 text-sm font-medium">Tunai (Cash)</h3>
                        <p className="text-white text-xl font-bold tracking-tight mt-0.5">{formatRp(omzet.tunai)}</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-[#161b22] border border-white/[0.05] rounded-2xl p-6 relative overflow-hidden group">
                    <div className="absolute -right-4 -bottom-4 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity">
                      <CreditCard className="w-32 h-32" />
                    </div>
                    <div className="flex items-center gap-4 mb-4">
                      <div className="p-3 bg-purple-500/10 rounded-xl border border-purple-500/20">
                        <CreditCard className="w-6 h-6 text-purple-500" />
                      </div>
                      <div>
                        <h3 className="text-gray-400 text-sm font-medium">Transfer Bank / QRIS</h3>
                        <p className="text-white text-xl font-bold tracking-tight mt-0.5">{formatRp(omzet.transfer)}</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-[#161b22] border border-white/[0.05] rounded-2xl p-6 relative overflow-hidden group">
                    <div className="absolute -right-4 -bottom-4 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity">
                      <Wallet className="w-32 h-32" />
                    </div>
                    <div className="flex items-center gap-4 mb-4">
                      <div className="p-3 bg-orange-500/10 rounded-xl border border-orange-500/20">
                        <Wallet className="w-6 h-6 text-orange-500" />
                      </div>
                      <div>
                        <h3 className="text-gray-400 text-sm font-medium">Piutang (Kredit)</h3>
                        <p className="text-white text-xl font-bold tracking-tight mt-0.5">{formatRp(omzet.piutang)}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Charts Penjualan ── */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {/* Line chart: Omzet per hari */}
                  <div className="bg-[#161b22] border border-white/[0.05] rounded-2xl p-5">
                    <h4 className="text-sm font-bold text-white mb-4">📈 Omzet per Hari</h4>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={dailySalesData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                        <XAxis dataKey="label" tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false} axisLine={false} interval={4} />
                        <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={fmtShort} width={40} />
                        <Tooltip content={<CustomTooltip />} />
                        <Line type="monotone" dataKey="omzet" name="Omzet" stroke="#22c55e" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#22c55e' }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Bar chart: Tunai vs Transfer vs Piutang */}
                  <div className="bg-[#161b22] border border-white/[0.05] rounded-2xl p-5">
                    <h4 className="text-sm font-bold text-white mb-4">💳 Tunai vs Transfer vs Piutang per Hari</h4>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={dailySalesData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }} barCategoryGap="30%">
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                        <XAxis dataKey="label" tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false} axisLine={false} interval={4} />
                        <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={fmtShort} width={40} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
                        <Bar dataKey="tunai" name="Tunai" fill="#22c55e" radius={[3,3,0,0]} />
                        <Bar dataKey="transfer" name="Transfer" fill="#3b82f6" radius={[3,3,0,0]} />
                        <Bar dataKey="piutang" name="Piutang" fill="#f43f5e" radius={[3,3,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-[#161b22] border border-white/[0.05] rounded-2xl p-6 flex flex-col">
                    <div className="flex items-center gap-3 mb-6">
                      <Package className="w-5 h-5 text-gray-300" />
                      <h3 className="text-lg font-bold text-white">Produk Terlaris</h3>
                    </div>
                    {topProducts.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-48 text-gray-500">
                        <Package className="w-10 h-10 mb-2 opacity-20" />
                        <p className="text-sm">Belum ada data produk terjual</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {topProducts.map((p, i) => (
                          <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-[#0d1117] border border-white/5 hover:border-white/10 transition-colors">
                            <div className="flex items-center gap-4">
                              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-white/5 text-gray-400 font-bold text-sm">{i + 1}</span>
                              <span className="text-white font-medium">{p.nama}</span>
                            </div>
                            <div className="flex items-baseline gap-1">
                              <span className="text-green-400 font-bold text-lg">{p.qty}</span>
                              <span className="text-gray-500 text-sm">terjual</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="bg-[#161b22] border border-white/[0.05] rounded-2xl p-6 flex flex-col">
                    <div className="flex items-center gap-3 mb-6">
                      <Users className="w-5 h-5 text-gray-300" />
                      <h3 className="text-lg font-bold text-white">Top Pelanggan</h3>
                    </div>
                    {topCustomers.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-48 text-gray-500">
                        <Users className="w-10 h-10 mb-2 opacity-20" />
                        <p className="text-sm">Belum ada data pelanggan transaksi</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {topCustomers.map((c, i) => (
                          <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-[#0d1117] border border-white/5 hover:border-white/10 transition-colors">
                            <div className="flex items-center gap-4">
                              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-white/5 text-gray-400 font-bold text-sm">{i + 1}</span>
                              <span className="text-white font-medium truncate max-w-[200px]">{c.nama}</span>
                            </div>
                            <span className="text-green-400 font-bold">{formatRp(c.total)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* ===== TAB PENGELUARAN ===== */}
            {activeTab === 'pengeluaran' && (
              <div className="space-y-6">
                {/* Summary cards */}
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-5">
                  <div className="col-span-2 lg:col-span-1 bg-[#161b22] border border-white/[0.06] rounded-2xl p-5">
                    <p className="text-gray-400 text-sm mb-1">Total Pengeluaran {MONTHS[selectedMonth]}</p>
                    <p className="text-3xl font-bold text-red-400">{formatRp(totalPengeluaran)}</p>
                    <p className="text-xs text-gray-500 mt-1">{pengeluaran.length} transaksi</p>
                  </div>
                  {breakdownKategori.map(([kat, jumlah]) => (
                    <div key={kat} className="bg-[#161b22] border border-white/[0.06] rounded-2xl p-5">
                      <p className="text-gray-400 text-xs mb-1 truncate">{kat}</p>
                      <p className="text-xl font-bold text-orange-400">{formatRp(jumlah)}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {totalPengeluaran > 0 ? Math.round((jumlah / totalPengeluaran) * 100) : 0}% dari total
                      </p>
                    </div>
                  ))}
                </div>

                {/* ── Charts Pengeluaran ── */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {/* Donut: per kategori */}
                  <div className="bg-[#161b22] border border-white/[0.05] rounded-2xl p-5">
                    <h4 className="text-sm font-bold text-white mb-4">🍩 Breakdown Kategori</h4>
                    {pieData.length === 0 ? (
                      <div className="flex items-center justify-center h-[200px] text-gray-500 text-sm">Tidak ada data</div>
                    ) : (
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value" nameKey="name">
                            {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                          </Pie>
                          <Tooltip
                            content={({ active, payload }) => {
                              if (!active || !payload?.length) return null
                              const p = payload[0]
                              const pct = totalPengeluaran > 0 ? ((p.value as number / totalPengeluaran) * 100).toFixed(1) : '0'
                              return (
                                <div className="bg-[#0d1117] border border-white/10 rounded-xl px-4 py-3 shadow-xl text-sm">
                                  <p style={{ color: p.payload.fill }} className="font-bold">{p.name}</p>
                                  <p className="text-gray-300">{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(p.value as number)}</p>
                                  <p className="text-gray-500">{pct}% dari total</p>
                                </div>
                              )
                            }}
                          />
                          <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>

                  {/* Bar: Pengeluaran per hari */}
                  <div className="bg-[#161b22] border border-white/[0.05] rounded-2xl p-5">
                    <h4 className="text-sm font-bold text-white mb-4">📅 Pengeluaran per Hari</h4>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={dailyExpenseData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                        <XAxis dataKey="label" tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false} axisLine={false} interval={4} />
                        <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={fmtShort} width={40} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="jumlah" name="Pengeluaran" fill="#f97316" radius={[3,3,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Tabel */}
                <div className="bg-[#161b22] border border-white/[0.05] rounded-2xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-white/[0.05]">
                    <h3 className="font-bold text-white">Riwayat Pengeluaran — {MONTHS[selectedMonth]} {selectedYear}</h3>
                  </div>
                  {pengeluaran.length === 0 ? (
                    <div className="p-12 text-center text-gray-500">
                      <span className="text-4xl block mb-3 opacity-40">💸</span>
                      Tidak ada pengeluaran bulan ini
                    </div>
                  ) : (
                    <table className="w-full text-sm text-gray-300">
                      <thead className="text-xs text-gray-400 uppercase bg-[#0d1117]/80 border-b border-white/[0.05]">
                        <tr>
                          <th className="px-5 py-3 text-left">Tanggal</th>
                          <th className="px-5 py-3 text-left">Kategori</th>
                          <th className="px-5 py-3 text-left">Keterangan</th>
                          <th className="px-5 py-3 text-right">Jumlah</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.02]">
                        {pengeluaran.map(p => (
                          <tr key={p.id} className="hover:bg-white/[0.01]">
                            <td className="px-5 py-3 text-gray-400 whitespace-nowrap">
                              {new Date(p.tanggal).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                            </td>
                            <td className="px-5 py-3">
                              <span className="bg-white/5 text-gray-300 text-xs px-2.5 py-1 rounded-full border border-white/10">{p.kategori}</span>
                            </td>
                            <td className="px-5 py-3 text-gray-400">{p.keterangan || p.sub_kategori || "-"}</td>
                            <td className="px-5 py-3 text-right font-semibold text-red-400">{formatRp(p.jumlah)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="border-t border-white/10 bg-[#0d1117]/60">
                        <tr>
                          <td colSpan={3} className="px-5 py-3 text-gray-400 font-semibold">Total</td>
                          <td className="px-5 py-3 text-right font-bold text-red-400 text-base">{formatRp(totalPengeluaran)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  )}
                </div>
              </div>
            )}

            {/* ===== TAB LABA BERSIH ===== */}
            {activeTab === 'laba' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {/* Komponen kiri */}
                  <div className="space-y-4">
                    <div className="bg-[#161b22] border border-green-500/20 rounded-2xl p-6">
                      <p className="text-gray-400 text-sm mb-1">Omzet Penjualan</p>
                      <p className="text-3xl font-bold text-green-400">{formatRp(omzet.total)}</p>
                      <p className="text-xs text-gray-500 mt-1">{transaksi.length} transaksi</p>
                    </div>
                    <div className="bg-[#161b22] border border-red-500/20 rounded-2xl p-6 space-y-3">
                      <div>
                        <p className="text-gray-400 text-sm mb-1">HPP / COGS</p>
                        <p className="text-3xl font-bold text-red-400">- {formatRp(cogsData.cogs)}</p>
                        <p className="text-xs text-gray-500 mt-1">Stok Awal + Pembelian − Stok Akhir</p>
                      </div>
                      <div className="border-t border-white/5 pt-3 space-y-1 text-xs">
                        <div className="flex justify-between text-gray-500">
                          <span>+ Nilai Stok Awal</span>
                          <span className="text-gray-300">{formatRp(cogsData.totalNilaiStokAwal)}</span>
                        </div>
                        <div className="flex justify-between text-gray-500">
                          <span>+ Pembelian Bulan</span>
                          <span className="text-gray-300">{formatRp(cogsData.pembelianBulan)}</span>
                        </div>
                        <div className="flex justify-between text-gray-500">
                          <span>− Nilai Stok Akhir</span>
                          <span className="text-gray-300">{formatRp(cogsData.totalNilaiStokAkhir)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="bg-[#161b22] border border-blue-500/20 rounded-2xl p-6">
                      <p className="text-gray-400 text-sm mb-1">Laba Kotor</p>
                      <p className={`text-3xl font-bold ${labaKotor >= 0 ? 'text-blue-400' : 'text-red-400'}`}>{formatRp(labaKotor)}</p>
                      <p className="text-xs text-gray-500 mt-1">Omzet − HPP</p>
                    </div>
                    <div className="bg-[#161b22] border border-orange-500/20 rounded-2xl p-6">
                      <p className="text-gray-400 text-sm mb-1">Total Pengeluaran Operasional</p>
                      <p className="text-3xl font-bold text-orange-400">- {formatRp(totalPengeluaran)}</p>
                      <p className="text-xs text-gray-500 mt-1">{pengeluaran.length} pos pengeluaran</p>
                    </div>
                  </div>

                  {/* Laba bersih kanan */}
                  <div className="flex flex-col gap-4">
                    <div className={`flex-1 rounded-2xl p-8 flex flex-col justify-center items-center text-center border-2 ${labaBersih >= 0 ? 'bg-green-500/5 border-green-500/30' : 'bg-red-500/5 border-red-500/30'}`}>
                      <p className="text-gray-400 text-base mb-3">💰 Laba Bersih</p>
                      <p className="text-gray-400 text-sm mb-2">{MONTHS[selectedMonth]} {selectedYear}</p>
                      <p className={`text-5xl font-bold mb-4 ${labaBersih >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {formatRp(labaBersih)}
                      </p>
                      <p className="text-xs text-gray-500">Laba Kotor − Pengeluaran OpEx</p>
                      {omzet.total > 0 && (
                        <div className="mt-4 bg-white/5 rounded-xl px-4 py-2">
                          <p className="text-xs text-gray-400">Margin Bersih</p>
                          <p className={`text-xl font-bold ${labaBersih >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {((labaBersih / omzet.total) * 100).toFixed(1)}%
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="bg-[#161b22] border border-white/[0.06] rounded-2xl p-4">
                      <p className="text-xs text-gray-500 flex items-start gap-2">
                        <span className="text-yellow-500 mt-0.5">ℹ️</span>
                        <span>CapEx (pembelian aset) tidak dihitung sebagai pengeluaran operasional dalam kalkulasi laba bersih ini.</span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* ── Chart Laba: 12 bulan terakhir ── */}
                <div className="bg-[#161b22] border border-white/[0.05] rounded-2xl p-5">
                  <h4 className="text-sm font-bold text-white mb-1">📊 Tren 12 Bulan Terakhir</h4>
                  <p className="text-xs text-gray-500 mb-4">Omzet, HPP, dan Laba Bersih — tidak terpengaruh filter bulan</p>
                  {monthlyTrendData.length === 0 ? (
                    <div className="flex items-center justify-center h-[220px]">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500" />
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={monthlyTrendData} margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                        <XAxis dataKey="label" tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false} axisLine={false} />
                        <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={fmtShort} width={44} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
                        <Line type="monotone" dataKey="omzet" name="Omzet" stroke="#22c55e" strokeWidth={2} dot={{ r: 3, fill: '#22c55e' }} activeDot={{ r: 5 }} />
                        <Line type="monotone" dataKey="hpp" name="HPP" stroke="#ef4444" strokeWidth={2} dot={{ r: 3, fill: '#ef4444' }} activeDot={{ r: 5 }} />
                        <Line type="monotone" dataKey="laba" name="Laba Bersih" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 3, fill: '#3b82f6' }} activeDot={{ r: 5 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>

                {/* Ringkasan tabel */}
                <div className="bg-[#161b22] border border-white/[0.05] rounded-2xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-white/[0.05]">
                    <h3 className="font-bold text-white">Ringkasan Kalkulasi</h3>
                  </div>
                  <table className="w-full text-sm text-gray-300">
                    <tbody className="divide-y divide-white/[0.02]">
                      {[
                        { label: "Omzet Penjualan", value: omzet.total, color: "text-green-400", sign: "" },
                        { label: "HPP / COGS (Stok Awal + Beli − Stok Akhir)", value: cogsData.cogs, color: "text-red-400", sign: "- " },
                        { label: "Laba Kotor", value: labaKotor, color: labaKotor >= 0 ? "text-blue-400" : "text-red-400", sign: "", bold: true },
                        { label: "Pengeluaran Operasional (OpEx)", value: totalPengeluaran, color: "text-orange-400", sign: "- " },
                        { label: "Laba Bersih", value: labaBersih, color: labaBersih >= 0 ? "text-green-400" : "text-red-400", sign: "", bold: true },
                      ].map((row, i) => (
                        <tr key={i} className={`hover:bg-white/[0.01] ${row.bold ? 'bg-white/[0.02]' : ''}`}>
                          <td className={`px-6 py-4 ${row.bold ? 'font-bold text-white' : 'text-gray-400'}`}>{row.label}</td>
                          <td className={`px-6 py-4 text-right font-${row.bold ? 'bold text-lg' : 'semibold'} ${row.color}`}>
                            {row.sign}{formatRp(Math.abs(row.value))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}