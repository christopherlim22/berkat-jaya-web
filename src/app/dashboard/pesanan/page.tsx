"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/utils/supabase/client"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"

type TabType = 'pesanan' | 'pengiriman'
type SubTabPesanan = 'Hari Ini' | 'Akan Datang' | 'History'
type SubTabPengiriman = 'Belum Kirim' | 'Terkirim' | 'Nota Kembali' | 'Semua'

export default function PesananPengirimanPage() {
  const [activeTab, setActiveTab] = useState<TabType>('pengiriman')
  const [activeSubTabPesanan, setActiveSubTabPesanan] = useState<SubTabPesanan>('Hari Ini')
  const [activeSubTabPengiriman, setActiveSubTabPengiriman] = useState<SubTabPengiriman>('Belum Kirim')
  const [filterDatePesanan, setFilterDatePesanan] = useState(new Date().toISOString().split('T')[0])
  const [filterDatePengiriman, setFilterDatePengiriman] = useState(new Date().toISOString().split('T')[0])
  
  // Data states
  const [pesanan, setPesanan] = useState<any[]>([])
  const [pengiriman, setPengiriman] = useState<any[]>([])
  const [pelanggan, setPelanggan] = useState<any[]>([])
  const [produk, setProduk] = useState<any[]>([])
  
  // Modal Tambah Pesanan
  const [showAddModal, setShowAddModal] = useState(false)
  const [namaPembeli, setNamaPembeli] = useState("")
  const [tanggalKirim, setTanggalKirim] = useState(new Date().toISOString().split('T')[0])
  const [catatan, setCatatan] = useState("")
  const [cart, setCart] = useState<any[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)

  // Modal Proses
  const [showProsesModal, setShowProsesModal] = useState(false)
  const [selectedPesanan, setSelectedPesanan] = useState<any>(null)

  useEffect(() => {
    fetchMasterData()
  }, [])

  useEffect(() => {
    if (activeTab === 'pesanan') fetchPesanan()
    else fetchPengiriman()
  }, [activeTab, activeSubTabPesanan, activeSubTabPengiriman, filterDatePesanan, filterDatePengiriman])

  const fetchMasterData = async () => {
    const { data: pelData } = await supabase.from('pelanggan').select('nama')
    if (pelData) setPelanggan(pelData)
    const { data: prodData } = await supabase.from('produk').select('*')
    if (prodData) setProduk(prodData)
  }

  const fetchPesanan = async () => {
    let query = supabase.from('pesanan').select('*, pesanan_detail(*)')
    
    const tzOffset = new Date().getTimezoneOffset() * 60000
    const todayLocal = new Date(Date.now() - tzOffset).toISOString().split('T')[0]

    if (activeSubTabPesanan === 'Hari Ini') {
      query = query.gte('tanggal_kirim', todayLocal + 'T00:00:00.000Z')
                   .lte('tanggal_kirim', todayLocal + 'T23:59:59.999Z')
                   .in('status', ['menunggu', 'diproses'])
    } else if (activeSubTabPesanan === 'Akan Datang') {
      query = query.gt('tanggal_kirim', todayLocal + 'T23:59:59.999Z')
                   .in('status', ['menunggu', 'diproses'])
    } else if (activeSubTabPesanan === 'History') {
      query = query.in('status', ['selesai', 'batal'])
    }

    const { data } = await query.order('tanggal_kirim', { ascending: true })
    if (data) setPesanan(data)
  }

  const fetchPengiriman = async () => {
    // Need to join with transaksi
    let query = supabase.from('pengiriman').select('*, transaksi(*)')
    
    if (activeSubTabPengiriman === 'Belum Kirim') {
      query = query.eq('status', 'belum_kirim')
    } else if (activeSubTabPengiriman === 'Terkirim') {
      query = query.eq('status', 'terkirim')
    } else if (activeSubTabPengiriman === 'Nota Kembali') {
      query = query.eq('status', 'nota_kembali')
    }

    const { data } = await query.order('created_at', { ascending: false })
    if (data) setPengiriman(data)
  }

  const formatRp = (num: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(num)

  // Add Item to Form
  const addCartItem = () => setCart([...cart, { produk_id: null, qty: 1, harga: 0, subtotal: 0 }])
  const removeCartItem = (idx: number) => setCart(cart.filter((_, i) => i !== idx))
  const updateCartItem = (idx: number, field: string, val: any) => {
    const newCart = [...cart]
    newCart[idx][field] = val
    if (field === 'produk_id') {
      const p = produk.find(x => x.id === parseInt(val))
      if (p) newCart[idx].harga = p.harga_jual || 0
    }
    newCart[idx].subtotal = newCart[idx].qty * newCart[idx].harga
    setCart(newCart)
  }
  
  const grandTotal = cart.reduce((acc, c) => acc + c.subtotal, 0)

  const handleSimpanPesanan = async () => {
    if (!namaPembeli || cart.length === 0) return alert("Lengkapi data")
    
    // Auto-generate No. Pesanan
    const randSeq = String(Math.floor(Math.random() * 999) + 1).padStart(3, "0")
    const d = new Date()
    const no_pesanan = `PO-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${randSeq}`

    const { data, error } = await supabase.from('pesanan').insert({
      no_pesanan,
      nama_pembeli: namaPembeli,
      tanggal_kirim: new Date(tanggalKirim).toISOString(),
      catatan,
      total: grandTotal,
      status: 'menunggu'
    }).select().single()

    if (error) return alert("Gagal simpan pesanan: " + error.message)

    const details = cart.map(c => {
      const p = produk.find(x => x.id === parseInt(c.produk_id))
      return {
        pesanan_id: data.id,
        nama_produk: p?.nama || '',
        qty: c.qty,
        harga: c.harga,
        subtotal: c.subtotal
      }
    })

    await supabase.from('pesanan_detail').insert(details)
    
    setShowAddModal(false)
    setCart([])
    setNamaPembeli("")
    setCatatan("")
    fetchPesanan()
  }

  const handleProses = async (pes: any) => {
    if (!confirm("Proses pesanan ini menjadi transaksi?")) return
    
    // 1. Insert Transaksi
    const randSequence = String(Math.floor(Math.random() * 999) + 1).padStart(3, "0")
    const d = new Date()
    const noNota = `BJ-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}-${randSequence}`
    
    const { data: tx, error: txError } = await supabase.from('transaksi').insert({
      no_nota: noNota,
      tanggal: new Date().toISOString(),
      nama_pembeli: pes.nama_pembeli,
      jenis_pembayaran: null,
      tipe_pengiriman: 'dikirim',
      total: pes.total
    }).select().single()

    if (txError) return alert("Gagal buat transaksi: " + txError.message)

    // 2. Insert Transaksi Detail
    const { data: details } = await supabase.from('pesanan_detail').select('*').eq('pesanan_id', pes.id)
    if (details && details.length > 0) {
      const txDetails = details.map((d: any) => ({
        transaksi_id: tx.id,
        nama_produk: d.nama_produk,
        qty: d.qty,
        harga: d.harga,
        subtotal: d.subtotal,
      }))
      await supabase.from('transaksi_detail').insert(txDetails)
    }

    // 3. Insert Pengiriman
    await supabase.from('pengiriman').insert({
      transaksi_id: tx.id,
      status: 'belum_kirim'
    })

    // 4. Update status pesanan
    await supabase.from('pesanan').update({ status: 'selesai' }).eq('id', pes.id)
    
    alert("Pesanan berhasil diproses menjadi transaksi dan masuk pengiriman!")
    fetchPesanan()
  }

  const handleBatalPesanan = async (id: number) => {
    if (confirm("Yakin batalkan pesanan ini?")) {
      await supabase.from('pesanan').update({ status: 'batal' }).eq('id', id)
      fetchPesanan()
    }
  }

  // --- Pengiriman inline state ---
  const [pengirimanUpdates, setPengirimanUpdates] = useState<Record<number, any>>({})
  const updatePengirimanInline = (id: number, key: string, val: any) => {
    setPengirimanUpdates(prev => ({
      ...prev,
      [id]: { ...(prev[id] || {}), [key]: val }
    }))
  }
  
  const simpanPembayaranPengiriman = async (p: any) => {
    const updates = pengirimanUpdates[p.id] || {}
    const tglKirim = updates.tanggal_kirim || p.tanggal_kirim
    const tglNota = updates.tanggal_nota_kembali || p.tanggal_nota_kembali
    const status = updates.status || p.status
    const jnsBayar = updates.jenis_pembayaran || p.jenis_pembayaran || 'Tunai'
    const nominal = updates.nominal_bayar !== undefined ? parseFloat(updates.nominal_bayar) : (p.nominal_bayar || p.transaksi?.total || 0)

    const totalTx = p.transaksi?.total || 0
    let catatan_bayar = ""

    if (jnsBayar === 'Tempo') {
      // Masuk piutang full
      await supabase.from('piutang').insert({
        no_nota: p.transaksi?.no_nota,
        tanggal: new Date().toISOString(),
        nama_pembeli: p.transaksi?.nama_pembeli,
        total: totalTx,
        sisa: totalTx,
        status: 'belum lunas'
      })
      alert("Tempo! Masuk ke piutang sebesar " + formatRp(totalTx))
    } else {
      const selisih = nominal - totalTx
      if (selisih < 0) {
        // Kurang bayar -> piutang
        const absSelisih = Math.abs(selisih)
        await supabase.from('piutang').insert({
          no_nota: p.transaksi?.no_nota,
          tanggal: new Date().toISOString(),
          nama_pembeli: p.transaksi?.nama_pembeli,
          total: absSelisih,
          sisa: absSelisih,
          status: 'belum lunas'
        })
        catatan_bayar = "Kurang bayar " + formatRp(absSelisih) + " masuk piutang."
        alert(catatan_bayar)
      } else if (selisih > 0) {
        catatan_bayar = "Lebih bayar " + formatRp(selisih) + " (potong pembelian berikutnya)."
        alert(catatan_bayar)
      }
    }

    // Update pengiriman
    await supabase.from('pengiriman').update({
      status,
      tanggal_kirim: tglKirim,
      tanggal_nota_kembali: tglNota,
      jenis_pembayaran: jnsBayar,
      nominal_bayar: nominal,
      catatan_bayar
    }).eq('id', p.id)

    // Update transaksi
    await supabase.from('transaksi').update({ jenis_pembayaran: jnsBayar }).eq('id', p.transaksi_id)
    
    alert("Tersimpan!")
    fetchPengiriman()
  }

  // Banner Check
  const now = new Date()
  const tzOffset = now.getTimezoneOffset() * 60000
  const dateH2 = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000 - tzOffset).toISOString().split('T')[0]
  const todayLocal = new Date(Date.now() - tzOffset).toISOString().split('T')[0]
  
  const upcomingCount = pesanan.filter(p => p.status === 'menunggu' && p.tanggal_kirim >= todayLocal + 'T00:00:00' && p.tanggal_kirim <= dateH2 + 'T23:59:59').length

  return (
    <>
      <header className="sticky top-0 z-10 flex flex-col gap-4 px-8 py-5 bg-[#0d1117]/80 backdrop-blur border-b border-white/[0.05]">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-white">📦 Pesanan & Pengiriman</h2>
            <p className="text-sm text-gray-500 mt-0.5">Kelola pesanan pelanggan dan status pengiriman barang</p>
          </div>
          <div className="flex bg-[#161b22] p-1 rounded-xl border border-white/10">
            <button 
              onClick={() => setActiveTab('pengiriman')}
              className={`px-6 py-2 rounded-lg text-sm font-semibold transition-colors ${activeTab === 'pengiriman' ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              Pengiriman
            </button>
            <button 
              onClick={() => setActiveTab('pesanan')}
              className={`px-6 py-2 rounded-lg text-sm font-semibold transition-colors ${activeTab === 'pesanan' ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              Pesanan
            </button>
          </div>
        </div>
      </header>

      <main className="p-8">
        {activeTab === 'pesanan' && (
          <div className="space-y-6">
            {/* Banner */}
            {upcomingCount > 0 && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-4 flex items-center gap-3">
                <span className="text-2xl">⚠️</span>
                <p className="text-yellow-500 font-semibold text-sm">Ada {upcomingCount} pesanan yang perlu disiapkan dalam 2 hari ke depan.</p>
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <input 
                  type="date" 
                  value={filterDatePesanan} 
                  onChange={e => setFilterDatePesanan(e.target.value)}
                  onClick={(e) => (e.target as HTMLInputElement).showPicker?.()}
                  className="bg-[#161b22] border border-white/10 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-green-500 cursor-pointer"
                />
                <div className="flex bg-[#161b22] rounded-xl border border-white/10 overflow-hidden">
                  {['Hari Ini', 'Akan Datang', 'History'].map(t => (
                    <button key={t} onClick={() => setActiveSubTabPesanan(t as SubTabPesanan)}
                      className={`px-4 py-2 text-sm font-medium transition-colors border-r border-white/5 last:border-0 ${activeSubTabPesanan === t ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/5'}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <Button onClick={() => setShowAddModal(true)} className="bg-green-600 hover:bg-green-500 text-white gap-2">
                <span>+</span> Tambah Pesanan
              </Button>
            </div>

            <div className="bg-[#161b22] border border-white/[0.06] rounded-2xl overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-white/[0.02] border-b border-white/[0.04]">
                  <tr>
                    <th className="p-4 text-sm font-semibold text-gray-400">Tgl Kirim</th>
                    <th className="p-4 text-sm font-semibold text-gray-400">Pembeli</th>
                    <th className="p-4 text-sm font-semibold text-gray-400">Total</th>
                    <th className="p-4 text-sm font-semibold text-gray-400">Status</th>
                    <th className="p-4 text-sm font-semibold text-gray-400">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {pesanan.length === 0 ? (
                    <tr><td colSpan={5} className="p-8 text-center text-gray-500">Tidak ada data pesanan</td></tr>
                  ) : (
                    pesanan.map(p => (
                      <tr key={p.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="p-4 text-sm text-gray-300">{new Date(p.tanggal_kirim).toLocaleDateString('id-ID')}</td>
                        <td className="p-4 text-sm font-semibold text-white">{p.nama_pembeli}</td>
                        <td className="p-4 text-sm font-bold text-green-400">{formatRp(p.total)}</td>
                        <td className="p-4">
                          <span className={`text-xs px-2.5 py-1 rounded-full font-medium border
                            ${p.status === 'menunggu' ? 'bg-gray-500/10 text-gray-400 border-gray-500/20' : ''}
                            ${p.status === 'diproses' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' : ''}
                            ${p.status === 'selesai' ? 'bg-green-500/10 text-green-400 border-green-500/20' : ''}
                            ${p.status === 'batal' ? 'bg-red-500/10 text-red-400 border-red-500/20' : ''}
                          `}>{p.status.toUpperCase()}</span>
                        </td>
                        <td className="p-4 flex gap-2">
                          {p.status !== 'selesai' && p.status !== 'batal' && (
                            <Button onClick={() => handleProses(p)} size="sm" className="bg-blue-600 hover:bg-blue-500 text-white text-xs">
                              Proses →
                            </Button>
                          )}
                          {p.status !== 'batal' && p.status !== 'selesai' && (
                            <Button onClick={() => handleBatalPesanan(p.id)} size="sm" variant="outline" className="text-red-400 border-red-500/20 hover:bg-red-500/10 text-xs">
                              Batal
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'pengiriman' && (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-5">
              <div className="bg-[#161b22] border border-red-500/20 rounded-2xl p-6">
                <h3 className="text-red-400 font-bold mb-1">Belum Kirim</h3>
                <p className="text-3xl font-bold text-white">{pengiriman.filter(x => x.status === 'belum_kirim').length}</p>
              </div>
              <div className="bg-[#161b22] border border-yellow-500/20 rounded-2xl p-6">
                <h3 className="text-yellow-400 font-bold mb-1">Terkirim - Nota Belum</h3>
                <p className="text-3xl font-bold text-white">{pengiriman.filter(x => x.status === 'terkirim').length}</p>
              </div>
              <div className="bg-[#161b22] border border-green-500/20 rounded-2xl p-6">
                <h3 className="text-green-400 font-bold mb-1">Nota Kembali</h3>
                <p className="text-3xl font-bold text-white">{pengiriman.filter(x => x.status === 'nota_kembali').length}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex bg-[#161b22] rounded-xl border border-white/10 overflow-hidden">
                {['Belum Kirim', 'Terkirim', 'Nota Kembali', 'Semua'].map(t => (
                  <button key={t} onClick={() => setActiveSubTabPengiriman(t as SubTabPengiriman)}
                    className={`px-4 py-2 text-sm font-medium transition-colors border-r border-white/5 last:border-0 ${activeSubTabPengiriman === t ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/5'}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              {pengiriman.length === 0 ? (
                <div className="text-center py-12 text-gray-500 bg-[#161b22] rounded-2xl border border-white/10">Tidak ada pengiriman</div>
              ) : pengiriman.map(p => {
                const tx = p.transaksi || {}
                const up = pengirimanUpdates[p.id] || {}
                const isTerkirimLocal = up.status ? up.status === 'terkirim' || up.status === 'nota_kembali' : p.status === 'terkirim' || p.status === 'nota_kembali'
                const isNotaLocal = up.status ? up.status === 'nota_kembali' : p.status === 'nota_kembali'
                
                return (
                  <div key={p.id} className="bg-[#161b22] border border-white/[0.06] rounded-xl p-5 hover:border-white/20 transition-colors space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-white text-lg">{tx.nama_pembeli}</h4>
                        <p className="text-gray-400 text-sm font-mono mt-0.5">{tx.no_nota} — {new Date(tx.tanggal).toLocaleDateString('id-ID')}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-green-400 font-bold text-xl">{formatRp(tx.total)}</p>
                        <p className="text-xs text-gray-500 uppercase tracking-widest">{p.status.replace('_', ' ')}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-end gap-4 p-4 bg-[#0d1117] rounded-lg border border-white/5">
                      <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-300">
                        <input type="checkbox" checked={isTerkirimLocal} onChange={(e) => {
                          const checked = e.target.checked
                          updatePengirimanInline(p.id, 'status', checked ? 'terkirim' : 'belum_kirim')
                          if (checked) updatePengirimanInline(p.id, 'tanggal_kirim', new Date().toISOString())
                          else updatePengirimanInline(p.id, 'tanggal_nota_kembali', null)
                        }} className="w-5 h-5 accent-green-500" />
                        ✓ Terkirim
                      </label>
                      {isTerkirimLocal && (
                        <input type="date" value={(up.tanggal_kirim || p.tanggal_kirim || '').split('T')[0]} 
                          onChange={e => updatePengirimanInline(p.id, 'tanggal_kirim', e.target.value)}
                          onClick={(e) => (e.target as HTMLInputElement).showPicker?.()}
                          className="bg-[#161b22] border border-white/10 rounded-md px-2 py-1 text-sm text-white focus:outline-none cursor-pointer" />
                      )}

                      <div className="w-px h-8 bg-white/10 mx-2"></div>

                      <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-300">
                        <input type="checkbox" checked={isNotaLocal} disabled={!isTerkirimLocal} onChange={(e) => {
                          const checked = e.target.checked
                          updatePengirimanInline(p.id, 'status', checked ? 'nota_kembali' : 'terkirim')
                          if (checked) updatePengirimanInline(p.id, 'tanggal_nota_kembali', new Date().toISOString())
                        }} className="w-5 h-5 accent-blue-500 disabled:opacity-50" />
                        ✓ Nota Kembali
                      </label>
                      {isNotaLocal && (
                        <input type="date" value={(up.tanggal_nota_kembali || p.tanggal_nota_kembali || '').split('T')[0]} 
                          onChange={e => updatePengirimanInline(p.id, 'tanggal_nota_kembali', e.target.value)}
                          onClick={(e) => (e.target as HTMLInputElement).showPicker?.()}
                          className="bg-[#161b22] border border-white/10 rounded-md px-2 py-1 text-sm text-white focus:outline-none cursor-pointer" />
                      )}

                      <div className="w-px h-8 bg-white/10 mx-2"></div>

                      <div className="flex-1 min-w-[200px] flex items-center gap-3">
                        <select 
                          value={up.jenis_pembayaran || p.jenis_pembayaran || 'Tunai'}
                          onChange={e => updatePengirimanInline(p.id, 'jenis_pembayaran', e.target.value)}
                          className="bg-[#161b22] border border-white/10 rounded-md px-3 py-1.5 text-sm text-white focus:outline-none flex-1"
                        >
                          <option value="Tunai">Tunai</option>
                          <option value="Transfer">Transfer</option>
                          <option value="Tempo">Tempo</option>
                        </select>
                        <Input 
                          type="number"
                          placeholder="Nominal Bayar"
                          value={up.nominal_bayar !== undefined ? up.nominal_bayar : (p.nominal_bayar || tx.total)}
                          onChange={e => updatePengirimanInline(p.id, 'nominal_bayar', e.target.value)}
                          className="bg-[#161b22] border border-white/10 h-8 text-sm text-white w-32 text-right"
                        />
                      </div>
                      <Button onClick={() => simpanPembayaranPengiriman(p)} className="bg-blue-600 hover:bg-blue-500 text-white text-xs h-8">
                        Simpan Perubahan
                      </Button>
                    </div>
                    {p.catatan_bayar && (
                      <p className="text-xs text-orange-400 mt-2">Catatan: {p.catatan_bayar}</p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </main>

      {/* Modal Tambah Pesanan */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#161b22] border border-white/10 rounded-2xl w-full max-w-3xl flex flex-col max-h-[90vh]">
            <div className="px-6 py-5 border-b border-white/5 flex justify-between items-center bg-black/20 rounded-t-2xl">
              <h3 className="text-xl font-bold text-white">Tambah Pesanan Baru</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-white">✕</button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5 relative">
                  <Label className="text-gray-300">Nama Pembeli</Label>
                  <Input 
                    value={namaPembeli} 
                    onChange={e => { setNamaPembeli(e.target.value); setShowSuggestions(true); }}
                    onFocus={() => setShowSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                    className="bg-[#0d1117] border-white/10 text-white" 
                    placeholder="Ketik nama..."
                  />
                  {showSuggestions && namaPembeli.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-[#161b22] border border-white/10 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                      {pelanggan.filter(c => c.nama.toLowerCase().includes(namaPembeli.toLowerCase())).map((c, i) => (
                        <button key={i} type="button" onClick={() => { setNamaPembeli(c.nama); setShowSuggestions(false); }} className="w-full text-left px-4 py-2.5 text-white hover:bg-white/10 transition-colors">
                          {c.nama}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-gray-300">Tanggal Kirim</Label>
                  <Input type="date" value={tanggalKirim} onChange={e => setTanggalKirim(e.target.value)} onClick={(e) => (e.target as HTMLInputElement).showPicker?.()} className="bg-[#0d1117] border-white/10 text-white cursor-pointer [&::-webkit-calendar-picker-indicator]:invert" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-gray-300">Catatan</Label>
                <Input value={catatan} onChange={e => setCatatan(e.target.value)} className="bg-[#0d1117] border-white/10 text-white" placeholder="Opsional..." />
              </div>

              <div className="pt-4 border-t border-white/5 space-y-3">
                <Label className="text-gray-300 block">Daftar Produk</Label>
                
                <div className="grid grid-cols-[1fr_120px_140px_100px_24px] gap-2 px-1 mb-1">
                  <span className="text-xs text-gray-500">Produk</span>
                  <span className="text-xs text-gray-500">Qty</span>
                  <span className="text-xs text-gray-500">Harga (Rp)</span>
                  <span className="text-xs text-gray-500 text-right">Subtotal</span>
                  <span></span>
                </div>

                {cart.map((c, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_120px_140px_100px_24px] gap-2 items-center bg-[#0d1117] p-2 rounded-xl border border-white/5">
                    <select 
                      value={c.produk_id || ""} 
                      onChange={e => updateCartItem(idx, 'produk_id', e.target.value)} 
                      className="w-full bg-[#161b22] border border-white/10 rounded-lg px-3 h-10 text-sm text-white focus:outline-none"
                    >
                      <option value="">Pilih Produk...</option>
                      {produk.map(p => <option key={p.id} value={p.id}>{p.nama}</option>)}
                    </select>
                    
                    <input 
                      type="number" 
                      min="0" step="0.1" 
                      value={c.qty === 0 ? '' : c.qty} 
                      onChange={e => {
                        const val = parseFloat(e.target.value);
                        updateCartItem(idx, 'qty', isNaN(val) ? 0 : val)
                      }} 
                      className="w-full bg-[#161b22] border border-white/10 rounded-lg px-3 h-10 text-sm text-white focus:outline-none appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                      placeholder="0" 
                    />
                    
                    <input 
                      type="number" 
                      min="0" 
                      value={c.harga === 0 ? '' : c.harga} 
                      onChange={e => {
                        const val = parseFloat(e.target.value);
                        updateCartItem(idx, 'harga', isNaN(val) ? 0 : val)
                      }} 
                      className="w-full bg-[#161b22] border border-white/10 rounded-lg px-3 h-10 text-sm text-white focus:outline-none appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                      placeholder="0" 
                    />
                    
                    <div className={`text-right text-sm font-bold truncate px-1 ${c.qty * c.harga > 0 ? 'text-green-400' : 'text-gray-500'}`}>
                      {c.qty * c.harga > 0 ? formatRp(c.qty * c.harga) : 'Rp 0'}
                    </div>
                    
                    <div className="flex justify-center items-center">
                      {cart.length > 1 && (
                        <button onClick={() => removeCartItem(idx)} className="text-red-400 hover:text-red-300 transition-colors" title="Hapus baris">✕</button>
                      )}
                    </div>
                  </div>
                ))}
                <Button onClick={addCartItem} variant="outline" className="w-full border-dashed border-white/20 text-gray-400 hover:text-white hover:border-white/40 bg-transparent">
                  + Tambah Baris Produk
                </Button>
              </div>

              <div className="flex justify-between items-center pt-4">
                <span className="text-lg text-gray-300">Total Pesanan:</span>
                <span className="text-2xl font-bold text-green-400">{formatRp(grandTotal)}</span>
              </div>
            </div>

            <div className="px-6 py-5 border-t border-white/5 bg-black/20 rounded-b-2xl flex justify-end gap-3">
              <Button onClick={() => setShowAddModal(false)} variant="outline" className="border-white/10 text-gray-300 hover:bg-white/5 hover:text-white">Batal</Button>
              <Button onClick={handleSimpanPesanan} className="bg-green-600 hover:bg-green-500 text-white">Simpan Pesanan</Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
