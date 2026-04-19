"use client"

import { useState, useEffect, useMemo } from "react"
import { supabase } from "@/utils/supabase/client"

type Produk = { id: number; nama: string; satuan: string; aktif: boolean }
type Supplier = { id: number; nama: string }
type HPP = {
  id: number; tanggal: string; produk_id: number; nama_produk: string
  satuan: string; hpp_satuan: number; qty: number; total_modal: number
  nama_supplier: string; tipe_bayar: string; catatan: string
}
type StokAwal = { id: number; produk_id: number; nama_produk: string; satuan: string; qty: number }
type Opname = {
  id: number; tanggal: string; produk_id: number; nama_produk: string
  satuan: string; qty_sistem: number; qty_aktual: number; selisih: number; catatan: string
}
type StokItem = {
  produk_id: number; nama_produk: string; satuan: string
  stok_awal: number; total_masuk: number; total_keluar: number; koreksi_opname: number; stok_akhir: number
}
type HppRow = { produk_id: string; hpp_satuan: string; qty: string; catatan: string }

export default function StokAyamPage() {
  const [activeTab, setActiveTab] = useState<'stok' | 'hpp' | 'opname'>('stok')
  const [produkList, setProdukList] = useState<Produk[]>([])
  const [supplierList, setSupplierList] = useState<Supplier[]>([])
  const [hppList, setHppList] = useState<HPP[]>([])
  const [stokAwalList, setStokAwalList] = useState<StokAwal[]>([])
  const [opnameList, setOpnameList] = useState<Opname[]>([])
  const [transaksiDetail, setTransaksiDetail] = useState<{ nama_produk: string; qty: number }[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // HPP Form multi-produk
  const [hppTanggal, setHppTanggal] = useState(new Date().toISOString().split('T')[0])
  const [hppSupplierId, setHppSupplierId] = useState("")
  const [hppTipeBayar, setHppTipeBayar] = useState("Tunai")
  const [hppRows, setHppRows] = useState<HppRow[]>([{ produk_id: "", hpp_satuan: "", qty: "", catatan: "" }])
  const [isHppSubmitting, setIsHppSubmitting] = useState(false)

  // Stok Awal
  const [stokAwalForm, setStokAwalForm] = useState({ produk_id: "", qty: "" })
  const [isStokAwalSubmitting, setIsStokAwalSubmitting] = useState(false)
  const [showStokAwalModal, setShowStokAwalModal] = useState(false)

  // Opname
  const [opnameForm, setOpnameForm] = useState({ tanggal: new Date().toISOString().split('T')[0], produk_id: "", qty_aktual: "", catatan: "" })
  const [isOpnameSubmitting, setIsOpnameSubmitting] = useState(false)

  const formatRp = (n: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n)
  const formatDate = (d: string) => new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    setIsLoading(true)
    try {
      const [p, s, h, sa, o, td] = await Promise.all([
        supabase.from('produk').select('*').eq('aktif', true).order('nama'),
        supabase.from('supplier').select('id, nama').order('nama'),
        supabase.from('hpp').select('*').order('tanggal', { ascending: false }),
        supabase.from('stok_awal').select('*'),
        supabase.from('opname').select('*').order('tanggal', { ascending: false }),
        supabase.from('transaksi_detail').select('nama_produk, qty')
      ])
      if (p.data) setProdukList(p.data)
      if (s.data) setSupplierList(s.data)
      if (h.data) setHppList(h.data)
      if (sa.data) setStokAwalList(sa.data)
      if (o.data) setOpnameList(o.data)
      if (td.data) setTransaksiDetail(td.data)
    } catch (e) { console.error(e) }
    finally { setIsLoading(false) }
  }

  const selectedProdukOpname = produkList.find(p => p.id === parseInt(opnameForm.produk_id))

  const stokData = useMemo((): StokItem[] => {
    return produkList.map(produk => {
      const sa = stokAwalList.find(s => s.produk_id === produk.id)
      const stok_awal = sa?.qty || 0
      const total_masuk = hppList.filter(h => h.produk_id === produk.id).reduce((acc, h) => acc + h.qty, 0)
      const total_keluar = transaksiDetail.filter(t => t.nama_produk === produk.nama).reduce((acc, t) => acc + t.qty, 0)
      const koreksi_opname = opnameList.filter(o => o.produk_id === produk.id).reduce((acc, o) => acc + o.selisih, 0)
      const stok_akhir = stok_awal + total_masuk - total_keluar + koreksi_opname
      return { produk_id: produk.id, nama_produk: produk.nama, satuan: produk.satuan, stok_awal, total_masuk, total_keluar, koreksi_opname, stok_akhir }
    })
  }, [produkList, stokAwalList, hppList, transaksiDetail, opnameList])

  const getSistemStok = (produk_id: number) => stokData.find(s => s.produk_id === produk_id)?.stok_akhir || 0

  const addHppRow = () => setHppRows(prev => [...prev, { produk_id: "", hpp_satuan: "", qty: "", catatan: "" }])
  const removeHppRow = (idx: number) => setHppRows(prev => prev.filter((_, i) => i !== idx))
  const updateHppRow = (idx: number, field: keyof HppRow, value: string) =>
    setHppRows(prev => prev.map((row, i) => i === idx ? { ...row, [field]: value } : row))

  const hppTotalModal = hppRows.reduce((acc, row) => acc + (parseFloat(row.hpp_satuan || '0') * parseFloat(row.qty || '0')), 0)

  const handleHppSubmit = async () => {
    const validRows = hppRows.filter(r => r.produk_id !== "" && Number(r.hpp_satuan) > 0 && Number(r.qty) > 0)
    if (validRows.length === 0) { alert("Isi minimal 1 produk!"); return }
    const supplier = supplierList.find(s => s.id === parseInt(hppSupplierId))
    setIsHppSubmitting(true)
    try {
      const inserts = validRows.map(row => {
        const produk = produkList.find(p => p.id === parseInt(row.produk_id))
        const qty = parseFloat(row.qty)
        const hpp_satuan = parseFloat(row.hpp_satuan)
        return {
          tanggal: hppTanggal, produk_id: parseInt(row.produk_id),
          nama_produk: produk?.nama || "", satuan: produk?.satuan || "",
          hpp_satuan, qty, total_modal: qty * hpp_satuan,
          supplier_id: hppSupplierId ? parseInt(hppSupplierId) : null,
          nama_supplier: supplier?.nama || "", tipe_bayar: hppTipeBayar, catatan: row.catatan
        }
      })
      const { data, error } = await supabase.from('hpp').insert(inserts).select()
      if (error) throw error
      setHppList(prev => [...(data as HPP[]), ...prev])
      setHppRows([{ produk_id: "", hpp_satuan: "", qty: "", catatan: "" }])
      setHppSupplierId(""); setHppTipeBayar("Tunai")
      alert(`${validRows.length} produk HPP berhasil disimpan!`)
    } catch (e: any) { alert("Gagal: " + e.message) }
    finally { setIsHppSubmitting(false) }
  }

  const handleDeleteHpp = async (id: number) => {
    if (!confirm("Hapus data HPP ini?")) return
    const { error } = await supabase.from('hpp').delete().eq('id', id)
    if (error) { alert("Gagal hapus: " + error.message); return }
    setHppList(prev => prev.filter(h => h.id !== id))
  }

  const handleStokAwalSubmit = async () => {
    if (!stokAwalForm.produk_id || !stokAwalForm.qty) { alert("Isi semua field!"); return }
    const produk = produkList.find(p => p.id === parseInt(stokAwalForm.produk_id))
    setIsStokAwalSubmitting(true)
    try {
      const existing = stokAwalList.find(s => s.produk_id === parseInt(stokAwalForm.produk_id))
      if (existing) {
        const { error } = await supabase.from('stok_awal').update({ qty: parseFloat(stokAwalForm.qty) }).eq('id', existing.id)
        if (error) throw error
        setStokAwalList(prev => prev.map(s => s.produk_id === parseInt(stokAwalForm.produk_id) ? { ...s, qty: parseFloat(stokAwalForm.qty) } : s))
      } else {
        const { data, error } = await supabase.from('stok_awal').insert({
          produk_id: parseInt(stokAwalForm.produk_id), nama_produk: produk?.nama || "",
          satuan: produk?.satuan || "", qty: parseFloat(stokAwalForm.qty)
        }).select().single()
        if (error) throw error
        setStokAwalList(prev => [...prev, data as StokAwal])
      }
      setStokAwalForm({ produk_id: "", qty: "" })
      setShowStokAwalModal(false)
      alert("Stok awal berhasil disimpan!")
    } catch (e: any) { alert("Gagal: " + e.message) }
    finally { setIsStokAwalSubmitting(false) }
  }

  const handleOpnameSubmit = async () => {
    if (!opnameForm.produk_id || opnameForm.qty_aktual === "") { alert("Isi semua field wajib!"); return }
    const produk = produkList.find(p => p.id === parseInt(opnameForm.produk_id))
    const qty_sistem = getSistemStok(parseInt(opnameForm.produk_id))
    const qty_aktual = parseFloat(opnameForm.qty_aktual)
    const selisih = qty_aktual - qty_sistem
    setIsOpnameSubmitting(true)
    try {
      const { data, error } = await supabase.from('opname').insert({
        tanggal: opnameForm.tanggal, produk_id: parseInt(opnameForm.produk_id),
        nama_produk: produk?.nama || "", satuan: produk?.satuan || "",
        qty_sistem, qty_aktual, selisih, catatan: opnameForm.catatan
      }).select().single()
      if (error) throw error
      setOpnameList(prev => [data as Opname, ...prev])
      setOpnameForm({ tanggal: new Date().toISOString().split('T')[0], produk_id: "", qty_aktual: "", catatan: "" })
      alert(`Opname berhasil! Selisih: ${selisih >= 0 ? '+' : ''}${selisih} ${produk?.satuan}`)
    } catch (e: any) { alert("Gagal: " + e.message) }
    finally { setIsOpnameSubmitting(false) }
  }

  const handleDeleteOpname = async (id: number) => {
    if (!confirm("Hapus data opname ini?")) return
    const { error } = await supabase.from('opname').delete().eq('id', id)
    if (error) { alert("Gagal hapus: " + error.message); return }
    setOpnameList(prev => prev.filter(o => o.id !== id))
  }

  const totalStokNilai = useMemo(() => hppList.reduce((acc, h) => acc + h.total_modal, 0), [hppList])
  const produkMenipis = stokData.filter(s => s.stok_akhir > 0 && s.stok_akhir < 10).length
  const produkHabis = stokData.filter(s => s.stok_akhir <= 0).length

  return (
    <>
      <header className="sticky top-0 z-10 flex items-center justify-between px-8 py-5 bg-[#0d1117]/80 backdrop-blur border-b border-white/[0.05]">
        <div>
          <h2 className="text-2xl font-bold text-white">Stok Ayam</h2>
          <p className="text-sm text-gray-500 mt-0.5">Pantau stok, input pembelian, dan lakukan opname</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowStokAwalModal(true)} className="bg-white/5 hover:bg-white/10 text-white text-sm font-medium px-4 py-2.5 rounded-xl border border-white/10 transition-colors">⚙️ Set Stok Awal</button>
          <button onClick={fetchAll} className="bg-white/5 hover:bg-white/10 text-white text-sm font-medium px-4 py-2.5 rounded-xl border border-white/10 transition-colors">🔄 Refresh</button>
        </div>
      </header>

      <main className="p-8 space-y-6">
        <div className="grid grid-cols-4 gap-5">
          <div className="bg-[#161b22] border border-white/[0.06] rounded-2xl p-5">
            <p className="text-gray-400 text-sm mb-1">Total Produk</p>
            <p className="text-2xl font-bold text-white">{stokData.length} <span className="text-sm text-gray-500 font-normal">produk</span></p>
          </div>
          <div className="bg-[#161b22] border border-white/[0.06] rounded-2xl p-5">
            <p className="text-gray-400 text-sm mb-1">Modal Pembelian</p>
            <p className="text-2xl font-bold text-green-400">{formatRp(totalStokNilai)}</p>
          </div>
          <div className="bg-[#161b22] border border-yellow-500/20 rounded-2xl p-5">
            <p className="text-gray-400 text-sm mb-1">Stok Menipis</p>
            <p className="text-2xl font-bold text-yellow-400">{produkMenipis} <span className="text-sm text-gray-500 font-normal">produk</span></p>
          </div>
          <div className="bg-[#161b22] border border-red-500/20 rounded-2xl p-5">
            <p className="text-gray-400 text-sm mb-1">Stok Habis</p>
            <p className="text-2xl font-bold text-red-400">{produkHabis} <span className="text-sm text-gray-500 font-normal">produk</span></p>
          </div>
        </div>

        <div className="flex gap-2 border-b border-white/[0.05]">
          {[{ key: 'stok', label: '📦 Stok Saat Ini' }, { key: 'hpp', label: '🛒 Input HPP' }, { key: 'opname', label: '📋 Opname' }].map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
              className={`px-5 py-3 text-sm font-semibold rounded-t-xl transition-colors ${activeTab === tab.key ? 'bg-[#161b22] text-white border border-b-0 border-white/10' : 'text-gray-500 hover:text-gray-300'}`}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* STOK TAB */}
        {activeTab === 'stok' && (
          <div className="bg-[#161b22] border border-white/[0.05] rounded-2xl overflow-hidden">
            {isLoading ? (
              <div className="p-12 text-center text-gray-400 flex flex-col items-center">
                <div className="w-8 h-8 border-4 border-green-500/30 border-t-green-500 rounded-full animate-spin mb-4"></div>
                Menghitung stok...
              </div>
            ) : (
              <table className="w-full text-left text-sm text-gray-300">
                <thead className="text-xs text-gray-400 uppercase bg-[#0d1117]/80 border-b border-white/[0.05]">
                  <tr>
                    <th className="px-6 py-4">Produk</th>
                    <th className="px-6 py-4 text-right">Stok Awal</th>
                    <th className="px-6 py-4 text-right">+ Masuk</th>
                    <th className="px-6 py-4 text-right">- Terjual</th>
                    <th className="px-6 py-4 text-right">± Opname</th>
                    <th className="px-8 py-6 text-right">Stok Akhir</th>
                    <th className="px-6 py-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.02]">
                  {stokData.map(item => {
                    const status = item.stok_akhir <= 0 ? 'Habis' : item.stok_akhir < 10 ? 'Menipis' : 'Tersedia'
                    const statusClass = status === 'Habis' ? 'bg-red-500/10 text-red-400 border-red-500/20' : status === 'Menipis' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' : 'bg-green-500/10 text-green-400 border-green-500/20'
                    return (
                      <tr key={item.produk_id} className="hover:bg-white/[0.01] transition-colors">
                        <td className="px-6 py-4 font-semibold text-white">{item.nama_produk}</td>
                        <td className="px-6 py-4 text-right text-gray-400">{item.stok_awal} {item.satuan}</td>
                        <td className="px-6 py-4 text-right text-green-400">+{item.total_masuk} {item.satuan}</td>
                        <td className="px-6 py-4 text-right text-red-400">-{item.total_keluar} {item.satuan}</td>
                        <td className={`px-6 py-4 text-right ${item.koreksi_opname >= 0 ? 'text-blue-400' : 'text-orange-400'}`}>{item.koreksi_opname >= 0 ? '+' : ''}{item.koreksi_opname} {item.satuan}</td>
                        <td className="px-6 py-4 text-right font-bold text-white text-base">{item.stok_akhir} {item.satuan}</td>
                        <td className="px-6 py-4 text-center"><span className={`px-3 py-1 text-xs font-semibold rounded-full border ${statusClass}`}>{status}</span></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* HPP TAB */}
        {activeTab === 'hpp' && (
          <div className="space-y-6">
            <div className="bg-[#161b22] border border-white/[0.05] rounded-2xl p-6 space-y-5">
              <h3 className="font-bold text-white text-lg">Input Pembelian</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-gray-300 text-sm">Tanggal <span className="text-red-500">*</span></label>
                  <input type="date" value={hppTanggal} onChange={e => setHppTanggal(e.target.value)}
                    className="w-full bg-[#0d1117] border border-white/10 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-green-500 [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-gray-300 text-sm">Supplier</label>
                  <select value={hppSupplierId} onChange={e => setHppSupplierId(e.target.value)}
                    className="w-full bg-[#0d1117] border border-white/10 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-green-500">
                    <option value="">Pilih supplier...</option>
                    {supplierList.map(s => <option key={s.id} value={s.id}>{s.nama}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-gray-300 text-sm">Tipe Bayar</label>
                  <select value={hppTipeBayar} onChange={e => setHppTipeBayar(e.target.value)}
                    className="w-full bg-[#0d1117] border border-white/10 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-green-500">
                    <option value="Tunai">Tunai</option>
                    <option value="Tempo">Tempo</option>
                  </select>
                </div>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-12 gap-3 text-xs text-gray-400 uppercase px-1">
                  <div className="col-span-4">Produk</div>
                  <div className="col-span-2">HPP/satuan (Rp)</div>
                  <div className="col-span-2">Qty</div>
                  <div className="col-span-2">Subtotal</div>
                  <div className="col-span-1">Catatan</div>
                  <div className="col-span-1"></div>
                </div>
                {hppRows.map((row, idx) => {
                  const produk = produkList.find(p => p.id === parseInt(row.produk_id))
                  const subtotal = (Number(row.hpp_satuan) || 0) * (Number(row.qty) || 0)
                  return (
                    <div key={idx} className="grid grid-cols-12 gap-3 items-center bg-[#0d1117] p-3 rounded-xl border border-white/5">
                      <div className="col-span-4">
                        <select value={row.produk_id} onChange={e => updateHppRow(idx, 'produk_id', e.target.value)}
                          className="w-full bg-[#161b22] border border-white/10 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500">
                          <option value="">Pilih produk...</option>
                          {produkList.map(p => <option key={p.id} value={p.id}>{p.nama} ({p.satuan})</option>)}
                        </select>
                      </div>
                      <div className="col-span-2">
                        <input type="number" min="0" value={row.hpp_satuan} onChange={e => updateHppRow(idx, 'hpp_satuan', e.target.value)}
                          className="w-full bg-[#161b22] border border-white/10 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500" placeholder="" />
                      </div>
                      <div className="col-span-2">
                        <input type="number" min="0" step="1" value={row.qty} onChange={e => updateHppRow(idx, 'qty', e.target.value)}
                          className="w-full bg-[#161b22] border border-white/10 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500" placeholder={produk?.satuan || "0"} />
                      </div>
                      <div className="col-span-2">
                        <p className="text-green-400 font-semibold text-sm px-1">{subtotal > 0 ? formatRp(subtotal) : '-'}</p>
                      </div>
                      <div className="col-span-1">
                        <input type="text" value={row.catatan} onChange={e => updateHppRow(idx, 'catatan', e.target.value)}
                          className="w-full bg-[#161b22] border border-white/10 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500" placeholder="..." />
                      </div>
                      <div className="col-span-1 flex justify-center">
                        {hppRows.length > 1 && (
                          <button onClick={() => removeHppRow(idx)} className="w-7 h-7 rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-400 flex items-center justify-center text-xs font-bold">✕</button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="flex items-center justify-between pt-2">
                <button onClick={addHppRow} className="flex items-center gap-2 text-green-400 hover:text-green-300 text-sm font-medium transition-colors">
                  <span className="w-6 h-6 rounded-full bg-green-500/10 flex items-center justify-center text-base">+</span> Tambah Produk
                </button>
                <div className="flex items-center gap-6">
                  {hppTotalModal > 0 && (
                    <div className="text-right">
                      <p className="text-xs text-gray-400">Total Modal</p>
                      <p className="text-xl font-bold text-green-400">{formatRp(hppTotalModal)}</p>
                    </div>
                  )}
                  <button onClick={handleHppSubmit} disabled={isHppSubmitting}
                    className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-semibold px-6 py-3 rounded-xl transition-colors">
                    {isHppSubmitting ? "Menyimpan..." : "💾 Simpan HPP"}
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-[#161b22] border border-white/[0.05] rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-white/[0.05]"><h3 className="font-bold text-white">Riwayat Pembelian</h3></div>
              {hppList.length === 0 ? (
                <div className="p-12 text-center text-gray-500"><span className="text-4xl block mb-3 opacity-40">🛒</span>Belum ada data pembelian</div>
              ) : (
                <table className="w-full text-sm text-gray-300">
                  <thead className="text-xs text-gray-400 uppercase bg-[#0d1117]/80 border-b border-white/[0.05]">
                    <tr>
                      <th className="px-5 py-3">Tanggal</th><th className="px-5 py-3">Produk</th>
                      <th className="px-5 py-3 text-right">Qty</th><th className="px-5 py-3 text-right">HPP/sat</th>
                      <th className="px-5 py-3 text-right">Total</th><th className="px-5 py-3">Supplier</th>
                      <th className="px-5 py-3 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.02]">
                    {hppList.map(h => (
                      <tr key={h.id} className="hover:bg-white/[0.01] group">
                        <td className="px-5 py-3 text-gray-400 whitespace-nowrap">{formatDate(h.tanggal)}</td>
                        <td className="px-5 py-3 font-medium text-white">{h.nama_produk}</td>
                        <td className="px-5 py-3 text-right">{h.qty} {h.satuan}</td>
                        <td className="px-5 py-3 text-right">{formatRp(h.hpp_satuan)}</td>
                        <td className="px-5 py-3 text-right font-semibold text-green-400">{formatRp(h.total_modal)}</td>
                        <td className="px-5 py-3 text-gray-400">{h.nama_supplier || "-"}</td>
                        <td className="px-5 py-3 text-center">
                          <button onClick={() => handleDeleteHpp(h.id)}
                            className="opacity-0 group-hover:opacity-100 bg-red-500/10 hover:bg-red-500/20 text-red-400 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border border-red-500/20">
                            Hapus
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* OPNAME TAB */}
        {activeTab === 'opname' && (
          <div className="grid grid-cols-5 gap-6">
            <div className="col-span-2 bg-[#161b22] border border-white/[0.05] rounded-2xl p-6 space-y-4">
              <h3 className="font-bold text-white text-lg">Input Opname</h3>
              <div className="space-y-1.5">
                <label className="text-gray-300 text-sm">Tanggal <span className="text-red-500">*</span></label>
                <input type="date" value={opnameForm.tanggal} onChange={e => setOpnameForm({ ...opnameForm, tanggal: e.target.value })}
                  className="w-full bg-[#0d1117] border border-white/10 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-green-500 [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert" />
              </div>
              <div className="space-y-1.5">
                <label className="text-gray-300 text-sm">Produk <span className="text-red-500">*</span></label>
                <select value={opnameForm.produk_id} onChange={e => setOpnameForm({ ...opnameForm, produk_id: e.target.value })}
                  className="w-full bg-[#0d1117] border border-white/10 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-green-500">
                  <option value="">Pilih produk...</option>
                  {produkList.map(p => <option key={p.id} value={p.id}>{p.nama} ({p.satuan})</option>)}
                </select>
              </div>
              {opnameForm.produk_id && (
                <div className="bg-[#0d1117] border border-white/10 rounded-xl px-4 py-3">
                  <p className="text-xs text-gray-400">Stok Sistem Saat Ini</p>
                  <p className="text-lg font-bold text-white">{getSistemStok(parseInt(opnameForm.produk_id))} {selectedProdukOpname?.satuan}</p>
                </div>
              )}
              <div className="space-y-1.5">
                <label className="text-gray-300 text-sm">Stok Aktual (hasil timbang) <span className="text-red-500">*</span></label>
                <input type="number" min="0" step="1" value={opnameForm.qty_aktual}
                  onChange={e => setOpnameForm({ ...opnameForm, qty_aktual: e.target.value })}
                  className="w-full bg-[#0d1117] border border-white/10 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-green-500" placeholder="0" />
              </div>
              {opnameForm.produk_id && opnameForm.qty_aktual !== "" && (
                <div className={`border rounded-xl px-4 py-3 ${parseFloat(opnameForm.qty_aktual) - getSistemStok(parseInt(opnameForm.produk_id)) >= 0 ? 'bg-blue-500/10 border-blue-500/20' : 'bg-orange-500/10 border-orange-500/20'}`}>
                  <p className="text-xs text-gray-400">Selisih</p>
                  <p className={`text-lg font-bold ${parseFloat(opnameForm.qty_aktual) - getSistemStok(parseInt(opnameForm.produk_id)) >= 0 ? 'text-blue-400' : 'text-orange-400'}`}>
                    {(() => { const sel = parseFloat(opnameForm.qty_aktual) - getSistemStok(parseInt(opnameForm.produk_id)); return `${sel >= 0 ? '+' : ''}${sel} ${selectedProdukOpname?.satuan}` })()}
                  </p>
                </div>
              )}
              <div className="space-y-1.5">
                <label className="text-gray-300 text-sm">Catatan</label>
                <input type="text" value={opnameForm.catatan} onChange={e => setOpnameForm({ ...opnameForm, catatan: e.target.value })}
                  className="w-full bg-[#0d1117] border border-white/10 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-green-500" placeholder="Susut, dll..." />
              </div>
              <button onClick={handleOpnameSubmit} disabled={isOpnameSubmitting}
                className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors">
                {isOpnameSubmitting ? "Menyimpan..." : "📋 Simpan Opname"}
              </button>
            </div>

            <div className="col-span-3 bg-[#161b22] border border-white/[0.05] rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-white/[0.05]"><h3 className="font-bold text-white">Riwayat Opname</h3></div>
              {opnameList.length === 0 ? (
                <div className="p-12 text-center text-gray-500"><span className="text-4xl block mb-3 opacity-40">📋</span>Belum ada data opname</div>
              ) : (
                <table className="w-full text-sm text-gray-300">
                  <thead className="text-xs text-gray-400 uppercase bg-[#0d1117]/80 border-b border-white/[0.05]">
                    <tr>
                      <th className="px-5 py-3">Tanggal</th><th className="px-5 py-3">Produk</th>
                      <th className="px-5 py-3 text-right">Sistem</th><th className="px-5 py-3 text-right">Aktual</th>
                      <th className="px-5 py-3 text-right">Selisih</th><th className="px-5 py-3 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.02]">
                    {opnameList.map(o => (
                      <tr key={o.id} className="hover:bg-white/[0.01] group">
                        <td className="px-5 py-3 text-gray-400 whitespace-nowrap">{formatDate(o.tanggal)}</td>
                        <td className="px-5 py-3 font-medium text-white">{o.nama_produk}</td>
                        <td className="px-5 py-3 text-right">{o.qty_sistem} {o.satuan}</td>
                        <td className="px-5 py-3 text-right">{o.qty_aktual} {o.satuan}</td>
                        <td className={`px-5 py-3 text-right font-semibold ${o.selisih >= 0 ? 'text-blue-400' : 'text-orange-400'}`}>{o.selisih >= 0 ? '+' : ''}{o.selisih} {o.satuan}</td>
                        <td className="px-5 py-3 text-center">
                          <button onClick={() => handleDeleteOpname(o.id)}
                            className="opacity-0 group-hover:opacity-100 bg-red-500/10 hover:bg-red-500/20 text-red-400 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border border-red-500/20">
                            Hapus
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </main>

      {showStokAwalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#161b22] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-white/5">
              <h3 className="text-lg font-bold text-white">⚙️ Set Stok Awal</h3>
              <button onClick={() => setShowStokAwalModal(false)} className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-gray-300 text-sm">Produk <span className="text-red-500">*</span></label>
                <select value={stokAwalForm.produk_id} onChange={e => setStokAwalForm({ ...stokAwalForm, produk_id: e.target.value })}
                  className="w-full bg-[#0d1117] border border-white/10 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-green-500">
                  <option value="">Pilih produk...</option>
                  {produkList.map(p => {
                    const existing = stokAwalList.find(s => s.produk_id === p.id)
                    return <option key={p.id} value={p.id}>{p.nama} ({p.satuan}){existing ? ` — saat ini: ${existing.qty}` : ''}</option>
                  })}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-gray-300 text-sm">Qty Stok Awal <span className="text-red-500">*</span></label>
                <input type="number" min="0" step="1" value={stokAwalForm.qty} onChange={e => setStokAwalForm({ ...stokAwalForm, qty: e.target.value })}
                  className="w-full bg-[#0d1117] border border-white/10 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-green-500" placeholder="0" />
              </div>
              <p className="text-xs text-gray-500">Jika produk sudah punya stok awal, nilai akan di-update.</p>
            </div>
            <div className="p-6 border-t border-white/5 flex gap-3">
              <button onClick={() => setShowStokAwalModal(false)} className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl font-medium">Batal</button>
              <button onClick={handleStokAwalSubmit} disabled={isStokAwalSubmitting}
                className="flex-1 py-2.5 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white rounded-xl font-semibold">
                {isStokAwalSubmitting ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
