"use client"

import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"

type Product = {
  id: number
  nama: string
  harga_jual: number
  harga_beli: number
  satuan: string
  aktif: boolean
  icon?: string
}

type CartItem = {
  id: number
  nama: string
  harga_jual: number
  satuan: string
  qty: number
  keterangan?: string
}

export default function KasirPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [namaPembeli, setNamaPembeli] = useState("")
  const [pembayaran, setPembayaran] = useState("Tunai")
  const [isLoading, setIsLoading] = useState(false)

  const [customers, setCustomers] = useState<string[]>([])
  const [piutangNames, setPiutangNames] = useState<Set<string>>(new Set())
  const [showSuggestions, setShowSuggestions] = useState(false)

  // Auto-generate No. Nota and Tanggal only on client side to avoid hydration mismatch
  const [noNota, setNoNota] = useState("")
  const [tanggal, setTanggal] = useState("")

  useEffect(() => {
    const fetchProducts = async () => {
      const { data, error } = await supabase.from('produk').select('*')
      if (error) {
        console.error("Error fetching products:", error)
      } else if (data) {
        setProducts(data as Product[])
      }
    }
    fetchProducts()

    const fetchPelanggan = async () => {
      const { data } = await supabase.from('pelanggan').select('nama')
      if (data) setCustomers(data.map(d => d.nama))
    }
    fetchPelanggan()

    const fetchPiutangAlerts = async () => {
      const { data } = await supabase.from('piutang').select('nama_pembeli').eq('status', 'belum lunas')
      if (data) {
        const names = new Set<string>()
        data.forEach(d => names.add(d.nama_pembeli.toLowerCase()))
        setPiutangNames(names)
      }
    }
    fetchPiutangAlerts()

    const today = new Date()
    const yyyy = today.getFullYear()
    const mm = String(today.getMonth() + 1).padStart(2, "0")
    const dd = String(today.getDate()).padStart(2, "0")
    const randSequence = String(Math.floor(Math.random() * 999) + 1).padStart(3, "0")
    setNoNota(`BJ-${yyyy}${mm}${dd}-${randSequence}`)
    setTanggal(today.toLocaleDateString("id-ID", { year: "numeric", month: "long", day: "numeric" }))
  }, [])

  const formatRp = (num: number) => {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(num)
  }

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id)
      if (existing) {
        return prev.map((item) => (item.id === product.id ? { ...item, qty: item.qty + 1 } : item))
      }
      return [...prev, { id: product.id, nama: product.nama, harga_jual: 0, satuan: product.satuan || "kg", qty: 1, keterangan: "" }]
    })
  }

  const updateQty = (id: number, val: string) => {
    const newQty = parseFloat(val)
    if (isNaN(newQty) || newQty < 0) return

    setCart((prev) => prev.map((item) => (item.id === id ? { ...item, qty: newQty } : item)))
  }

  const updatePrice = (id: number, val: string) => {
    const newPrice = parseFloat(val)
    setCart((prev) => prev.map((item) => (item.id === id ? { ...item, harga_jual: isNaN(newPrice) ? 0 : newPrice } : item)))
  }

  const updateKeterangan = (id: number, val: string) => {
    setCart((prev) => prev.map((item) => (item.id === id ? { ...item, keterangan: val } : item)))
  }

  const removeItem = (id: number) => {
    setCart((prev) => prev.filter((item) => item.id !== id))
  }

  const grandTotal = cart.reduce((acc, item) => acc + (item.harga_jual || 0) * item.qty, 0)

  const handleSimpan = async () => {
    if (cart.length === 0) {
      alert("Keranjang masih kosong!")
      return
    }
    if (!namaPembeli) {
      alert("Mohon isi Nama Pembeli!")
      return
    }
    
    setIsLoading(true)
    try {
      // 1. Save to transaksi
      const dbTanggal = new Date().toISOString()
      const { data: transaksiData, error: transaksiError } = await supabase
        .from('transaksi')
        .insert({
          no_nota: noNota,
          tanggal: dbTanggal,
          nama_pembeli: namaPembeli,
          jenis_pembayaran: pembayaran,
          total: grandTotal
        })
        .select()
        .single()

      if (transaksiError) throw transaksiError

      const transaksi_id = transaksiData.id

      // 2. Save to transaksi_detail
      const detailInserts = cart.map((item) => ({
        transaksi_id,
        nama_produk: item.nama,
        qty: item.qty,
        harga: item.harga_jual || 0,
        subtotal: (item.harga_jual || 0) * item.qty,
        keterangan: item.keterangan || null
      }))

      const { error: detailError } = await supabase
        .from('transaksi_detail')
        .insert(detailInserts)

      if (detailError) throw detailError

      // 3. Save to piutang if needed
      if (pembayaran === 'Piutang') {
        const { error: piutangError } = await supabase
          .from('piutang')
          .insert({
            no_nota: noNota,
            tanggal: dbTanggal,
            nama_pembeli: namaPembeli,
            total: grandTotal,
            sisa: grandTotal,
            status: 'belum lunas'
          })

        if (piutangError) throw piutangError
      }

      alert(`Transaksi Berhasil Disimpan!\n\nNo Nota: ${noNota}`)
      
      // Reset form
      setCart([])
      setNamaPembeli("")
      setPembayaran("Tunai")
      
      // Regenerate No Nota correctly
      const randSequence = String(Math.floor(Math.random() * 999) + 1).padStart(3, "0")
      const today = new Date()
      const yyyy = today.getFullYear()
      const mm = String(today.getMonth() + 1).padStart(2, "0")
      const dd = String(today.getDate()).padStart(2, "0")
      setNoNota(`BJ-${yyyy}${mm}${dd}-${randSequence}`)
    } catch (error: any) {
      console.error("Error saving transaction:", error)
      alert(`Gagal menyimpan transaksi: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleBatal = () => {
    if (confirm("Apakah Anda yakin ingin membatalkan transaksi ini?")) {
      setCart([])
      setNamaPembeli("")
      setPembayaran("Tunai")
    }
  }

  return (
    <>
      <header className="sticky top-0 z-10 flex items-center justify-between px-8 py-5 bg-[#0d1117]/80 backdrop-blur border-b border-white/[0.05]">
        <div>
          <h2 className="text-2xl font-bold text-white">Kasir (Point of Sale)</h2>
          <p className="text-sm text-gray-500 mt-0.5">Lakukan transaksi penjualan langsung secara cepat</p>
        </div>
      </header>

      <main className="flex h-[calc(100vh-89px)]">
        {/* LEFT COLUMN - PRODUCTS GRID */}
        <div className="flex-1 p-8 overflow-y-auto border-r border-white/[0.05]">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-white text-xl">Daftar Produk</h3>
            <span className="text-sm text-gray-400 bg-white/[0.03] px-3 py-1.5 rounded-lg border border-white/[0.05]">
              Klik untuk menambah ke keranjang
            </span>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {products.length === 0 ? (
              <div className="col-span-3 text-center py-12 text-gray-500">Memuat produk...</div>
            ) : (
              products.map((prod) => (
                <button
                  key={prod.id}
                  onClick={() => addToCart(prod)}
                  className="flex flex-col items-center justify-center bg-[#161b22] border border-white/[0.06] rounded-2xl p-6 hover:border-green-500/40 hover:bg-green-500/5 transition-all text-center group"
                >
                  <span className="text-5xl mb-4 group-hover:scale-110 transition-transform">{prod.icon || "📦"}</span>
                  <p className="text-lg font-bold text-white leading-tight mb-1">{prod.nama}</p>
                  <p className="text-sm text-gray-400 font-medium capitalize">{prod.satuan || "kg"}</p>
                </button>
              ))
            )}
          </div>
        </div>

        {/* RIGHT COLUMN - TRANSACTION FORM */}
        <div className="w-[450px] bg-[#161b22] flex flex-col shrink-0">
          <div className="px-6 py-5 border-b border-white/[0.05] bg-black/20">
            <h3 className="font-bold text-white text-xl flex items-center gap-2">
              <span className="text-green-500">🧾</span> Detail Transaksi
            </h3>
          </div>

          <div className="p-6 space-y-5 overflow-y-auto flex-1">
            {/* Form Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-gray-400 text-sm">No. Nota</Label>
                <p className="text-white font-mono bg-[#0d1117] border border-white/5 px-3 py-2.5 rounded-lg text-sm">{noNota || "Memuat..."}</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-gray-400 text-sm">Tanggal</Label>
                <p className="text-white bg-[#0d1117] border border-white/5 px-3 py-2.5 rounded-lg text-sm truncate">{tanggal || "Memuat..."}</p>
              </div>
            </div>

            <div className="space-y-1.5 relative">
              <Label className="text-gray-300 text-base">Nama Pembeli</Label>
              <div className="relative">
                <Input
                  placeholder="Masukkan nama pelanggan"
                  value={namaPembeli}
                  onChange={(e) => {
                    setNamaPembeli(e.target.value)
                    setShowSuggestions(true)
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  className="bg-[#0d1117] border-white/10 text-white text-base h-12 w-full"
                  autoComplete="off"
                />
                {showSuggestions && namaPembeli.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-[#161b22] border border-white/10 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                    {customers
                      .filter(c => c.toLowerCase().includes(namaPembeli.toLowerCase()))
                      .map((c, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          setNamaPembeli(c)
                          setShowSuggestions(false)
                        }}
                        className="w-full text-left px-4 py-2.5 text-white hover:bg-white/10 transition-colors"
                      >
                        {c}
                      </button>
                    ))}
                    {customers.filter(c => c.toLowerCase().includes(namaPembeli.toLowerCase())).length === 0 && (
                      <div className="px-4 py-2.5 text-gray-500 text-sm">Ketikan nama pembeli baru...</div>
                    )}
                  </div>
                )}
              </div>
              {namaPembeli && piutangNames.has(namaPembeli.toLowerCase()) && (
                <div className="mt-1 flex items-center gap-1.5">
                  <span className="bg-red-500/10 text-red-500 px-2.5 py-0.5 rounded-md text-xs font-extrabold border border-red-500/20">
                    ⚠️ Ada piutang belum lunas
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-gray-300 text-base">Jenis Pembayaran</Label>
              <select
                value={pembayaran}
                onChange={(e) => setPembayaran(e.target.value)}
                className="w-full flex h-12 rounded-md border border-white/10 bg-[#0d1117] px-3 py-2 text-base text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d1117]"
              >
                <option value="Tunai">💵 Tunai (Cash)</option>
                <option value="Transfer">💳 Transfer Bank / QRIS</option>
                <option value="Piutang">📝 Piutang (Kredit)</option>
              </select>
            </div>

            <hr className="border-white/[0.05] my-2" />

            {/* Cart Items */}
            <div className="space-y-3">
              <Label className="text-gray-300 text-base mb-1 block">Daftar Belanjaan</Label>
              
              {cart.length === 0 ? (
                <div className="text-center py-8 bg-[#0d1117] border border-white/5 rounded-xl border-dashed">
                  <span className="text-3xl grayscale opacity-50 block mb-2">🛒</span>
                  <p className="text-gray-500 text-sm">Keranjang masih kosong</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {cart.map((item) => (
                    <div key={item.id} className="bg-[#0d1117] border border-white/[0.06] rounded-xl p-3 flex flex-col gap-2 relative group">
                      <button 
                        onClick={() => removeItem(item.id)}
                        className="absolute -top-2 -right-2 bg-red-500 text-white w-6 h-6 rounded-full text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                      >
                        ✕
                      </button>
                      <div className="flex items-start justify-between">
                        <p className="font-semibold text-white text-base leading-tight">{item.nama}</p>
                        <p className="text-base text-white font-medium">{formatRp((item.harga_jual || 0) * item.qty)}</p>
                      </div>
                      <div className="flex items-center justify-between gap-3 mt-1">
                        <div className="flex items-center gap-2 flex-1">
                          <span className="text-gray-400 text-sm">Rp</span>
                          <Input
                            type="number"
                            min="0"
                            placeholder="Harga..."
                            value={item.harga_jual || ""}
                            onChange={(e) => updatePrice(item.id, e.target.value)}
                            className="bg-[#161b22] border-white/10 text-white h-8 w-full min-w-[80px] px-2 text-right text-sm [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                          />
                        </div>
                        <span className="text-gray-500 text-xs">×</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="flex items-center bg-[#161b22] border border-white/10 rounded-md h-8 overflow-hidden">
                            <button
                              onClick={() => {
                                const currentQty = item.qty || 0;
                                const val = Math.max(0.1, Number((currentQty - 1).toFixed(1)));
                                updateQty(item.id, val.toString());
                              }}
                              className="w-7 h-full bg-white/5 hover:bg-white/10 text-gray-300 transition-colors border-r border-white/10 flex items-center justify-center font-medium"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min="0.1"
                              step="0.1"
                              value={item.qty || ""}
                              onChange={(e) => updateQty(item.id, e.target.value)}
                              className="bg-transparent border-none text-white h-full w-14 px-1 text-center text-sm font-semibold focus:outline-none appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none m-0"
                            />
                            <button
                              onClick={() => {
                                const currentQty = item.qty || 0;
                                const val = Number((currentQty + 1).toFixed(1));
                                updateQty(item.id, val.toString());
                              }}
                              className="w-7 h-full bg-white/5 hover:bg-white/10 text-gray-300 transition-colors border-l border-white/10 flex items-center justify-center font-medium"
                            >
                              +
                            </button>
                          </div>
                          <span className="text-sm font-medium text-gray-400">{item.satuan}</span>
                        </div>
                      </div>
                      <div className="mt-2">
                        <Input
                          type="text"
                          placeholder="Keterangan (opsional): Giling, Slice dadu, Slice panjang, dll"
                          value={item.keterangan || ""}
                          onChange={(e) => updateKeterangan(item.id, e.target.value)}
                          className="bg-[#161b22] border-white/10 text-white h-8 text-xs w-full px-2"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Footer Totals & CTA */}
          <div className="p-6 border-t border-white/[0.05] bg-black/20 space-y-4 shadow-[0_-10px_40px_rgba(0,0,0,0.2)] z-10">
            <div className="flex items-center justify-between pb-2 border-b border-white/5">
              <span className="text-gray-400 text-lg">Subtotal</span>
              <span className="text-white text-lg font-medium">{formatRp(grandTotal)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white text-xl font-medium">Total Akhir</span>
              <span className="text-green-400 text-3xl font-bold tracking-tight">{formatRp(grandTotal)}</span>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <Button 
                onClick={handleBatal}
                variant="outline" 
                className="h-14 border-red-500/50 hover:bg-red-500/10 hover:border-red-500 text-red-400 text-base"
              >
                Batalkan
              </Button>
              <Button 
                onClick={handleSimpan}
                disabled={isLoading}
                className="h-14 bg-green-600 hover:bg-green-500 text-white text-base shadow-lg shadow-green-900/20"
              >
                {isLoading ? "Menyimpan..." : "Simpan Transaksi"}
              </Button>
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
