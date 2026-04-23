"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { supabase } from "@/utils/supabase/client"

export default function PengaturanPage() {
  const [isResetting, setIsResetting] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [inputPassword, setInputPassword] = useState("")
  const [modalError, setModalError] = useState("")

  const handleOpenModal = () => {
    setShowModal(true)
    setInputPassword("")
    setModalError("")
  }

  const handleConfirmReset = async () => {
    if (!inputPassword) return
    setIsResetting(true)
    setModalError("")
    
    try {
      const { data } = await supabase.from('pengaturan').select('value').eq('key', 'reset_password').single()
      const savedPassword = data?.value || "BerkatJaya2024"
      
      if (inputPassword !== savedPassword) {
        setModalError("Password salah. Coba lagi.")
        setIsResetting(false)
        return
      }

      await supabase.from('transaksi_detail').delete().neq('id', 0)
      await supabase.from('pengiriman').delete().neq('id', 0)
      await supabase.from('transaksi').delete().neq('id', 0)
      await supabase.from('pesanan_detail').delete().neq('id', 0)
      await supabase.from('pesanan').delete().neq('id', 0)
      await supabase.from('piutang').delete().neq('id', 0)
      await supabase.from('utang_supplier').delete().neq('id', 0)
      await supabase.from('hpp').delete().neq('id', 0)
      await supabase.from('opname').delete().neq('id', 0)
      await supabase.from('pengeluaran').delete().neq('id', 0)
      await supabase.from('stok_awal').delete().neq('id', 0)

      setShowModal(false)
      alert("Reset berhasil! Semua data transaksi telah dihapus. Master data produk, pelanggan, dan supplier tetap ada.")
    } catch (error) {
      console.error("Gagal reset data:", error)
      setModalError("Terjadi kesalahan saat menghapus data.")
    } finally {
      setIsResetting(false)
    }
  }



  return (
    <>
      <header className="sticky top-0 z-10 flex items-center justify-between px-8 py-5 bg-[#0d1117]/80 backdrop-blur border-b border-white/[0.05]">
        <div>
          <h2 className="text-2xl font-bold text-white">Pengaturan</h2>
          <p className="text-sm text-gray-500 mt-0.5">Kelola preferensi dan sistem akun Anda</p>
        </div>
      </header>

      <main className="p-8 max-w-4xl space-y-8">
        {/* Profile Settings */}
        <div className="bg-[#161b22] border border-white/[0.06] rounded-2xl overflow-hidden">
          <div className="px-7 py-5 border-b border-white/[0.06]">
            <h3 className="font-bold text-white text-lg">Profil Admin</h3>
            <p className="text-sm text-gray-400 mt-1">Perbarui detail akun admin Anda</p>
          </div>
          <div className="p-7 space-y-6">
            <div className="flex items-center gap-6">
              <div className="w-20 h-20 rounded-full bg-green-600 flex items-center justify-center text-2xl font-bold text-white">
                AD
              </div>
              <Button variant="outline" className="text-sm border-white/10 hover:bg-white/5 text-white">
                Ganti Foto
              </Button>
            </div>
            
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-gray-300 text-base">Nama Lengkap</Label>
                <Input defaultValue="Admin Utama" className="bg-[#0d1117] border-white/10 text-white px-4 py-6 text-base" />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300 text-base">Email</Label>
                <Input defaultValue="admin@berkatjaya.id" type="email" className="bg-[#0d1117] border-white/10 text-white px-4 py-6 text-base" />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300 text-base">Nomor Telepon</Label>
                <Input defaultValue="0812-3456-7890" className="bg-[#0d1117] border-white/10 text-white px-4 py-6 text-base" />
              </div>
            </div>
            
            <div className="pt-4 border-t border-white/[0.06] flex justify-end">
              <Button className="bg-green-600 hover:bg-green-500 text-white text-base px-6 py-5">
                Simpan Perubahan
              </Button>
            </div>
          </div>
        </div>

        {/* System Settings */}
        <div className="bg-[#161b22] border border-white/[0.06] rounded-2xl overflow-hidden">
          <div className="px-7 py-5 border-b border-white/[0.06]">
            <h3 className="font-bold text-white text-lg">Preferensi Sistem</h3>
            <p className="text-sm text-gray-400 mt-1">Atur manajemen operasional sistem</p>
          </div>
          <div className="p-7 space-y-6">
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-lg font-medium text-white">Notifikasi Suara</p>
                <p className="text-sm text-gray-500 mt-1">Bunyikan notifikasi ketika ada pesanan baru</p>
              </div>
              <div className="w-12 h-6 bg-green-500 rounded-full relative cursor-pointer">
                <div className="w-4 h-4 bg-white rounded-full absolute right-1 top-1" />
              </div>
            </div>
            <div className="flex items-center justify-between py-2 border-t border-white/[0.06]">
              <div>
                <p className="text-lg font-medium text-white">Laporan Harian Otomatis</p>
                <p className="text-sm text-gray-500 mt-1">Kirim ringkasan laporan ke email setiap pukul 20:00</p>
              </div>
              <div className="w-12 h-6 bg-green-500 rounded-full relative cursor-pointer">
                <div className="w-4 h-4 bg-white rounded-full absolute right-1 top-1" />
              </div>
            </div>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="bg-red-500/5 border border-red-500/20 rounded-2xl overflow-hidden">
          <div className="px-7 py-5 border-b border-red-500/20">
            <h3 className="font-bold text-red-400 text-lg flex items-center gap-2">
              ⚠️ Reset Data Sistem
            </h3>
            <p className="text-sm text-red-400/80 mt-1">Hapus semua data transaksi, piutang, stok, pengeluaran, dan pengiriman. Master data produk, pelanggan, dan supplier tetap dipertahankan.</p>
          </div>
          <div className="p-7">
            <Button 
              onClick={handleOpenModal}
              disabled={isResetting}
              className="bg-red-600 hover:bg-red-500 text-white text-base px-6 py-5 w-full sm:w-auto flex items-center gap-2"
            >
              🗑️ Reset Semua Data Transaksi
            </Button>
          </div>
        </div>
      </main>

      {/* MODAL VERIFIKASI RESET DATA */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#161b22] border border-red-500/30 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-white/[0.05]">
              <h3 className="text-xl font-bold text-red-400">⚠️ Konfirmasi Reset Data</h3>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-gray-300 text-sm">Tindakan ini akan menghapus semua data transaksi secara permanen dan tidak bisa dibatalkan.</p>
              
              <div className="space-y-2">
                <Input 
                  type="password" 
                  placeholder="Masukkan password admin" 
                  value={inputPassword}
                  onChange={e => setInputPassword(e.target.value)}
                  className="bg-[#0d1117] border-white/10 text-white"
                />
                {modalError && <p className="text-red-400 text-xs mt-1">{modalError}</p>}
              </div>
            </div>
            <div className="px-6 py-4 bg-black/20 flex justify-end gap-3 border-t border-white/[0.05]">
              <Button variant="ghost" onClick={() => setShowModal(false)} disabled={isResetting} className="hover:bg-white/5 text-gray-300">
                Batal
              </Button>
              <Button 
                onClick={handleConfirmReset} 
                disabled={!inputPassword || isResetting} 
                className="bg-red-600 hover:bg-red-500 text-white"
              >
                {isResetting ? "Menghapus..." : "Konfirmasi Reset"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
