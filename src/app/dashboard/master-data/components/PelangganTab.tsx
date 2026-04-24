"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { supabase } from "@/utils/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type Pelanggan = {
  id: number
  nama: string
  jenis: string
  telepon: string
  alamat: string
  catatan: string
}

const TIPE_OPTIONS = ["Retail", "UMKM", "Horeka", "Reseller", "Pemerintah"]

export function PelangganTab() {
  const [pelanggan, setPelanggan] = useState<Pelanggan[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [jenisFilter, setJenisFilter] = useState("Semua")
  const [searchQuery, setSearchQuery] = useState("")
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formData, setFormData] = useState({
    nama: "", jenis: "Retail", telepon: "", alamat: "", catatan: ""
  })
  const modalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isModalOpen) setTimeout(() => modalRef.current?.focus(), 100)
  }, [isModalOpen])

  const handleModalKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      const inputs = Array.from(e.currentTarget.querySelectorAll('input:not([disabled]), select:not([disabled]), textarea:not([disabled])')) as HTMLElement[]
      const activeEl = document.activeElement as HTMLElement
      const activeIndex = inputs.indexOf(activeEl)
      
      if (activeIndex > -1 && activeIndex < inputs.length - 1) {
        inputs[activeIndex + 1].focus()
      } else {
        handleSave()
      }
    }
  }

  useEffect(() => { fetchPelanggan() }, [])

  const fetchPelanggan = async () => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase.from('pelanggan').select('*').order('nama', { ascending: true })
      if (!error && data) setPelanggan(data as Pelanggan[])
      else if (error) console.error("Error fetching", error)
    } catch (e) { console.error(e) }
    finally { setIsLoading(false) }
  }

  const handleOpenModal = (p?: Pelanggan) => {
    if (p) {
      setEditingId(p.id)
      setFormData({ nama: p.nama || "", jenis: p.jenis || "Retail", telepon: p.telepon || "", alamat: p.alamat || "", catatan: p.catatan || "" })
    } else {
      setEditingId(null)
      setFormData({ nama: "", jenis: "Retail", telepon: "", alamat: "", catatan: "" })
    }
    setIsModalOpen(true)
  }

  const handleSave = async () => {
    if (!formData.nama) { alert("Nama wajib diisi!"); return }
    setIsSubmitting(true)
    try {
      if (editingId) {
        const { data, error } = await supabase.from('pelanggan').update(formData).eq('id', editingId).select().single()
        if (error) throw error
        setPelanggan(prev => prev.map(p => p.id === editingId ? data : p))
      } else {
        const { data, error } = await supabase.from('pelanggan').insert(formData).select().single()
        if (error) throw error
        setPelanggan(prev => [...prev, data].sort((a, b) => a.nama.localeCompare(b.nama)))
      }
      setIsModalOpen(false)
    } catch (err: any) { alert("Gagal menyimpan data: " + err.message) }
    finally { setIsSubmitting(false) }
  }

  const handleDelete = async (p: Pelanggan) => {
    if (!confirm(`Hapus pelanggan "${p.nama}"? Tindakan ini tidak bisa dibatalkan.`)) return
    try {
      const { error } = await supabase.from('pelanggan').delete().eq('id', p.id)
      if (error) throw error
      setPelanggan(prev => prev.filter(item => item.id !== p.id))
    } catch (err: any) { alert("Gagal menghapus: " + err.message) }
  }

  const filteredData = useMemo(() => {
    return pelanggan.filter(p => {
      const passTipe = jenisFilter === "Semua" || p.jenis === jenisFilter
      const passSearch = !searchQuery || p.nama.toLowerCase().includes(searchQuery.toLowerCase())
      return passTipe && passSearch
    })
  }, [pelanggan, jenisFilter, searchQuery])

  const counts = useMemo(() => {
    const res: Record<string, number> = { "Retail": 0, "UMKM": 0, "Horeka": 0, "Reseller": 0, "Pemerintah": 0 }
    pelanggan.forEach(p => {
      if (res[p.jenis] !== undefined) res[p.jenis]++
      else res[p.jenis] = 1
    })
    return res
  }, [pelanggan])

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* SUMMARY CARDS */}
      <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
        <div className="bg-[#161b22] border border-white/[0.05] rounded-2xl p-5 min-w-[160px] flex-1">
          <p className="text-sm text-gray-400 mb-1">Semua</p>
          <h3 className="text-3xl font-bold text-white">{pelanggan.length}</h3>
        </div>
        {TIPE_OPTIONS.map(opt => (
          <div key={opt} className="bg-[#161b22] border border-white/[0.05] rounded-2xl p-5 min-w-[160px] flex-1 cursor-pointer hover:bg-white/5 transition-colors"
            onClick={() => setJenisFilter(jenisFilter === opt ? "Semua" : opt)}>
            <p className="text-sm text-gray-400 mb-1">{opt}</p>
            <h3 className="text-3xl font-bold text-green-400">{counts[opt] || 0}</h3>
          </div>
        ))}
      </div>

      {/* TABLE */}
      <div className="bg-[#161b22] border border-white/[0.05] rounded-2xl overflow-hidden shadow-xl">
        <div className="p-5 border-b border-white/[0.05] flex flex-col md:flex-row gap-4 justify-between items-center bg-[#0d1117]/50">
          <div className="flex items-center gap-3 w-full md:w-auto flex-1">
            <div className="relative w-full max-w-sm">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">🔍</span>
              <input type="text" placeholder="Cari nama pelanggan..."
                value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#0d1117] border border-white/10 text-white text-sm rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:border-green-500/50 hover:border-white/20 transition-colors" />
            </div>
            <select value={jenisFilter} onChange={(e) => setJenisFilter(e.target.value)}
              className="bg-[#0d1117] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-green-500/50">
              <option value="Semua">Semua Tipe</option>
              {TIPE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <button onClick={fetchPelanggan}
              className="bg-white/5 hover:bg-white/10 text-white w-full md:w-auto px-4 py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2 border border-white/5">
              🔄 Refresh
            </button>
            <button onClick={() => handleOpenModal()}
              className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white text-sm font-semibold px-5 py-2.5 w-full md:w-auto rounded-xl transition-all shadow-lg shadow-green-900/20">
              <span className="text-base">+</span> Tambah Pelanggan
            </button>
          </div>
        </div>

        <div className="overflow-x-auto min-h-[400px]">
          {isLoading ? (
            <div className="p-12 text-center text-gray-400 flex flex-col items-center">
              <div className="w-8 h-8 border-4 border-green-500/30 border-t-green-500 rounded-full animate-spin mb-4"></div>
              Memuat data pelanggan...
            </div>
          ) : filteredData.length === 0 ? (
            <div className="p-20 text-center text-gray-500 flex flex-col items-center">
              <span className="text-5xl mb-4 grayscale opacity-40">👥</span>
              <p className="text-lg">Tidak ada data pelanggan yang sesuai filter.</p>
            </div>
          ) : (
            <table className="w-full text-left text-sm text-gray-300">
              <thead className="text-xs text-gray-400 uppercase bg-[#0d1117]/80 border-b border-white/[0.05]">
                <tr>
                  <th className="px-6 py-4 font-medium">Nama</th>
                  <th className="px-6 py-4 font-medium">Tipe</th>
                  <th className="px-6 py-4 font-medium">Telepon</th>
                  <th className="px-6 py-4 font-medium">Alamat</th>
                  <th className="px-6 py-4 font-medium">Catatan</th>
                  <th className="px-6 py-4 font-medium text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.02]">
                {filteredData.map((p) => (
                  <tr key={p.id} className="hover:bg-white/[0.01] transition-colors group">
                    <td className="px-6 py-4 font-semibold text-white text-base">{p.nama}</td>
                    <td className="px-6 py-4">
                      <span className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-xs font-medium text-gray-300">
                        {p.jenis || "-"}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-gray-400">{p.telepon || "-"}</td>
                    <td className="px-6 py-4 text-gray-400 max-w-[200px] truncate" title={p.alamat}>{p.alamat || "-"}</td>
                    <td className="px-6 py-4 text-gray-500 max-w-[150px] truncate text-xs italic" title={p.catatan}>{p.catatan || "-"}</td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleOpenModal(p)}
                          className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border border-blue-500/20">
                          Edit ✏️
                        </button>
                        <button onClick={() => handleDelete(p)}
                          className="bg-red-500/10 hover:bg-red-500/20 text-red-400 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border border-red-500/20">
                          Hapus 🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* MODAL */}
      {isModalOpen && (
        <div ref={modalRef} tabIndex={-1} onKeyDown={handleModalKeyDown} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm outline-none">
          <div className="bg-[#161b22] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b border-white/5 bg-black/20">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                {editingId ? "✏️ Edit Pelanggan" : "👤 Tambah Pelanggan"}
              </h3>
              <button onClick={() => !isSubmitting && setIsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400"
                disabled={isSubmitting}>✕</button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4">
              <div className="space-y-1.5">
                <Label className="text-gray-300">Nama Lengkap / Instansi <span className="text-red-500">*</span></Label>
                <Input value={formData.nama} onChange={e => setFormData({ ...formData, nama: e.target.value })}
                  className="bg-[#0d1117] border-white/10 text-white" placeholder="Budi Mulya" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-gray-300">Tipe Pelanggan</Label>
                <select value={formData.jenis} onChange={e => setFormData({ ...formData, jenis: e.target.value })}
                  className="w-full bg-[#0d1117] border border-white/10 text-white rounded-md px-3 py-2 h-10 text-sm focus:outline-none focus:ring-1 focus:ring-green-500">
                  {TIPE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-gray-300">No. Telepon / WhatsApp</Label>
                <Input value={formData.telepon} onChange={e => setFormData({ ...formData, telepon: e.target.value })}
                  className="bg-[#0d1117] border-white/10 text-white" placeholder="0812345678" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-gray-300">Alamat</Label>
                <textarea value={formData.alamat} onChange={e => setFormData({ ...formData, alamat: e.target.value })}
                  className="w-full bg-[#0d1117] border border-white/10 text-white rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500 min-h-[80px]"
                  placeholder="Jl. Merdeka No 45..." />
              </div>
              <div className="space-y-1.5">
                <Label className="text-gray-300">Catatan Khusus</Label>
                <Input value={formData.catatan} onChange={e => setFormData({ ...formData, catatan: e.target.value })}
                  className="bg-[#0d1117] border-white/10 text-white" placeholder="Punya alergi telat bayar..." />
              </div>
            </div>
            <div className="p-6 border-t border-white/5 flex gap-3 bg-black/20 rounded-b-2xl mt-auto">
              <Button onClick={() => setIsModalOpen(false)} disabled={isSubmitting} variant="outline"
                className="flex-1 bg-transparent border-white/10 text-gray-300 hover:bg-white/5">Batal</Button>
              <Button onClick={handleSave} disabled={isSubmitting}
                className="flex-1 bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-900/20">
                {isSubmitting ? "Menyimpan..." : "Simpan Data"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
