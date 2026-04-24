"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { supabase } from "@/utils/supabase/client"

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
  qty: number | string
  keterangan?: string
}

const MIN_PANEL_WIDTH = 350
const MAX_PANEL_WIDTH = 700
const DEFAULT_PANEL_WIDTH = 450

export default function KasirPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [namaPembeli, setNamaPembeli] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<{
    namaPembeli?: string
    cart?: string
    items?: Record<number, { qty?: string; harga?: string }>
  }>({})

  const [customers, setCustomers] = useState<string[]>([])
  const [piutangNames, setPiutangNames] = useState<Set<string>>(new Set())
  const [showSuggestions, setShowSuggestions] = useState(false)

  // Drag-resize state
  const [panelWidth, setPanelWidth] = useState(DEFAULT_PANEL_WIDTH)
  const [isDragging, setIsDragging] = useState(false)
  const dragStartX = useRef(0)
  const dragStartWidth = useRef(DEFAULT_PANEL_WIDTH)

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

    const fetchNoNota = async () => {
      const { data } = await supabase.from('transaksi').select('no_nota').order('created_at', { ascending: false }).limit(1).single()
      if (data && data.no_nota) {
        let lastNum = 0
        if (data.no_nota.startsWith('BJ-')) {
          const parts = data.no_nota.split('-')
          lastNum = parseInt(parts[parts.length - 1], 10)
        } else {
          lastNum = parseInt(data.no_nota, 10)
        }
        setNoNota(isNaN(lastNum) ? "1" : String(lastNum + 1))
      } else {
        setNoNota("1")
      }
    }
    fetchNoNota()

    const today = new Date()
    const tzOffset = today.getTimezoneOffset() * 60000
    const localISOTime = (new Date(today.getTime() - tzOffset)).toISOString().split('T')[0]
    setTanggal(localISOTime)
  }, [])

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragStartX.current = e.clientX
    dragStartWidth.current = panelWidth
    setIsDragging(true)

    const onMouseMove = (ev: MouseEvent) => {
      const delta = dragStartX.current - ev.clientX // dragging left = wider panel
      const newWidth = Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, dragStartWidth.current + delta))
      setPanelWidth(newWidth)
    }

    const onMouseUp = () => {
      setIsDragging(false)
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }, [panelWidth])

  const formatRp = (num: number) => {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(num)
  }

  const getQtyNum = (qty: number | string) => {
    if (qty === "") return 0
    const q = parseFloat(qty as string)
    return isNaN(q) ? 0 : q
  }

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id)
      if (existing) {
        return prev.map((item) => (item.id === product.id ? { ...item, qty: getQtyNum(item.qty) + 1 } : item))
      }
      return [...prev, { id: product.id, nama: product.nama, harga_jual: 0, satuan: product.satuan || "kg", qty: 1, keterangan: "" }]
    })
  }

  const updateQty = (id: number, val: string) => {
    setCart((prev) => prev.map((item) => (item.id === id ? { ...item, qty: val } : item)))
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

  const grandTotal = cart.reduce((acc, item) => acc + (item.harga_jual || 0) * getQtyNum(item.qty), 0)

  const isFormValid = namaPembeli.trim() && 
                      cart.length > 0 && 
                      cart.every(item => getQtyNum(item.qty) > 0 && item.harga_jual > 0)

  const validasi = () => {
    const newErrors: typeof errors = {}
    let valid = true

    if (!namaPembeli.trim()) {
      newErrors.namaPembeli = "Nama pembeli wajib diisi"
      valid = false
    }

    if (cart.length === 0) {
      newErrors.cart = "Tambahkan minimal 1 produk"
      valid = false
    }

    const itemErrors: Record<number, { qty?: string; harga?: string }> = {}
    cart.forEach(item => {
      const itemErr: { qty?: string; harga?: string } = {}
      
      if (!item.qty || getQtyNum(item.qty) <= 0) {
        itemErr.qty = "Qty harus > 0"
        valid = false
      }
      
      if (!item.harga_jual || item.harga_jual <= 0) {
        itemErr.harga = "Harga harus diisi"
        valid = false
      }

      if (Object.keys(itemErr).length > 0) {
        itemErrors[item.id] = itemErr
      }
    })

    if (Object.keys(itemErrors).length > 0) {
      newErrors.items = itemErrors
    }

    setErrors(newErrors)
    return valid
  }

  const handleSimpan = async () => {
    setErrors({})
    if (!validasi()) return

    setIsLoading(true)
    try {
      // 1. Save to transaksi
      const dbTanggal = new Date(tanggal).toISOString()
      const { data: transaksiData, error: transaksiError } = await supabase
        .from('transaksi')
        .insert({
          no_nota: noNota,
          tanggal: dbTanggal,
          nama_pembeli: namaPembeli,
          jenis_pembayaran: null,
          tipe_pengiriman: 'dikirim',
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
        qty: getQtyNum(item.qty),
        harga: item.harga_jual || 0,
        subtotal: (item.harga_jual || 0) * getQtyNum(item.qty),
        keterangan: item.keterangan || null
      }))

      const { error: detailError } = await supabase
        .from('transaksi_detail')
        .insert(detailInserts)

      if (detailError) throw detailError

      // 3. Save to pengiriman
      const { error: pengirimanError } = await supabase
        .from('pengiriman')
        .insert({
          transaksi_id,
          status: 'belum_kirim'
        })

      if (pengirimanError) throw pengirimanError

      alert(`Transaksi Berhasil Disimpan!\n\nNo Nota: ${noNota}`)

      // Reset form
      setCart([])
      setNamaPembeli("")

      // Regenerate No Nota correctly
      const numNoNota = parseInt(noNota, 10)
      if (isNaN(numNoNota)) {
        const fetchNoNota = async () => {
          const { data } = await supabase.from('transaksi').select('no_nota').order('created_at', { ascending: false }).limit(1).single()
          if (data && data.no_nota) {
            let lastNum = 0
            if (data.no_nota.startsWith('BJ-')) {
              const parts = data.no_nota.split('-')
              lastNum = parseInt(parts[parts.length - 1], 10)
            } else {
              lastNum = parseInt(data.no_nota, 10)
            }
            setNoNota(isNaN(lastNum) ? "1" : String(lastNum + 1))
          } else {
            setNoNota("1")
          }
        }
        fetchNoNota()
      } else {
        setNoNota(String(numNoNota + 1))
      }
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
    }
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey && !isLoading && cart.length > 0 && namaPembeli) {
        // cek tidak ada input/select yang sedang fokus (kecuali tombol simpan)
        const activeEl = document.activeElement
        const isInputFocused = activeEl instanceof HTMLInputElement || 
                               activeEl instanceof HTMLSelectElement ||
                               activeEl instanceof HTMLTextAreaElement
        if (!isInputFocused) handleSimpan()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isLoading, cart, namaPembeli]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleCartInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const inputs = Array.from(document.querySelectorAll('.cart-item-input')) as HTMLElement[];
      const index = inputs.indexOf(e.currentTarget);
      if (index > -1 && index < inputs.length - 1) {
        inputs[index + 1].focus();
      } else if (index === inputs.length - 1) {
        e.currentTarget.blur();
      }
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

      <main className={`flex h-[calc(100vh-89px)] ${isDragging ? 'select-none cursor-col-resize' : ''}`}>
        {/* LEFT COLUMN - PRODUCTS GRID */}
        <div className="flex-1 p-8 overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-white text-xl">Daftar Produk</h3>
            <span className="text-sm text-gray-400 bg-white/[0.03] px-3 py-1.5 rounded-lg border border-white/[0.05]">
              Klik untuk menambah ke keranjang
            </span>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {products.length === 0 ? (
              <div className="col-span-full text-center py-12 text-gray-500">Memuat produk...</div>
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

        {/* RESIZE HANDLE */}
        {cart.length > 0 && (
          <div
            onMouseDown={handleDragStart}
            className={`relative flex-shrink-0 w-1.5 cursor-col-resize group z-10 transition-colors
              ${isDragging ? 'bg-green-500/60' : 'bg-white/10 hover:bg-green-500/50'}`}
          >
            {/* Visual dots indicator */}
            <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 flex flex-col items-center justify-center gap-1.5 pointer-events-none">
              {[0,1,2,3,4].map(i => (
                <span key={i} className={`block w-0.5 h-0.5 rounded-full transition-colors ${isDragging ? 'bg-green-300' : 'bg-white/30 group-hover:bg-green-400'}`} />
              ))}
            </div>
          </div>
        )}

        {/* RIGHT COLUMN - TRANSACTION FORM */}
        <div
          className={`bg-[#161b22] shrink-0 border-white/[0.05] overflow-hidden ${
            cart.length > 0 ? 'border-l' : 'w-0 border-l-0'
          }`}
          style={cart.length > 0 ? { width: panelWidth } : undefined}
        >
          <div className="flex flex-col h-full" style={{ width: panelWidth }}>
            <div className="px-6 py-5 border-b border-white/[0.05] bg-black/20 flex justify-between items-center">
              <h3 className="font-bold text-white text-xl flex items-center gap-2">
                <span className="text-green-500">🧾</span> Detail Transaksi
              </h3>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto flex-1">
              {/* Form Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-gray-400 text-sm">No. Nota</Label>
                  <input type="text" value={noNota} onChange={e => setNoNota(e.target.value)} className="bg-[#0d1117] border border-white/10 text-white font-mono rounded-lg px-3 py-2.5 text-sm w-full focus:outline-none focus:border-green-500" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-gray-400 text-sm">Tanggal</Label>
                  <input type="date" value={tanggal} onChange={e => setTanggal(e.target.value)} onClick={(e) => (e.target as HTMLInputElement).showPicker?.()}
                    className="w-full cursor-pointer bg-[#0d1117] border border-white/10 text-white rounded-lg px-3 h-10 text-sm focus:outline-none focus:border-green-500 [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert" />
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
                    if (errors.namaPembeli) setErrors(prev => ({ ...prev, namaPembeli: undefined }))
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      const firstCartInput = document.querySelector('.cart-item-input') as HTMLElement
                      if (firstCartInput) firstCartInput.focus()
                    }
                  }}
                  className={`bg-[#0d1117] text-white text-base h-12 w-full ${errors.namaPembeli ? 'border-red-500/50 focus-visible:ring-red-500/50' : 'border-white/10'}`}
                  autoComplete="off"
                />
                {errors.namaPembeli && (
                  <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                    <span>⚠️</span> {errors.namaPembeli}
                  </p>
                )}
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

            <hr className="border-white/[0.05] my-2" />

            {/* Cart Items */}
            <div className="space-y-3">
              <Label className="text-gray-300 text-base mb-1 block">Daftar Belanjaan</Label>

              {errors.cart && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm flex items-center gap-2">
                  <span>⚠️</span> {errors.cart}
                </div>
              )}

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
                      <div className="flex items-start justify-between gap-3 mt-1">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-400 text-sm mt-1">Rp</span>
                            <Input
                              type="number"
                              min="0"
                              placeholder="Harga..."
                              value={item.harga_jual || ""}
                              onChange={(e) => {
                                updatePrice(item.id, e.target.value)
                                if (errors.items?.[item.id]?.harga) {
                                  setErrors(prev => ({
                                    ...prev,
                                    items: { ...prev.items, [item.id]: { ...prev.items?.[item.id], harga: undefined } }
                                  }))
                                }
                              }}
                              onKeyDown={handleCartInputKeyDown}
                              className={`bg-[#161b22] text-white h-8 w-full min-w-[80px] px-2 text-right text-sm [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none cart-item-input ${errors.items?.[item.id]?.harga ? 'border-red-500/50' : 'border-white/10'}`}
                            />
                          </div>
                          {errors.items?.[item.id]?.harga && (
                            <p className="text-red-400 text-[10px] mt-0.5 ml-6">{errors.items[item.id].harga}</p>
                          )}
                        </div>
                        <span className="text-gray-500 text-xs shrink-0 self-start mt-2">×</span>
                        <div className="shrink-0 flex flex-col items-end">
                          <div className="flex items-center gap-2">
                            <div className={`flex items-center bg-[#161b22] border rounded-md h-8 overflow-hidden ${errors.items?.[item.id]?.qty ? 'border-red-500/50' : 'border-white/10'}`}>
                              <button
                                onClick={() => {
                                  const currentQty = getQtyNum(item.qty);
                                  const val = Math.max(0.1, Number((currentQty - 1).toFixed(1)));
                                  updateQty(item.id, val.toString());
                                  if (errors.items?.[item.id]?.qty) {
                                    setErrors(prev => ({
                                      ...prev,
                                      items: { ...prev.items, [item.id]: { ...prev.items?.[item.id], qty: undefined } }
                                    }))
                                  }
                                }}
                                className="w-7 h-full bg-white/5 hover:bg-white/10 text-gray-300 transition-colors border-r border-white/10 flex items-center justify-center font-medium"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                min="0"
                                step="0.1"
                                value={item.qty}
                                onChange={(e) => {
                                  updateQty(item.id, e.target.value)
                                  if (errors.items?.[item.id]?.qty) {
                                    setErrors(prev => ({
                                      ...prev,
                                      items: { ...prev.items, [item.id]: { ...prev.items?.[item.id], qty: undefined } }
                                    }))
                                  }
                                }}
                                onKeyDown={handleCartInputKeyDown}
                                className="bg-transparent border-none text-white h-full w-14 px-1 text-center text-sm font-semibold focus:outline-none appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none m-0 cart-item-input"
                              />
                              <button
                                onClick={() => {
                                  const currentQty = getQtyNum(item.qty);
                                  const val = Number((currentQty + 1).toFixed(1));
                                  updateQty(item.id, val.toString());
                                  if (errors.items?.[item.id]?.qty) {
                                    setErrors(prev => ({
                                      ...prev,
                                      items: { ...prev.items, [item.id]: { ...prev.items?.[item.id], qty: undefined } }
                                    }))
                                  }
                                }}
                                className="w-7 h-full bg-white/5 hover:bg-white/10 text-gray-300 transition-colors border-l border-white/10 flex items-center justify-center font-medium"
                              >
                                +
                              </button>
                            </div>
                            <span className="text-sm font-medium text-gray-400 w-8">{item.satuan}</span>
                          </div>
                          {errors.items?.[item.id]?.qty && (
                            <p className="text-red-400 text-[10px] mt-0.5">{errors.items[item.id].qty}</p>
                          )}
                        </div>
                      </div>
                      <div className="mt-2">
                        <Input
                          type="text"
                          placeholder="Keterangan (opsional): Giling, Slice dadu, Slice panjang, dll"
                          value={item.keterangan || ""}
                          onChange={(e) => updateKeterangan(item.id, e.target.value)}
                          onKeyDown={handleCartInputKeyDown}
                          className="bg-[#161b22] border-white/10 text-white h-8 text-xs w-full px-2 cart-item-input"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

            {/* Footer Totals & CTA */}
            <div className="p-6 border-t border-white/[0.05] bg-black/20 space-y-4 shadow-[0_-10px_40px_rgba(0,0,0,0.2)] z-10 w-full">
              <div className="flex items-center justify-between pb-2 border-b border-white/5">
                <span className="text-gray-400 text-lg">Subtotal</span>
                <span className="text-white text-lg font-medium">{formatRp(grandTotal)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white text-xl font-medium">Total Akhir</span>
                <span className="text-green-400 text-3xl font-bold tracking-tight">{formatRp(grandTotal)}</span>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    onClick={handleBatal}
                    variant="outline"
                    className="h-14 border-red-500/50 hover:bg-red-500/10 hover:border-red-500 text-red-400 text-base"
                  >
                    Batalkan
                  </Button>
                  <Button
                    onClick={handleSimpan}
                    disabled={isLoading || !isFormValid}
                    className={`h-14 text-base shadow-lg transition-all
                      ${isFormValid
                        ? 'bg-green-600 hover:bg-green-500 text-white shadow-green-900/20' 
                        : 'bg-white/5 text-gray-500 cursor-not-allowed border border-white/10'
                      }`}
                  >
                    {isLoading ? "Menyimpan..." : "Simpan Transaksi"}
                  </Button>
                </div>
                {!isFormValid && !isLoading && (
                  <p className="text-right text-gray-500 text-xs">
                    {!namaPembeli.trim() 
                      ? "⚠️ Isi nama pembeli dulu" 
                      : cart.length === 0 
                        ? "⚠️ Tambahkan produk ke keranjang"
                        : "⚠️ Lengkapi qty dan harga semua produk"}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
