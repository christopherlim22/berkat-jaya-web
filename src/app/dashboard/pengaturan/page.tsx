import type { Metadata } from "next"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

export const metadata: Metadata = {
  title: "Pengaturan | Berkat Jaya",
}

export default function PengaturanPage() {
  return (
    <>
      <header className="sticky top-0 z-10 flex items-center justify-between px-8 py-5 bg-[#0d1117]/80 backdrop-blur border-b border-white/[0.05]">
        <div>
          <h2 className="text-2xl font-bold text-white">Pengaturan</h2>
          <p className="text-sm text-gray-500 mt-0.5">Kelola preferensi dan sistem akun Anda</p>
        </div>
      </header>

      <main className="p-8 max-w-4xl">
        {/* Profile Settings */}
        <div className="bg-[#161b22] border border-white/[0.06] rounded-2xl overflow-hidden mb-8">
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
      </main>
    </>
  )
}
