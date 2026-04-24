"use client"

import { useState, useEffect, useMemo } from "react"
import { supabase } from "@/utils/supabase/client"

type Pengeluaran = {
  id: number; tanggal: string; kategori: string; sub_kategori: string
  keterangan: string; jumlah: number; created_at: string
}
type PengeluaranCapex = {
  id: number; tanggal: string; nama_aset: string; kategori: string
  keterangan: string; jumlah: number; created_at: string
}

const KATEGORI_OPEX = [
  "Gaji", "Logistik & Transport", "Utilitas", "Pemasaran",
  "Perlengkapan & Admin", "Pemeliharaan", "Sewa", "Penyusutan", "Prive", "Lain-lain"
]
const KATEGORI_CAPEX = ["Peralatan Elektronik", "Kendaraan", "Renovasi"]

const today = new Date().toISOString().split('T')[0]
const thisMonth = new Date().getMonth() + 1
const thisYear = new Date().getFullYear()

const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
]

const EMPTY_OPEX_FORM = { tanggal: today, kategori: "", sub_kategori: "", keterangan: "", jumlah: "" }
const EMPTY_CAPEX_FORM = { tanggal: today, nama_aset: "", kategori: "", keterangan: "", jumlah: "" }

export default function PengeluaranPage() {
  const [activeTab, setActiveTab] = useState<'opex' | 'capex'>('opex')
  const [isLoading, setIsLoading] = useState(true)

  // OpEx state
  const [opexList, setOpexList] = useState<Pengeluaran[]>([])
  const [opexFilter, setOpexFilter] = useState({ bulan: thisMonth, tahun: thisYear })
  const [opexForm, setOpexForm] = useState(EMPTY_OPEX_FORM)
  const [opexEditId, setOpexEditId] = useState<number | null>(null)
  const [isOpexSubmitting, setIsOpexSubmitting] = useState(false)

  // CapEx state
  const [capexList, setCapexList] = useState<PengeluaranCapex[]>([])
  const [capexForm, setCapexForm] = useState(EMPTY_CAPEX_FORM)
  const [capexEditId, setCapexEditId] = useState<number | null>(null)
  const [isCapexSubmitting, setIsCapexSubmitting] = useState(false)

  const formatRp = (n: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n)
  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    setIsLoading(true)
    try {
      const [opex, capex] = await Promise.all([
        supabase.from('pengeluaran').select('*').order('tanggal', { ascending: false }),
        supabase.from('pengeluaran_capex').select('*').order('tanggal', { ascending: false })
      ])
      if (opex.data) setOpexList(opex.data)
      if (capex.data) setCapexList(capex.data)
    } catch (e) { console.error(e) }
    finally { setIsLoading(false) }
  }

  // Filtered OpEx by month/year
  const filteredOpex = useMemo(() => opexList.filter(o => {
    const d = new Date(o.tanggal)
    return d.getMonth() + 1 === opexFilter.bulan && d.getFullYear() === opexFilter.tahun
  }), [opexList, opexFilter])

  const totalOpex = useMemo(() => filteredOpex.reduce((acc, o) => acc + o.jumlah, 0), [filteredOpex])

  const breakdownKategori = useMemo(() => {
    const map: Record<string, number> = {}
    filteredOpex.forEach(o => { map[o.kategori] = (map[o.kategori] || 0) + o.jumlah })
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }, [filteredOpex])

  const totalCapex = useMemo(() => capexList.reduce((acc, c) => acc + c.jumlah, 0), [capexList])

  // --- OpEx handlers ---

  const handleEditOpex = (o: Pengeluaran) => {
    setOpexEditId(o.id)
    setOpexForm({
      tanggal: o.tanggal,
      kategori: o.kategori,
      sub_kategori: o.sub_kategori || "",
      keterangan: o.keterangan || "",
      jumlah: String(o.jumlah)
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleCancelOpex = () => {
    setOpexEditId(null)
    setOpexForm(EMPTY_OPEX_FORM)
  }

  const handleOpexSubmit = async () => {
    if (!opexForm.kategori || !opexForm.jumlah) { alert("Isi kategori dan jumlah!"); return }
    setIsOpexSubmitting(true)
    try {
      if (opexEditId !== null) {
        const { data, error } = await supabase.from('pengeluaran').update({
          tanggal: opexForm.tanggal,
          kategori: opexForm.kategori,
          sub_kategori: opexForm.sub_kategori,
          keterangan: opexForm.keterangan,
          jumlah: parseFloat(opexForm.jumlah)
        }).eq('id', opexEditId).select().single()
        if (error) throw error
        setOpexList(prev => prev.map(o => o.id === opexEditId ? data as Pengeluaran : o))
        setOpexEditId(null)
      } else {
        const { data, error } = await supabase.from('pengeluaran').insert({
          tanggal: opexForm.tanggal,
          kategori: opexForm.kategori,
          sub_kategori: opexForm.sub_kategori,
          keterangan: opexForm.keterangan,
          jumlah: parseFloat(opexForm.jumlah)
        }).select().single()
        if (error) throw error
        setOpexList(prev => [data as Pengeluaran, ...prev])
      }
      setOpexForm(EMPTY_OPEX_FORM)
    } catch (e: any) { alert("Gagal: " + e.message) }
    finally { setIsOpexSubmitting(false) }
  }

  const handleDeleteOpex = async (id: number) => {
    if (!confirm("Hapus data pengeluaran ini?")) return
    const { error } = await supabase.from('pengeluaran').delete().eq('id', id)
    if (error) { alert("Gagal hapus: " + error.message); return }
    setOpexList(prev => prev.filter(o => o.id !== id))
    if (opexEditId === id) handleCancelOpex()
  }

  // --- CapEx handlers ---

  const handleEditCapex = (c: PengeluaranCapex) => {
    setCapexEditId(c.id)
    setCapexForm({
      tanggal: c.tanggal,
      nama_aset: c.nama_aset,
      kategori: c.kategori,
      keterangan: c.keterangan || "",
      jumlah: String(c.jumlah)
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleCancelCapex = () => {
    setCapexEditId(null)
    setCapexForm(EMPTY_CAPEX_FORM)
  }

  const handleCapexSubmit = async () => {
    if (!capexForm.nama_aset || !capexForm.kategori || !capexForm.jumlah) {
      alert("Isi nama aset, kategori, dan jumlah!"); return
    }
    setIsCapexSubmitting(true)
    try {
      if (capexEditId !== null) {
        const { data, error } = await supabase.from('pengeluaran_capex').update({
          tanggal: capexForm.tanggal,
          nama_aset: capexForm.nama_aset,
          kategori: capexForm.kategori,
          keterangan: capexForm.keterangan,
          jumlah: parseFloat(capexForm.jumlah)
        }).eq('id', capexEditId).select().single()
        if (error) throw error
        setCapexList(prev => prev.map(c => c.id === capexEditId ? data as PengeluaranCapex : c))
        setCapexEditId(null)
      } else {
        const { data, error } = await supabase.from('pengeluaran_capex').insert({
          tanggal: capexForm.tanggal,
          nama_aset: capexForm.nama_aset,
          kategori: capexForm.kategori,
          keterangan: capexForm.keterangan,
          jumlah: parseFloat(capexForm.jumlah)
        }).select().single()
        if (error) throw error
        setCapexList(prev => [data as PengeluaranCapex, ...prev])
      }
      setCapexForm(EMPTY_CAPEX_FORM)
    } catch (e: any) { alert("Gagal: " + e.message) }
    finally { setIsCapexSubmitting(false) }
  }

  const handleDeleteCapex = async (id: number) => {
    if (!confirm("Hapus data aset ini?")) return
    const { error } = await supabase.from('pengeluaran_capex').delete().eq('id', id)
    if (error) { alert("Gagal hapus: " + error.message); return }
    setCapexList(prev => prev.filter(c => c.id !== id))
    if (capexEditId === id) handleCancelCapex()
  }

  const years = Array.from(new Set(opexList.map(o => new Date(o.tanggal).getFullYear()))).sort((a, b) => b - a)
  if (!years.includes(thisYear)) years.unshift(thisYear)

  return (
    <>
      <header className="sticky top-0 z-10 flex items-center justify-between px-8 py-5 bg-[#0d1117]/80 backdrop-blur border-b border-white/[0.05]">
        <div>
          <h2 className="text-2xl font-bold text-white">Pengeluaran</h2>
          <p className="text-sm text-gray-500 mt-0.5">Catat pengeluaran operasional dan pembelian aset</p>
        </div>
        <button onClick={fetchAll} className="bg-white/5 hover:bg-white/10 text-white text-sm font-medium px-4 py-2.5 rounded-xl border border-white/10 transition-colors">
          🔄 Refresh
        </button>
      </header>

      <main className="p-8 space-y-6">
        {/* Tab switcher */}
        <div className="flex gap-2 border-b border-white/[0.05]">
          {[
            { key: 'opex', label: '💸 Operasional (OpEx)' },
            { key: 'capex', label: '🏗️ Aset (CapEx)' }
          ].map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
              className={`px-5 py-3 text-sm font-semibold rounded-t-xl transition-colors ${activeTab === tab.key ? 'bg-[#161b22] text-white border border-b-0 border-white/10' : 'text-gray-500 hover:text-gray-300'}`}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* ===== OPEX TAB ===== */}
        {activeTab === 'opex' && (
          <div className="space-y-6">
            {/* Filter bulan/tahun */}
            <div className="flex items-center gap-3">
              <select
                value={opexFilter.bulan}
                onChange={e => setOpexFilter(f => ({ ...f, bulan: parseInt(e.target.value) }))}
                className="bg-[#161b22] border border-white/10 text-white rounded-xl px-4 h-10 text-sm focus:outline-none focus:border-green-500"
              >
                {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
              <select
                value={opexFilter.tahun}
                onChange={e => setOpexFilter(f => ({ ...f, tahun: parseInt(e.target.value) }))}
                className="bg-[#161b22] border border-white/10 text-white rounded-xl px-4 h-10 text-sm focus:outline-none focus:border-green-500"
              >
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-4 gap-5">
              <div className="col-span-2 bg-[#161b22] border border-white/[0.06] rounded-2xl p-5">
                <p className="text-gray-400 text-sm mb-1">Total Pengeluaran {MONTHS[opexFilter.bulan - 1]}</p>
                <p className="text-3xl font-bold text-red-400">{formatRp(totalOpex)}</p>
                <p className="text-xs text-gray-500 mt-1">{filteredOpex.length} transaksi</p>
              </div>
              {breakdownKategori.slice(0, 3).map(([kat, jumlah]) => (
                <div key={kat} className="bg-[#161b22] border border-white/[0.06] rounded-2xl p-5">
                  <p className="text-gray-400 text-xs mb-1 truncate">{kat}</p>
                  <p className="text-xl font-bold text-orange-400">{formatRp(jumlah)}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {totalOpex > 0 ? Math.round((jumlah / totalOpex) * 100) : 0}% dari total
                  </p>
                </div>
              ))}
            </div>

            {/* Form input / edit */}
            <form onSubmit={(e) => { e.preventDefault(); handleOpexSubmit(); }} className={`bg-[#161b22] border rounded-2xl p-6 space-y-5 transition-colors ${opexEditId ? 'border-yellow-500/30' : 'border-white/[0.05]'}`}>
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-white text-lg">
                  {opexEditId ? '✏️ Edit Pengeluaran' : 'Tambah Pengeluaran'}
                </h3>
                {opexEditId && (
                  <span className="text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 px-3 py-1 rounded-full">
                    Mode Edit
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <label className="text-gray-300 text-sm">Tanggal <span className="text-red-500">*</span></label>
                  <input type="date" value={opexForm.tanggal}
                    onChange={e => setOpexForm(f => ({ ...f, tanggal: e.target.value }))}
                    onClick={e => (e.target as any).showPicker?.()}
                    className="w-full cursor-pointer bg-[#0d1117] border border-white/10 text-white rounded-xl px-4 h-10 text-sm focus:outline-none focus:border-green-500 [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-gray-300 text-sm">Kategori <span className="text-red-500">*</span></label>
                  <select value={opexForm.kategori}
                    onChange={e => setOpexForm(f => ({ ...f, kategori: e.target.value }))}
                    className="w-full bg-[#0d1117] border border-white/10 text-white rounded-xl px-4 h-10 text-sm focus:outline-none focus:border-green-500">
                    <option value="">Pilih kategori...</option>
                    {KATEGORI_OPEX.map(k => <option key={k} value={k}>{k}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-gray-300 text-sm">Sub-kategori / Keterangan</label>
                  <input type="text" value={opexForm.keterangan}
                    onChange={e => setOpexForm(f => ({ ...f, keterangan: e.target.value }))}
                    className="w-full bg-[#0d1117] border border-white/10 text-white rounded-xl px-4 h-10 text-sm focus:outline-none focus:border-green-500"
                    placeholder="mis. bensin, listrik..." />
                </div>
                <div className="space-y-1.5">
                  <label className="text-gray-300 text-sm">Jumlah (Rp) <span className="text-red-500">*</span></label>
                  <input type="number" min="0" value={opexForm.jumlah}
                    onChange={e => setOpexForm(f => ({ ...f, jumlah: e.target.value }))}
                    onWheel={(e) => (e.target as HTMLInputElement).blur()}
                    className="w-full bg-[#0d1117] border border-white/10 text-white rounded-xl px-4 h-10 text-sm focus:outline-none focus:border-green-500"
                    placeholder="0" />
                </div>
              </div>
              <div className="flex justify-end gap-3">
                {opexEditId && (
                  <button type="button" onClick={handleCancelOpex}
                    className="bg-white/5 hover:bg-white/10 text-gray-300 font-semibold px-6 py-2.5 rounded-xl transition-colors border border-white/10">
                    Batal
                  </button>
                )}
                <button type="submit" disabled={isOpexSubmitting}
                  className={`disabled:opacity-50 text-white font-semibold px-6 py-2.5 rounded-xl transition-colors ${opexEditId ? 'bg-yellow-600 hover:bg-yellow-500' : 'bg-green-600 hover:bg-green-500'}`}>
                  {isOpexSubmitting ? "Menyimpan..." : opexEditId ? "✏️ Update" : "💾 Simpan"}
                </button>
              </div>
            </form>

            {/* Tabel riwayat */}
            <div className="bg-[#161b22] border border-white/[0.05] rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-white/[0.05] flex items-center justify-between">
                <h3 className="font-bold text-white">
                  Riwayat — {MONTHS[opexFilter.bulan - 1]} {opexFilter.tahun}
                </h3>
                <span className="text-xs text-gray-500">{filteredOpex.length} entri</span>
              </div>
              {isLoading ? (
                <div className="p-12 text-center text-gray-400 flex flex-col items-center">
                  <div className="w-8 h-8 border-4 border-green-500/30 border-t-green-500 rounded-full animate-spin mb-4"></div>
                  Memuat...
                </div>
              ) : filteredOpex.length === 0 ? (
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
                      <th className="px-5 py-3 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.02]">
                    {filteredOpex.map(o => (
                      <tr key={o.id} className={`hover:bg-white/[0.01] group transition-colors ${opexEditId === o.id ? 'bg-yellow-500/5 border-l-2 border-yellow-500/40' : ''}`}>
                        <td className="px-5 py-3 text-gray-400 whitespace-nowrap">{formatDate(o.tanggal)}</td>
                        <td className="px-5 py-3">
                          <span className="bg-white/5 text-gray-300 text-xs px-2.5 py-1 rounded-full border border-white/10">
                            {o.kategori}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-gray-400">{o.keterangan || o.sub_kategori || "-"}</td>
                        <td className="px-5 py-3 text-right font-semibold text-red-400">{formatRp(o.jumlah)}</td>
                        <td className="px-5 py-3 text-center">
                          <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                            <button onClick={() => handleEditOpex(o)}
                              className="bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 px-3 py-1.5 rounded-lg text-xs font-semibold border border-yellow-500/20">
                              Edit
                            </button>
                            <button onClick={() => handleDeleteOpex(o.id)}
                              className="bg-red-500/10 hover:bg-red-500/20 text-red-400 px-3 py-1.5 rounded-lg text-xs font-semibold border border-red-500/20">
                              Hapus
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t border-white/10 bg-[#0d1117]/60">
                    <tr>
                      <td colSpan={3} className="px-5 py-3 text-gray-400 font-semibold">Total</td>
                      <td className="px-5 py-3 text-right font-bold text-red-400 text-base">{formatRp(totalOpex)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ===== CAPEX TAB ===== */}
        {activeTab === 'capex' && (
          <div className="space-y-6">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-5">
              <div className="bg-[#161b22] border border-white/[0.06] rounded-2xl p-5">
                <p className="text-gray-400 text-sm mb-1">Total Nilai Aset</p>
                <p className="text-2xl font-bold text-blue-400">{formatRp(totalCapex)}</p>
                <p className="text-xs text-gray-500 mt-1">{capexList.length} aset tercatat</p>
              </div>
              {KATEGORI_CAPEX.map(kat => {
                const total = capexList.filter(c => c.kategori === kat).reduce((acc, c) => acc + c.jumlah, 0)
                return (
                  <div key={kat} className="bg-[#161b22] border border-white/[0.06] rounded-2xl p-5">
                    <p className="text-gray-400 text-xs mb-1">{kat}</p>
                    <p className="text-xl font-bold text-indigo-400">{formatRp(total)}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {capexList.filter(c => c.kategori === kat).length} item
                    </p>
                  </div>
                )
              })}
            </div>

            {/* Form input / edit aset */}
            <form onSubmit={(e) => { e.preventDefault(); handleCapexSubmit(); }} className={`bg-[#161b22] border rounded-2xl p-6 space-y-5 transition-colors ${capexEditId ? 'border-yellow-500/30' : 'border-white/[0.05]'}`}>
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-white text-lg">
                  {capexEditId ? '✏️ Edit Aset' : 'Tambah Aset'}
                </h3>
                {capexEditId && (
                  <span className="text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 px-3 py-1 rounded-full">
                    Mode Edit
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-gray-300 text-sm">Tanggal <span className="text-red-500">*</span></label>
                  <input type="date" value={capexForm.tanggal}
                    onChange={e => setCapexForm(f => ({ ...f, tanggal: e.target.value }))}
                    onClick={e => (e.target as any).showPicker?.()}
                    className="w-full cursor-pointer bg-[#0d1117] border border-white/10 text-white rounded-xl px-4 h-10 text-sm focus:outline-none focus:border-green-500 [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-gray-300 text-sm">Nama Aset <span className="text-red-500">*</span></label>
                  <input type="text" value={capexForm.nama_aset}
                    onChange={e => setCapexForm(f => ({ ...f, nama_aset: e.target.value }))}
                    className="w-full bg-[#0d1117] border border-white/10 text-white rounded-xl px-4 h-10 text-sm focus:outline-none focus:border-green-500"
                    placeholder="mis. Motor Honda, Freezer..." />
                </div>
                <div className="space-y-1.5">
                  <label className="text-gray-300 text-sm">Kategori <span className="text-red-500">*</span></label>
                  <select value={capexForm.kategori}
                    onChange={e => setCapexForm(f => ({ ...f, kategori: e.target.value }))}
                    className="w-full bg-[#0d1117] border border-white/10 text-white rounded-xl px-4 h-10 text-sm focus:outline-none focus:border-green-500">
                    <option value="">Pilih kategori...</option>
                    {KATEGORI_CAPEX.map(k => <option key={k} value={k}>{k}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-gray-300 text-sm">Keterangan</label>
                  <input type="text" value={capexForm.keterangan}
                    onChange={e => setCapexForm(f => ({ ...f, keterangan: e.target.value }))}
                    className="w-full bg-[#0d1117] border border-white/10 text-white rounded-xl px-4 h-10 text-sm focus:outline-none focus:border-green-500"
                    placeholder="Deskripsi tambahan..." />
                </div>
                <div className="space-y-1.5">
                  <label className="text-gray-300 text-sm">Jumlah (Rp) <span className="text-red-500">*</span></label>
                  <input type="number" min="0" value={capexForm.jumlah}
                    onChange={e => setCapexForm(f => ({ ...f, jumlah: e.target.value }))}
                    onWheel={(e) => (e.target as HTMLInputElement).blur()}
                    className="w-full bg-[#0d1117] border border-white/10 text-white rounded-xl px-4 h-10 text-sm focus:outline-none focus:border-green-500"
                    placeholder="0" />
                </div>
              </div>
              <div className="flex justify-end gap-3">
                {capexEditId && (
                  <button type="button" onClick={handleCancelCapex}
                    className="bg-white/5 hover:bg-white/10 text-gray-300 font-semibold px-6 py-2.5 rounded-xl transition-colors border border-white/10">
                    Batal
                  </button>
                )}
                <button type="submit" disabled={isCapexSubmitting}
                  className={`disabled:opacity-50 text-white font-semibold px-6 py-2.5 rounded-xl transition-colors ${capexEditId ? 'bg-yellow-600 hover:bg-yellow-500' : 'bg-green-600 hover:bg-green-500'}`}>
                  {isCapexSubmitting ? "Menyimpan..." : capexEditId ? "✏️ Update" : "💾 Simpan Aset"}
                </button>
              </div>
            </form>

            {/* Tabel daftar aset */}
            <div className="bg-[#161b22] border border-white/[0.05] rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-white/[0.05] flex items-center justify-between">
                <h3 className="font-bold text-white">Daftar Aset</h3>
                <span className="text-xs text-gray-500">{capexList.length} aset</span>
              </div>
              {isLoading ? (
                <div className="p-12 text-center text-gray-400 flex flex-col items-center">
                  <div className="w-8 h-8 border-4 border-green-500/30 border-t-green-500 rounded-full animate-spin mb-4"></div>
                  Memuat...
                </div>
              ) : capexList.length === 0 ? (
                <div className="p-12 text-center text-gray-500">
                  <span className="text-4xl block mb-3 opacity-40">🏗️</span>
                  Belum ada data aset
                </div>
              ) : (
                <table className="w-full text-sm text-gray-300">
                  <thead className="text-xs text-gray-400 uppercase bg-[#0d1117]/80 border-b border-white/[0.05]">
                    <tr>
                      <th className="px-5 py-3 text-left">Tanggal</th>
                      <th className="px-5 py-3 text-left">Nama Aset</th>
                      <th className="px-5 py-3 text-left">Kategori</th>
                      <th className="px-5 py-3 text-left">Keterangan</th>
                      <th className="px-5 py-3 text-right">Jumlah</th>
                      <th className="px-5 py-3 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.02]">
                    {capexList.map(c => (
                      <tr key={c.id} className={`hover:bg-white/[0.01] group transition-colors ${capexEditId === c.id ? 'bg-yellow-500/5 border-l-2 border-yellow-500/40' : ''}`}>
                        <td className="px-5 py-3 text-gray-400 whitespace-nowrap">{formatDate(c.tanggal)}</td>
                        <td className="px-5 py-3 font-medium text-white">{c.nama_aset}</td>
                        <td className="px-5 py-3">
                          <span className="bg-blue-500/10 text-blue-300 text-xs px-2.5 py-1 rounded-full border border-blue-500/20">
                            {c.kategori}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-gray-400">{c.keterangan || "-"}</td>
                        <td className="px-5 py-3 text-right font-semibold text-blue-400">{formatRp(c.jumlah)}</td>
                        <td className="px-5 py-3 text-center">
                          <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                            <button onClick={() => handleEditCapex(c)}
                              className="bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 px-3 py-1.5 rounded-lg text-xs font-semibold border border-yellow-500/20">
                              Edit
                            </button>
                            <button onClick={() => handleDeleteCapex(c.id)}
                              className="bg-red-500/10 hover:bg-red-500/20 text-red-400 px-3 py-1.5 rounded-lg text-xs font-semibold border border-red-500/20">
                              Hapus
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t border-white/10 bg-[#0d1117]/60">
                    <tr>
                      <td colSpan={4} className="px-5 py-3 text-gray-400 font-semibold">Total Nilai Aset</td>
                      <td className="px-5 py-3 text-right font-bold text-blue-400 text-base">{formatRp(totalCapex)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          </div>
        )}
      </main>
    </>
  )
}