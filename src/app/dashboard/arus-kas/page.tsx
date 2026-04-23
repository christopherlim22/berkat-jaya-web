"use client"

import { useState, useEffect, useMemo } from "react"
import { supabase } from "@/utils/supabase/client"
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts"

const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
]

type KasMasukItem = {
  tanggal: string
  keterangan: string
  kategori: "Tunai" | "Transfer" | "Bayar Piutang"
  jumlah: number
}

type KasKeluarItem = {
  tanggal: string
  keterangan: string
  kategori: string
  jumlah: number
}

const formatRp = (num: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(num)

const formatRpShort = (num: number) => {
  const abs = Math.abs(num)
  if (abs >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}jt`
  if (abs >= 1_000) return `${(num / 1_000).toFixed(0)}rb`
  return String(num)
}

const BarTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#161b22] border border-white/10 rounded-xl p-3 text-sm shadow-xl">
      <p className="text-gray-400 mb-2 text-xs">Tanggal {label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }} className="font-medium">{p.name}: {formatRp(p.value)}</p>
      ))}
    </div>
  )
}

const LineTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  const val = payload[0]?.value ?? 0
  return (
    <div className="bg-[#161b22] border border-white/10 rounded-xl p-3 text-sm shadow-xl">
      <p className="text-gray-400 mb-1 text-xs">Tanggal {label}</p>
      <p className={`font-bold ${val >= 0 ? "text-blue-400" : "text-red-400"}`}>Saldo: {formatRp(val)}</p>
    </div>
  )
}

export default function ArusKasPage() {
  const today = new Date()
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth())
  const [selectedYear, setSelectedYear] = useState(today.getFullYear())
  const [isLoading, setIsLoading] = useState(true)
  const [kasMasukList, setKasMasukList] = useState<KasMasukItem[]>([])
  const [kasKeluarList, setKasKeluarList] = useState<KasKeluarItem[]>([])

  const years = Array.from({ length: 5 }, (_, i) => today.getFullYear() - i)

  const fetchData = async () => {
    setIsLoading(true)
    try {
      const mm = String(selectedMonth + 1).padStart(2, "0")
      const lastDay = new Date(selectedYear, selectedMonth + 1, 0).getDate()
      const startStr = `${selectedYear}-${mm}-01`
      const endStr = `${selectedYear}-${mm}-${String(lastDay).padStart(2, "0")}`
      const startDate = new Date(selectedYear, selectedMonth, 1)
      const endDate = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59, 999)

      const [trxRes, piutangRes, pengeluaranRes, utangRes] = await Promise.all([
        supabase
          .from("transaksi")
          .select("tanggal, jenis_pembayaran, total, no_nota, nama_pembeli")
          .in("jenis_pembayaran", ["Tunai", "Transfer"])
          .gte("tanggal", startDate.toISOString())
          .lte("tanggal", endDate.toISOString())
          .order("tanggal", { ascending: true }),
        supabase
          .from("piutang")
          .select("tanggal_lunas, terbayar, nama_pembeli, no_nota")
          .eq("status", "lunas")
          .gte("tanggal_lunas", startStr)
          .lte("tanggal_lunas", endStr),
        supabase
          .from("pengeluaran")
          .select("*")
          .gte("tanggal", startStr)
          .lte("tanggal", endStr)
          .order("tanggal", { ascending: true }),
        supabase
          .from("utang_supplier")
          .select("tanggal_lunas, terbayar, nama_supplier")
          .eq("status", "lunas")
          .gte("tanggal_lunas", startStr)
          .lte("tanggal_lunas", endStr),
      ])

      // Build kas masuk
      const masuk: KasMasukItem[] = []
      if (trxRes.data) {
        trxRes.data.forEach((tx: any) => {
          masuk.push({
            tanggal: tx.tanggal.split("T")[0],
            keterangan: `${tx.nama_pembeli} – ${tx.no_nota}`,
            kategori: tx.jenis_pembayaran as "Tunai" | "Transfer",
            jumlah: tx.total,
          })
        })
      }
      if (piutangRes.data) {
        piutangRes.data.forEach((p: any) => {
          if ((p.terbayar ?? 0) > 0) {
            masuk.push({
              tanggal: p.tanggal_lunas,
              keterangan: `Bayar piutang – ${p.nama_pembeli} (${p.no_nota})`,
              kategori: "Bayar Piutang",
              jumlah: p.terbayar,
            })
          }
        })
      }
      masuk.sort((a, b) => a.tanggal.localeCompare(b.tanggal))
      setKasMasukList(masuk)

      // Build kas keluar
      const keluar: KasKeluarItem[] = []
      if (pengeluaranRes.data) {
        pengeluaranRes.data.forEach((p: any) => {
          keluar.push({
            tanggal: p.tanggal,
            keterangan: p.keterangan || p.sub_kategori || p.kategori,
            kategori: p.kategori,
            jumlah: p.jumlah,
          })
        })
      }
      if (utangRes.data) {
        utangRes.data.forEach((u: any) => {
          if ((u.terbayar ?? 0) > 0) {
            keluar.push({
              tanggal: u.tanggal_lunas,
              keterangan: `Bayar utang – ${u.nama_supplier}`,
              kategori: "Bayar Utang",
              jumlah: u.terbayar,
            })
          }
        })
      }
      keluar.sort((a, b) => a.tanggal.localeCompare(b.tanggal))
      setKasKeluarList(keluar)
    } catch (err) {
      console.error("Arus kas fetch error:", err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [selectedMonth, selectedYear])

  const totalMasuk = useMemo(() => kasMasukList.reduce((acc, k) => acc + k.jumlah, 0), [kasMasukList])
  const totalKeluar = useMemo(() => kasKeluarList.reduce((acc, k) => acc + k.jumlah, 0), [kasKeluarList])
  const arusKasBersih = totalMasuk - totalKeluar

  const chartData = useMemo(() => {
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate()
    const mm = String(selectedMonth + 1).padStart(2, "0")
    return Array.from({ length: daysInMonth }, (_, i) => {
      const d = i + 1
      const dateStr = `${selectedYear}-${mm}-${String(d).padStart(2, "0")}`
      const masuk = kasMasukList.filter(k => k.tanggal === dateStr).reduce((a, k) => a + k.jumlah, 0)
      const keluar = kasKeluarList.filter(k => k.tanggal === dateStr).reduce((a, k) => a + k.jumlah, 0)
      return { date: String(d), masuk, keluar }
    })
  }, [kasMasukList, kasKeluarList, selectedMonth, selectedYear])

  const saldoData = useMemo(() => {
    let cum = 0
    return chartData.map(d => {
      cum += d.masuk - d.keluar
      return { date: d.date, saldo: cum }
    })
  }, [chartData])

  const formatDate = (str: string) =>
    new Date(str + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })

  const badgeMasuk = (kat: string) => {
    if (kat === "Tunai") return "bg-green-500/10 text-green-400 border-green-500/20"
    if (kat === "Transfer") return "bg-blue-500/10 text-blue-400 border-blue-500/20"
    return "bg-teal-500/10 text-teal-400 border-teal-500/20"
  }

  const badgeKeluar = (kat: string) => {
    if (kat === "Bayar Utang") return "bg-red-500/10 text-red-400 border-red-500/20"
    return "bg-orange-500/10 text-orange-400 border-orange-500/20"
  }

  return (
    <>
      <header className="flex items-center justify-between px-8 py-6 bg-[#0d1117] border-b border-white/[0.05]">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight">Arus Kas</h2>
          <p className="text-base text-gray-500 mt-1">Monitor kas masuk dan kas keluar bisnis</p>
        </div>
        <div className="flex items-center gap-3">
          <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))}
            className="h-10 bg-[#161b22] border border-white/10 text-white text-sm rounded-xl px-4 focus:outline-none focus:border-green-500/50 cursor-pointer">
            {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
          <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}
            className="h-10 bg-[#161b22] border border-white/10 text-white text-sm rounded-xl px-4 focus:outline-none focus:border-green-500/50 cursor-pointer">
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={fetchData}
            className="h-10 bg-white/5 hover:bg-white/10 text-white px-4 rounded-xl text-sm font-medium border border-white/5 transition-colors flex items-center gap-2">
            🔄 Refresh
          </button>
        </div>
      </header>

      <main className="p-8 space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-center p-24">
            <div className="w-10 h-10 border-4 border-green-500/30 border-t-green-500 rounded-full animate-spin"></div>
          </div>
        ) : (
          <>
            {/* SUMMARY CARDS */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
              <div className="bg-[#161b22] border border-white/[0.05] rounded-2xl p-5 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-green-500/10 rounded-full blur-3xl -mr-6 -mt-6" />
                <div className="relative z-10">
                  <p className="text-gray-400 text-sm mb-1">Total Kas Masuk</p>
                  <h3 className="text-2xl font-bold text-green-400">{formatRp(totalMasuk)}</h3>
                  <p className="text-xs text-gray-500 mt-1">{kasMasukList.length} transaksi</p>
                </div>
              </div>
              <div className="bg-[#161b22] border border-white/[0.05] rounded-2xl p-5 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/10 rounded-full blur-3xl -mr-6 -mt-6" />
                <div className="relative z-10">
                  <p className="text-gray-400 text-sm mb-1">Total Kas Keluar</p>
                  <h3 className="text-2xl font-bold text-red-400">{formatRp(totalKeluar)}</h3>
                  <p className="text-xs text-gray-500 mt-1">{kasKeluarList.length} transaksi</p>
                </div>
              </div>
              <div className="bg-[#161b22] border border-white/[0.05] rounded-2xl p-5 relative overflow-hidden">
                <div className={`absolute top-0 right-0 w-24 h-24 rounded-full blur-3xl -mr-6 -mt-6 ${arusKasBersih >= 0 ? "bg-green-500/10" : "bg-red-500/10"}`} />
                <div className="relative z-10">
                  <p className="text-gray-400 text-sm mb-1">Arus Kas Bersih</p>
                  <h3 className={`text-2xl font-bold ${arusKasBersih >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {arusKasBersih >= 0 ? "+" : ""}{formatRp(arusKasBersih)}
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">Masuk − Keluar</p>
                </div>
              </div>
              <div className="bg-[#161b22] border border-white/[0.05] rounded-2xl p-5 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-3xl -mr-6 -mt-6" />
                <div className="relative z-10">
                  <p className="text-gray-400 text-sm mb-1">Saldo Akhir Bulan</p>
                  <h3 className="text-2xl font-bold text-blue-400">{formatRp(arusKasBersih)}</h3>
                  <p className="text-xs text-gray-500 mt-1">{MONTHS[selectedMonth]} {selectedYear}</p>
                </div>
              </div>
            </div>

            {/* BAR CHART */}
            <div className="bg-[#161b22] border border-white/[0.05] rounded-2xl p-6">
              <h3 className="text-white font-bold mb-0.5">Kas Masuk vs Kas Keluar per Hari</h3>
              <p className="text-xs text-gray-500 mb-5">{MONTHS[selectedMonth]} {selectedYear}</p>
              <div style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis dataKey="date" tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} interval={1} />
                    <YAxis tickFormatter={formatRpShort} tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} width={58} />
                    <Tooltip content={<BarTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                    <Legend formatter={(v) => <span style={{ color: "#9ca3af", fontSize: 12 }}>{v}</span>} />
                    <Bar dataKey="masuk" name="Kas Masuk" fill="#22c55e" radius={[3, 3, 0, 0]} maxBarSize={18} />
                    <Bar dataKey="keluar" name="Kas Keluar" fill="#ef4444" radius={[3, 3, 0, 0]} maxBarSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* DETAIL TABLES */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Kas Masuk */}
              <div className="bg-[#161b22] border border-white/[0.05] rounded-2xl overflow-hidden shadow-xl">
                <div className="px-5 py-4 border-b border-white/[0.05] flex items-center justify-between bg-[#0d1117]/50">
                  <div>
                    <h3 className="text-white font-bold flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
                      Kas Masuk
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">{kasMasukList.length} transaksi</p>
                  </div>
                  <span className="text-green-400 font-bold text-sm">{formatRp(totalMasuk)}</span>
                </div>
                <div className="overflow-x-auto" style={{ maxHeight: 400, overflowY: "auto" }}>
                  {kasMasukList.length === 0 ? (
                    <div className="p-12 text-center text-gray-500 flex flex-col items-center">
                      <span className="text-4xl mb-3 opacity-30">💰</span>
                      <p>Tidak ada kas masuk bulan ini</p>
                    </div>
                  ) : (
                    <table className="w-full text-sm text-gray-300">
                      <thead className="text-xs text-gray-400 uppercase bg-[#0d1117]/80 border-b border-white/[0.05] sticky top-0">
                        <tr>
                          <th className="px-4 py-3 text-left font-medium">Tanggal</th>
                          <th className="px-4 py-3 text-left font-medium">Keterangan</th>
                          <th className="px-4 py-3 text-center font-medium">Kategori</th>
                          <th className="px-4 py-3 text-right font-medium">Jumlah</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.02]">
                        {kasMasukList.map((k, i) => (
                          <tr key={i} className="hover:bg-white/[0.01] transition-colors">
                            <td className="px-4 py-3 text-gray-400 whitespace-nowrap text-xs">{formatDate(k.tanggal)}</td>
                            <td className="px-4 py-3 text-gray-300 max-w-[150px] truncate text-xs" title={k.keterangan}>{k.keterangan}</td>
                            <td className="px-4 py-3 text-center">
                              <span className={`px-2 py-0.5 text-[11px] font-semibold rounded-full border ${badgeMasuk(k.kategori)}`}>
                                {k.kategori}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-green-400">{formatRp(k.jumlah)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="border-t border-white/10 bg-[#0d1117]/60">
                        <tr>
                          <td colSpan={3} className="px-4 py-3 font-bold text-gray-400 text-sm">Total Kas Masuk</td>
                          <td className="px-4 py-3 text-right font-bold text-green-400">{formatRp(totalMasuk)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  )}
                </div>
              </div>

              {/* Kas Keluar */}
              <div className="bg-[#161b22] border border-white/[0.05] rounded-2xl overflow-hidden shadow-xl">
                <div className="px-5 py-4 border-b border-white/[0.05] flex items-center justify-between bg-[#0d1117]/50">
                  <div>
                    <h3 className="text-white font-bold flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
                      Kas Keluar
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">{kasKeluarList.length} transaksi</p>
                  </div>
                  <span className="text-red-400 font-bold text-sm">{formatRp(totalKeluar)}</span>
                </div>
                <div className="overflow-x-auto" style={{ maxHeight: 400, overflowY: "auto" }}>
                  {kasKeluarList.length === 0 ? (
                    <div className="p-12 text-center text-gray-500 flex flex-col items-center">
                      <span className="text-4xl mb-3 opacity-30">💸</span>
                      <p>Tidak ada kas keluar bulan ini</p>
                    </div>
                  ) : (
                    <table className="w-full text-sm text-gray-300">
                      <thead className="text-xs text-gray-400 uppercase bg-[#0d1117]/80 border-b border-white/[0.05] sticky top-0">
                        <tr>
                          <th className="px-4 py-3 text-left font-medium">Tanggal</th>
                          <th className="px-4 py-3 text-left font-medium">Keterangan</th>
                          <th className="px-4 py-3 text-center font-medium">Kategori</th>
                          <th className="px-4 py-3 text-right font-medium">Jumlah</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.02]">
                        {kasKeluarList.map((k, i) => (
                          <tr key={i} className="hover:bg-white/[0.01] transition-colors">
                            <td className="px-4 py-3 text-gray-400 whitespace-nowrap text-xs">{formatDate(k.tanggal)}</td>
                            <td className="px-4 py-3 text-gray-300 max-w-[150px] truncate text-xs" title={k.keterangan}>{k.keterangan}</td>
                            <td className="px-4 py-3 text-center">
                              <span className={`px-2 py-0.5 text-[11px] font-semibold rounded-full border ${badgeKeluar(k.kategori)}`}>
                                {k.kategori}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-red-400">{formatRp(k.jumlah)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="border-t border-white/10 bg-[#0d1117]/60">
                        <tr>
                          <td colSpan={3} className="px-4 py-3 font-bold text-gray-400 text-sm">Total Kas Keluar</td>
                          <td className="px-4 py-3 text-right font-bold text-red-400">{formatRp(totalKeluar)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  )}
                </div>
              </div>
            </div>

            {/* LINE CHART — TREN SALDO */}
            <div className="bg-[#161b22] border border-white/[0.05] rounded-2xl p-6">
              <h3 className="text-white font-bold mb-0.5">Tren Saldo Kas Harian</h3>
              <p className="text-xs text-gray-500 mb-5">Akumulasi saldo kas sepanjang {MONTHS[selectedMonth]} {selectedYear} (mulai dari 0)</p>
              <div style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={saldoData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis dataKey="date" tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} interval={1} />
                    <YAxis tickFormatter={formatRpShort} tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} width={58} />
                    <Tooltip content={<LineTooltip />} cursor={{ stroke: "rgba(255,255,255,0.1)" }} />
                    <Line
                      type="monotone"
                      dataKey="saldo"
                      name="Saldo Kas"
                      stroke="#3b82f6"
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 4, fill: "#3b82f6", strokeWidth: 0 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        )}
      </main>
    </>
  )
}