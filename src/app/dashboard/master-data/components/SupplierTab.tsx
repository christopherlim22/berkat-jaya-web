"use client"

import { useState, useEffect, useMemo } from "react"
import { supabase } from "@/utils/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type Supplier = {
  id: number
  nama: string
  kontak: string
  alamat: string
  syarat_pembayaran: string
  catatan: string
  aktif: boolean
}

export function SupplierTab() {
  const [supplier, setSupplier] = useState<Supplier[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formData, setFormData] = useState({
    nama: "", kontak: "", alamat: "", syarat_pembayaran: "tunai", catatan: "", aktif: true
  })

  useEffect(() => { fetchSupplier() }, [])

  const fetchSupplier = async () => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase.from('supplier').select('*').order('nama', { ascending: true })
      if (!error && data) setSupplier(data as Supplier[])
      else if (error) console.error("Error fetching", error)
    } catch (e) { console.error(e) }
    finally { setIsLoading(false) }
  }

  const handleOpenModal = (s?: Supplier) => {
    if (s) {
      setEditingId(s.id)
      setFormData({ nama: s.nama || "", kontak: s.kontak || "", alamat: s.alamat || "", syarat_pembayaran: s.syarat_pembayaran || "tunai", catatan: s.catatan || "", aktif: s.aktif ?? true })
    } else {
      setEditingId(null)
      setFormData({ nama: "", kontak: "", alamat: "", syarat_pembayaran: "tunai", catatan: "", aktif: true })
    }
    setIsModalOpen(true)
  }

  const handleSave = async () => {
    if (!formData.nama) { alert("Nama wajib diisi!"); return }
    setIsSubmitting(true)
    try {
      if (editingId) {
        const { data, error } = await supabase.from('supplier').update(formData).eq('id', editingId).select().single()
        if (error) throw error
        setSupplier(prev => prev.map(s => s.id === editingId ? data : s))
      } else {
        const { data, error } = await supabase.from('supplier').insert(formData).select().single()
        if (error) throw error
        setSupplier(prev => [...prev, data].sort((a, b) => a.nama.localeCompare(b.nama)))
      }
      setIsModalOpen(false)
    } catch (err: any) { alert("Gagal menyimpan data: " + err.message) }
    finally { setIsSubmitting(false) }
  }

  const handleDelete = async (s: Supplier) => {
    if (!confirm(`Hapus supplier "${s.nama}"? Tindakan ini tidak bisa dibatalkan.`)) return
    try {
      const { error } = await supabase.from('supplier').delete().eq('id', s.id)
      if (error) throw error
      setSupplier(prev => prev.filter(item => item.id !== s.id))
    } catch (err: any) { alert("Gagal menghapus: " + err.message) }
  }

  const filteredData = useMemo(() => {
    return supplier.filter(s => !searchQuery || s.nama.toLowerCase().includes(searchQuery.toLowerCase()))
  }, [supplier, searchQuery])

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="bg-[#161b22] border border-white/[0.05] rounded-2xl overflow-hidden shadow-xl">
        <div className="p-5 border-b border-white/[0.05] flex flex-col md:flex-row gap-4 justify-between items-center bg-[#0d1117]/50">
          <div className="flex items-center gap-3 w-full md:w-auto flex-1">
            <div className="relative w-full max-w-sm">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">🔍</span>
              <input type="text" placeholder="Cari nama supplier..."
                value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#0d1117] border border-white/10 text-white text-sm rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:border-green-500/50 hover:border-white/20 transition-colors" />
            </div>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <button onClick={fetchSupplier}
              className="bg-white/5 hover:bg-white/10 text-white w-full md:w-auto px-4 py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2 border border-white/5">
              🔄 Refresh
            </button>
            <button onClick={() => handleOpenModal()}
              className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white text-sm font-semibold px-5 py-2.5 w-full md:w-auto rounded-xl transition-all shadow-lg shadow-green-900/20">
              <span className="text-base">+</span> Tambah Supplier
            </button>
          </div>
        </div>

        <div className="overflow-x-auto min-h-[400px]">
          {isLoading ? (
            <div className="p-12 text-center text-gray-400 flex flex-col items-center">
              <div className="w-8 h-8 border-4 border-green-500/30 border-t-green-500 rounded-full animate-spin mb-4"></div>
              Memuat data supplier...
            </div>
          ) : filteredData.length === 0 ? (
            <div className="p-20 text-center text-gray-500 flex flex-col items-center">
              <span className="text-5xl mb-4 grayscale opacity-40">🏭</span>
              <p className="text-lg">Tidak ada data supplier yang sesuai.</p>
            </div>
          ) : (
            <table className="w-full text-left text-sm text-gray-300">
              <thead className="text-xs text-gray-400 uppercase bg-[#0d1117]/80 border-b border-white/[0.05]">
                <tr>
                  <th className="px-6 py-4 font-medium">Nama</th>
                  <th className="px-6 py-4 font-medium">Kontak</th>
                  <th className="px-6 py-4 font-medium">Syarat Bayar</th>
                  <th className="px-6 py-4 font-medium">Alamat</th>
                  <th className="px-6 py-4 font-medium">Catatan</th>
                  <th className="px-6 py-4 font-medium text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.02]">
                {filteredData.map((s) => (
                  <tr key={s.id} className="hover:bg-white/[0.01] transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-semibold text-white text-base">{s.nama}</span>
                        {!s.aktif && <span className="text-red-400 text-[10px] uppercase font-bold mt-1">Nonaktif</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-gray-400">{s.kontak || "-"}</td>
                    <td className="px-6 py-4">
                      {s.syarat_pembayaran === 'tempo' ? (
                        <span className="text-orange-400 text-xs font-semibold px-2 py-1 bg-orange-500/10 rounded border border-orange-500/20 capitalize">{s.syarat_pembayaran}</span>
                      ) : (
                        <span className="text-green-400 text-xs font-semibold px-2 py-1 bg-green-500/10 rounded border border-green-500/20 capitalize">{s.syarat_pembayaran}</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-400 max-w-[200px] truncate" title={s.alamat}>{s.alamat || "-"}</td>
                    <td className="px-6 py-4 text-gray-500 max-w-[150px] truncate text-xs italic">{s.catatan || "-"}</td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleOpenModal(s)}
                          className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border border-blue-500/20">
                          Edit ✏️
                        </button>
                        <button onClick={() => handleDelete(s)}
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

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#161b22] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b border-white/5 bg-black/20">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                {editingId ? "✏️ Edit Supplier" : "🏭 Tambah Supplier"}
              </h3>
              <button onClick={() => !isSubmitting && setIsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400"
                disabled={isSubmitting}>✕</button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4">
              <div className="space-y-1.5">
                <Label className="text-gray-300">Nama Supplier <span className="text-red-500">*</span></Label>
                <Input value={formData.nama} onChange={e => setFormData({ ...formData, nama: e.target.value })}
                  className="bg-[#0d1117] border-white/10 text-white" placeholder="CV. Aulia Madina" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-gray-300">Kontak (Telepon/WA)</Label>
                <Input value={formData.kontak} onChange={e => setFormData({ ...formData, kontak: e.target.value })}
                  className="bg-[#0d1117] border-white/10 text-white" placeholder="0812345678" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-gray-300">Alamat</Label>
                <textarea value={formData.alamat} onChange={e => setFormData({ ...formData, alamat: e.target.value })}
                  className="w-full bg-[#0d1117] border border-white/10 text-white rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500 min-h-[60px]"
                  placeholder="Alamat lengkap..." />
              </div>
              <div className="space-y-1.5">
                <Label className="text-gray-300">Syarat Pembayaran</Label>
                <select value={formData.syarat_pembayaran} onChange={e => setFormData({ ...formData, syarat_pembayaran: e.target.value })}
                  className="w-full bg-[#0d1117] border border-white/10 text-white rounded-md px-3 py-2 h-10 text-sm focus:outline-none focus:ring-1 focus:ring-green-500">
                  <option value="tunai">Tunai</option>
                  <option value="tempo">Tempo</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-gray-300">Catatan Khusus</Label>
                <Input value={formData.catatan} onChange={e => setFormData({ ...formData, catatan: e.target.value })}
                  className="bg-[#0d1117] border-white/10 text-white" placeholder="Batas order jam 10 pagi..." />
              </div>
              <div className="flex items-center justify-between py-2 border-t border-white/5 mt-4">
                <div>
                  <Label className="text-white text-base">Status Aktif</Label>
                  <p className="text-xs text-gray-500">Supplier dapat dipilih di transaksi</p>
                </div>
                <div className={`w-12 h-6 rounded-full relative cursor-pointer transition-colors ${formData.aktif ? 'bg-green-500' : 'bg-gray-600'}`}
                  onClick={() => setFormData({ ...formData, aktif: !formData.aktif })}>
                  <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${formData.aktif ? 'right-1' : 'left-1'}`} />
                </div>
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
