"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { supabase } from "@/utils/supabase/client"
import { getUserRole } from "@/utils/supabase/getUserRole"
import { fetchAllRows } from "@/lib/fetchAll"

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
type DetailKeluar = {
  id: number; transaksi_id: number; nama_produk: string; qty: number
  transaksi: { tanggal: string; no_nota: string; nama_pembeli: string } | null
}
type DetailData = { masuk: HPP[]; keluar: DetailKeluar[]; opname: Opname[] }

type KonversiDetail = {
  arah: 'keluar' | 'masuk'
  produk_id: number | null
  nama_produk: string
  satuan: string
  qty: number | string
  hpp_satuan: number
  total_nilai: number
}

type KonversiRecord = {
  id: string
  tanggal: string
  tipe: '1to1' | 'manyto1' | '1tomany'
  catatan: string
  konversi_stok_detail: {
    id: string
    arah: 'keluar' | 'masuk'
    nama_produk: string
    satuan: string
    qty: number
    hpp_satuan: number
    total_nilai: number
  }[]
}

export default function StokAyamPage() {
  const [activeTab, setActiveTab] = useState<'stok' | 'hpp' | 'opname' | 'konversi'>('stok')
  const [konversiDetailAll, setKonversiDetailAll] = useState<any[]>([])

  // Konversi State
  const [konversiList, setKonversiList] = useState<KonversiRecord[]>([])
  const [isKonversiLoading, setIsKonversiLoading] = useState(false)
  const [isKonversiSubmitting, setIsKonversiSubmitting] = useState(false)
  
  const [konversiTanggal, setKonversiTanggal] = useState(new Date().toISOString().split('T')[0])
  const [konversiTipe, setKonversiTipe] = useState<'1to1' | 'manyto1' | '1tomany'>('1to1')
  const [konversiCatatan, setKonversiCatatan] = useState('')
  const [konversiKeluar, setKonversiKeluar] = useState<KonversiDetail[]>([
    { arah: 'keluar', produk_id: null, nama_produk: '', satuan: '', qty: '', hpp_satuan: 0, total_nilai: 0 }
  ])
  const [konversiMasuk, setKonversiMasuk] = useState<KonversiDetail[]>([
    { arah: 'masuk', produk_id: null, nama_produk: '', satuan: '', qty: '', hpp_satuan: 0, total_nilai: 0 }
  ])
  const [expandedKonversi, setExpandedKonversi] = useState<Set<string>>(new Set())

  const fetchKonversi = async () => {
    setIsKonversiLoading(true)
    const { data } = await supabase
      .from('konversi_stok')
      .select('*, konversi_stok_detail(*)')
      .order('tanggal', { ascending: false })
    if (data) setKonversiList(data as KonversiRecord[])
    setIsKonversiLoading(false)
  }

  useEffect(() => {
    if (activeTab === 'konversi') fetchKonversi()
  }, [activeTab])

  const updateHppMasukFromKeluar = (
    keluarList = konversiKeluar,
    masukList = konversiMasuk
  ) => {
    const totalNilaiKeluar = keluarList.reduce((a, k) => {
      return a + ((parseFloat(String(k.qty)) || 0) * k.hpp_satuan)
    }, 0)
    const totalQtyMasuk = masukList.reduce((a, m) => a + (parseFloat(String(m.qty)) || 0), 0)
    const hppMasukPerSatuan = totalQtyMasuk > 0 ? totalNilaiKeluar / totalQtyMasuk : 0
    const updated = masukList.map(m => ({
      ...m,
      hpp_satuan: Math.round(hppMasukPerSatuan),
      total_nilai: (parseFloat(String(m.qty)) || 0) * Math.round(hppMasukPerSatuan)
    }))
    setKonversiMasuk(updated)
  }

  const updateKeluar = (idx: number, field: string, val: any) => {
    const updated = [...konversiKeluar]
    updated[idx] = { ...updated[idx], [field]: val }
    if (field === 'produk_id') {
      const produk = produkList.find(p => p.id === parseInt(val))
      if (produk) {
        updated[idx].nama_produk = produk.nama
        updated[idx].satuan = produk.satuan
        const hppTerakhir = [...hppList].sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime()).find(h => h.produk_id === produk.id)
        updated[idx].hpp_satuan = hppTerakhir?.hpp_satuan || 0
      }
    }
    const qty = parseFloat(String(updated[idx].qty)) || 0
    updated[idx].total_nilai = qty * updated[idx].hpp_satuan
    setKonversiKeluar(updated)
    updateHppMasukFromKeluar(updated)
  }

  const updateMasuk = (idx: number, field: string, val: any) => {
    const updated = [...konversiMasuk]
    updated[idx] = { ...updated[idx], [field]: val }
    if (field === 'produk_id') {
      const produk = produkList.find(p => p.id === parseInt(val))
      if (produk) {
        updated[idx].nama_produk = produk.nama
        updated[idx].satuan = produk.satuan
      }
    }
    updateHppMasukFromKeluar(konversiKeluar, updated)
  }

  const handleSimpanKonversi = async () => {
    const invalidKeluar = konversiKeluar.some(k => !k.produk_id || parseFloat(String(k.qty)) <= 0)
    const invalidMasuk = konversiMasuk.some(m => !m.produk_id || parseFloat(String(m.qty)) <= 0)
    if (invalidKeluar || invalidMasuk) return alert('Lengkapi semua data produk keluar dan masuk')
    setIsKonversiSubmitting(true)
    try {
      const { data: konversiHeader, error: headerError } = await supabase
        .from('konversi_stok')
        .insert({ tanggal: konversiTanggal, tipe: konversiTipe, catatan: konversiCatatan })
        .select().single()
      if (headerError) throw headerError

      const allDetails = [
        ...konversiKeluar.map(k => ({
          konversi_id: konversiHeader.id, arah: 'keluar' as const,
          produk_id: k.produk_id, nama_produk: k.nama_produk, satuan: k.satuan,
          qty: parseFloat(String(k.qty)), hpp_satuan: k.hpp_satuan, total_nilai: k.total_nilai
        })),
        ...konversiMasuk.map(m => ({
          konversi_id: konversiHeader.id, arah: 'masuk' as const,
          produk_id: m.produk_id, nama_produk: m.nama_produk, satuan: m.satuan,
          qty: parseFloat(String(m.qty)), hpp_satuan: m.hpp_satuan, total_nilai: m.total_nilai
        }))
      ]
      const { error: detailError } = await supabase.from('konversi_stok_detail').insert(allDetails)
      if (detailError) throw detailError

      alert('Konversi berhasil disimpan!')
      setKonversiKeluar([{ arah: 'keluar', produk_id: null, nama_produk: '', satuan: '', qty: '', hpp_satuan: 0, total_nilai: 0 }])
      setKonversiMasuk([{ arah: 'masuk', produk_id: null, nama_produk: '', satuan: '', qty: '', hpp_satuan: 0, total_nilai: 0 }])
      setKonversiCatatan('')
      setKonversiTipe('1to1')
      fetchKonversi()
      fetchAll()
    } catch (err: any) {
      alert('Gagal simpan konversi: ' + err.message)
    } finally {
      setIsKonversiSubmitting(false)
    }
  }

  const handleHapusKonversi = async (id: string) => {
    if (!confirm('Yakin hapus konversi ini? Stok akan dikembalikan ke kondisi sebelum konversi.')) return
    await supabase.from('konversi_stok').delete().eq('id', id)
    fetchKonversi()
    fetchAll()
  }

  const toggleExpandedKonversi = (id: string) => {
    setExpandedKonversi(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) newSet.delete(id)
      else newSet.add(id)
      return newSet
    })
  }
  const [produkList, setProdukList] = useState<Produk[]>([])
  const [supplierList, setSupplierList] = useState<Supplier[]>([])
  const [hppList, setHppList] = useState<HPP[]>([])
  const [stokAwalList, setStokAwalList] = useState<StokAwal[]>([])
  const [opnameList, setOpnameList] = useState<Opname[]>([])
  const [transaksiDetail, setTransaksiDetail] = useState<{ nama_produk: string; qty: number }[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [stokSearch, setStokSearch] = useState("")

  // HPP Form
  const [hppTanggal, setHppTanggal] = useState(new Date().toISOString().split('T')[0])
  const [hppSupplierId, setHppSupplierId] = useState("")
  const [hppTipeBayar, setHppTipeBayar] = useState("Tunai")
  const [hppRows, setHppRows] = useState<HppRow[]>([{ produk_id: "", hpp_satuan: "", qty: "", catatan: "" }])
  const [isHppSubmitting, setIsHppSubmitting] = useState(false)

  // Stok Awal
  const [stokAwalForm, setStokAwalForm] = useState({ produk_id: "", qty: "", hpp_satuan: "" })
  const [isStokAwalSubmitting, setIsStokAwalSubmitting] = useState(false)
  const [showStokAwalModal, setShowStokAwalModal] = useState(false)
  const stokAwalModalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (showStokAwalModal) setTimeout(() => stokAwalModalRef.current?.focus(), 100)
  }, [showStokAwalModal])

  const handleStokAwalModalKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      const inputs = Array.from(e.currentTarget.querySelectorAll('input:not([disabled]), select:not([disabled]), textarea:not([disabled])')) as HTMLElement[]
      const activeEl = document.activeElement as HTMLElement
      const activeIndex = inputs.indexOf(activeEl)
      
      if (activeIndex > -1 && activeIndex < inputs.length - 1) {
        inputs[activeIndex + 1].focus()
      } else {
        handleStokAwalSubmit()
      }
    }
  }

  // Opname
  const [opnameForm, setOpnameForm] = useState({ tanggal: new Date().toISOString().split('T')[0], produk_id: "", qty_aktual: "", catatan: "" })
  const [isOpnameSubmitting, setIsOpnameSubmitting] = useState(false)

  // Detail modal
  const [detailProduk, setDetailProduk] = useState<StokItem | null>(null)
  const [detailData, setDetailData] = useState<DetailData | null>(null)
  const [isDetailLoading, setIsDetailLoading] = useState(false)
  const [role, setRole] = useState<'admin' | 'kasir' | null>(null)

  const formatRp = (n: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n)
  const formatDate = (d: string) => new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })

  useEffect(() => { 
    fetchAll() 
    getUserRole().then(r => {
      setRole(r)
      if (r === 'kasir') {
        setActiveTab('stok')
      }
    })
  }, [])

  const fetchAll = async () => {
    setIsLoading(true)
    try {
      const [p, s, hData, sa, oData, ksdData, allTd] = await Promise.all([
        supabase.from('produk').select('*').eq('aktif', true).order('nama'),
        supabase.from('supplier').select('id, nama').order('nama'),
        fetchAllRows('hpp', '*', { order: ['tanggal', false] }),
        supabase.from('stok_awal').select('*'),
        fetchAllRows('opname', '*', { order: ['tanggal', false] }),
        fetchAllRows('konversi_stok_detail', '*'),
        fetchAllRows('transaksi_detail', 'nama_produk, qty')
      ])

      if (p.data) setProdukList(p.data)
      if (s.data) setSupplierList(s.data)
      setHppList(hData as Hpp[])
      if (sa.data) setStokAwalList(sa.data)
      setOpnameList(oData as OpnameRecord[])
      setKonversiDetailAll(ksdData as any)

      // Normalisasi nama_produk: trim whitespace untuk menghindari mismatch nama produk
      const normalizedTd = allTd.map(r => ({
        nama_produk: r.nama_produk?.trim() ?? '',
        qty: r.qty
      }))
      setTransaksiDetail(normalizedTd)

      // DEBUG LOG — buka DevTools Console untuk verifikasi
      const grouped: Record<string, number> = {}
      normalizedTd.forEach(r => {
        grouped[r.nama_produk] = (grouped[r.nama_produk] || 0) + r.qty
      })
      console.log(`[StokAyam] ✅ Total baris transaksi_detail: ${normalizedTd.length} (${page} halaman x ${PAGE_SIZE})`)
      console.log('[StokAyam] Total qty keluar per produk:', grouped)

    } catch (e) { console.error(e) }
    finally { setIsLoading(false) }
  }

  const selectedProdukOpname = produkList.find(p => p.id === parseInt(opnameForm.produk_id))

  const stokData = useMemo((): StokItem[] => {
    // ===== DEBUG LOGS (sesuai permintaan) =====
    console.log('Total transaksi_detail rows fetched:', transaksiDetail.length)
    const doriRows = transaksiDetail.filter(d => d.nama_produk === 'Dori')
    console.log('Dori keluar rows:', doriRows)
    console.log('Dori total keluar qty:', doriRows.reduce((a, d) => a + d.qty, 0))
    // ==========================================

    return produkList.map(produk => {
      const sa = stokAwalList.find(s => s.produk_id === produk.id)
      const stok_awal = sa?.qty || 0

      // total_masuk = pembelian dari hpp + konversi masuk
      // Tanpa filter tanggal — kalkulasi stok kumulatif dari semua data
      const masuk_hpp = hppList
        .filter(h => h.produk_id === produk.id)
        .reduce((acc, h) => acc + (h.qty || 0), 0)
      const konv_masuk = konversiDetailAll
        .filter(d => d.arah === 'masuk' && d.produk_id === produk.id)
        .reduce((acc, d) => acc + (d.qty || 0), 0)
      const total_masuk = masuk_hpp + konv_masuk

      // total_keluar = penjualan dari transaksi + konversi keluar
      // Tanpa filter tanggal — semua transaksi sepanjang waktu
      // Gunakan trim + lowercase untuk menghindari mismatch nama produk
      const namaProdukNorm = produk.nama.trim().toLowerCase()
      const keluar_transaksi = transaksiDetail
        .filter(t => t.nama_produk.trim().toLowerCase() === namaProdukNorm)
        .reduce((acc, t) => acc + (t.qty || 0), 0)
      const konv_keluar = konversiDetailAll
        .filter(d => d.arah === 'keluar' && d.produk_id === produk.id)
        .reduce((acc, d) => acc + (d.qty || 0), 0)
      const total_keluar = keluar_transaksi + konv_keluar

      const koreksi_opname = opnameList
        .filter(o => o.produk_id === produk.id)
        .reduce((acc, o) => acc + (o.selisih || 0), 0)

      const stok_akhir = stok_awal + total_masuk - total_keluar + koreksi_opname

      return { produk_id: produk.id, nama_produk: produk.nama, satuan: produk.satuan, stok_awal, total_masuk, total_keluar, koreksi_opname, stok_akhir }
    })
  }, [produkList, stokAwalList, hppList, transaksiDetail, opnameList, konversiDetailAll])

  // Latest HPP per produk (hppList is sorted DESC by tanggal)
  const hppLatestPerProduk = useMemo(() => {
    const map: Record<string, number> = {}
    hppList.forEach(h => { if (!map[h.nama_produk]) map[h.nama_produk] = h.hpp_satuan })
    return map
  }, [hppList])

  const totalNilaiStok = useMemo(() =>
    stokData.reduce((acc, item) => acc + Math.max(0, item.stok_akhir) * (hppLatestPerProduk[item.nama_produk] || 0), 0)
  , [stokData, hppLatestPerProduk])

  const getSistemStok = (produk_id: number) => stokData.find(s => s.produk_id === produk_id)?.stok_akhir || 0

  const openDetailModal = async (item: StokItem) => {
    setDetailProduk(item)
    setDetailData(null)
    setIsDetailLoading(true)
    try {
      // Normalisasi nama produk untuk pencocokan yang konsisten
      const namaProdukTrimmed = item.nama_produk.trim()
      const [masukRes, keluarRes, opnameRes] = await Promise.all([
        supabase.from('hpp').select('*').eq('produk_id', item.produk_id).order('tanggal', { ascending: false }),
        // Gunakan left join (bukan !inner) agar semua transaksi_detail ikut terhitung
        // meskipun transaksi induknya tidak ditemukan (misalnya sudah dihapus)
        supabase.from('transaksi_detail')
          .select('id, transaksi_id, nama_produk, qty, transaksi(tanggal, no_nota, nama_pembeli)')
          .eq('nama_produk', namaProdukTrimmed)
          .order('transaksi_id', { ascending: false }),
        supabase.from('opname').select('*').eq('produk_id', item.produk_id).order('tanggal', { ascending: false }),
      ])

      // Log untuk debug: cek berapa transaksi_detail yang ditemukan
      console.log(`[StokAyam Detail] ${namaProdukTrimmed}: ${keluarRes.data?.length ?? 0} transaksi keluar ditemukan`)
      if (keluarRes.error) console.error('[StokAyam Detail] keluar error:', keluarRes.error)

      setDetailData({
        masuk: (masukRes.data as HPP[]) || [],
        keluar: (keluarRes.data as unknown as DetailKeluar[]) || [],
        opname: (opnameRes.data as Opname[]) || [],
      })
    } catch (e) { console.error(e) }
    finally { setIsDetailLoading(false) }
  }

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

      if (hppTipeBayar === 'Tempo') {
        const utangInserts = (data as HPP[]).map(insertedHpp => ({
          hpp_id: insertedHpp.id, tanggal: insertedHpp.tanggal,
          nama_supplier: insertedHpp.nama_supplier, nama_produk: insertedHpp.nama_produk,
          total: insertedHpp.total_modal, terbayar: 0, sisa: insertedHpp.total_modal, status: 'belum lunas'
        }))
        const { error: utangError } = await supabase.from('utang_supplier').insert(utangInserts)
        if (utangError) throw utangError
      }

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
    if (!stokAwalForm.produk_id || !stokAwalForm.qty || !stokAwalForm.hpp_satuan) { alert("Isi semua field!"); return }
    const produk = produkList.find(p => p.id === parseInt(stokAwalForm.produk_id))
    const qtyStokAwal = parseFloat(stokAwalForm.qty)
    const hppSatuan = parseFloat(stokAwalForm.hpp_satuan)
    setIsStokAwalSubmitting(true)
    try {
      const existing = stokAwalList.find(s => s.produk_id === parseInt(stokAwalForm.produk_id))
      if (existing) {
        const { error } = await supabase.from('stok_awal').update({ qty: qtyStokAwal }).eq('id', existing.id)
        if (error) throw error
        setStokAwalList(prev => prev.map(s => s.produk_id === parseInt(stokAwalForm.produk_id) ? { ...s, qty: qtyStokAwal } : s))
      } else {
        const { data, error } = await supabase.from('stok_awal').insert({
          produk_id: parseInt(stokAwalForm.produk_id), nama_produk: produk?.nama || "",
          satuan: produk?.satuan || "", qty: qtyStokAwal
        }).select().single()
        if (error) throw error
        setStokAwalList(prev => [...prev, data as StokAwal])
      }

      // Catatan: stok_awal TIDAK dimasukkan ke tabel hpp agar tidak terhitung
      // dobel. stok_awal sudah dihitung terpisah dari tabel stok_awal di stokData.
      // hpp hanya diisi untuk pembelian dari supplier (tab Input HPP).

      setStokAwalForm({ produk_id: "", qty: "", hpp_satuan: "" })
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

      if (selisih < 0 && produk) {
        const { data: hppData } = await supabase.from('hpp').select('hpp_satuan')
          .eq('nama_produk', produk.nama).order('tanggal', { ascending: false }).limit(1).single()
        const hpp_terakhir = hppData?.hpp_satuan || 0
        await supabase.from('pengeluaran').insert({
          tanggal: opnameForm.tanggal, kategori: 'Penyusutan', sub_kategori: produk.nama,
          keterangan: `Susut opname: ${Math.abs(selisih)} ${produk.satuan}`,
          jumlah: Math.abs(selisih) * hpp_terakhir
        })
      }

      setOpnameForm({ tanggal: new Date().toISOString().split('T')[0], produk_id: "", qty_aktual: "", catatan: "" })
      alert(`Opname berhasil! Selisih: ${selisih >= 0 ? '+' : ''}${selisih} ${produk?.satuan}${selisih < 0 ? '\n⚠️ Penyusutan otomatis dicatat.' : ''}`)
    } catch (e: any) { alert("Gagal: " + e.message) }
    finally { setIsOpnameSubmitting(false) }
  }

  const handleDeleteOpname = async (id: number) => {
    if (!confirm("Hapus data opname ini?")) return
    const { error } = await supabase.from('opname').delete().eq('id', id)
    if (error) { alert("Gagal hapus: " + error.message); return }
    setOpnameList(prev => prev.filter(o => o.id !== id))
  }

  const filteredStokData = useMemo(() =>
    stokSearch ? stokData.filter(item => item.nama_produk.toLowerCase().includes(stokSearch.toLowerCase())) : stokData
  , [stokData, stokSearch])

  const produkMenipis = stokData.filter(s => s.stok_akhir > 0 && s.stok_akhir < 10).length
  const produkHabis = stokData.filter(s => s.stok_akhir <= 0).length

  return (
    <>
      <header className="sticky top-0 z-10 flex items-center justify-between px-8 py-5 bg-[#0d1117]/80 backdrop-blur border-b border-white/[0.05]">
        <div>
          <h2 className="text-2xl font-bold text-white">Stok</h2>
          <p className="text-sm text-gray-500 mt-0.5">Pantau stok, input pembelian, dan lakukan opname</p>
        </div>
        <div className="flex items-center gap-3">
          {role === 'admin' && (
            <button onClick={() => setShowStokAwalModal(true)} className="bg-white/5 hover:bg-white/10 text-white text-sm font-medium px-4 py-2.5 rounded-xl border border-white/10 transition-colors">⚙️ Set Stok Awal</button>
          )}
          <button onClick={fetchAll} className="bg-white/5 hover:bg-white/10 text-white text-sm font-medium px-4 py-2.5 rounded-xl border border-white/10 transition-colors">🔄 Refresh</button>
        </div>
      </header>

      <main className="p-8 space-y-6">
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-[#161b22] border border-white/[0.06] rounded-2xl p-5">
            <p className="text-gray-400 text-sm mb-1">Total Produk</p>
            <p className="text-2xl font-bold text-white">{stokData.length} <span className="text-sm text-gray-500 font-normal">produk</span></p>
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

        <div className="flex gap-2 border-b border-white/[0.05] overflow-x-auto">
          {[{ key: 'stok', label: '📦 Stok Saat Ini' }, { key: 'hpp', label: '🛒 Input HPP' }, { key: 'opname', label: '📋 Opname' }, { key: 'konversi', label: '🔄 Konversi' }]
            .filter(tab => role === 'kasir' ? tab.key === 'stok' : true)
            .map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
              className={`px-5 py-3 text-sm font-semibold rounded-t-xl transition-colors whitespace-nowrap ${activeTab === tab.key ? 'bg-[#161b22] text-white border border-b-0 border-white/10' : 'text-gray-500 hover:text-gray-300'}`}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* STOK TAB */}
        {activeTab === 'stok' && (
          <div className="space-y-4">
            <div className="relative w-full max-w-sm">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">🔍</span>
              <input type="text" placeholder="Cari nama produk..." value={stokSearch}
                onChange={e => setStokSearch(e.target.value)}
                className="w-full bg-[#161b22] border border-white/10 text-white text-sm rounded-xl pl-9 pr-9 py-2.5 focus:outline-none focus:border-green-500/50" />
              {stokSearch && (
                <button onClick={() => setStokSearch('')} className="absolute inset-y-0 right-3 flex items-center text-gray-500 hover:text-gray-300 text-xs">✕</button>
              )}
            </div>
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
                      <th className="px-6 py-3">Produk</th>
                      <th className="px-4 py-3 text-right">Stok Awal</th>
                      <th className="px-4 py-3 text-right">+ Masuk</th>
                      <th className="px-4 py-3 text-right">- Terjual</th>
                      <th className="px-4 py-3 text-right">± Opname</th>
                      <th className="px-4 py-3 text-right">Stok Akhir</th>
                      <th className="px-4 py-3 text-right">Nilai Stok</th>
                      <th className="px-4 py-3 text-center">Status</th>
                      <th className="px-4 py-3 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.02]">
                    {filteredStokData.map(item => {
                      const status = item.stok_akhir <= 0 ? 'Habis' : item.stok_akhir < 10 ? 'Menipis' : 'Tersedia'
                      const statusClass = status === 'Habis' ? 'bg-red-500/10 text-red-400 border-red-500/20' : status === 'Menipis' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' : 'bg-green-500/10 text-green-400 border-green-500/20'
                      const nilaiStok = Math.max(0, item.stok_akhir) * (hppLatestPerProduk[item.nama_produk] || 0)
                      return (
                        <tr key={item.produk_id} className="hover:bg-white/[0.01] transition-colors group">
                          <td className="px-6 py-4 font-semibold text-white">{item.nama_produk}</td>
                          <td className="px-4 py-4 text-right text-gray-400">{item.stok_awal} {item.satuan}</td>
                          <td className="px-4 py-4 text-right text-green-400">+{item.total_masuk} {item.satuan}</td>
                          <td className="px-4 py-4 text-right text-red-400">-{item.total_keluar} {item.satuan}</td>
                          <td className={`px-4 py-4 text-right ${item.koreksi_opname >= 0 ? 'text-blue-400' : 'text-orange-400'}`}>{item.koreksi_opname >= 0 ? '+' : ''}{item.koreksi_opname} {item.satuan}</td>
                          <td className="px-4 py-4 text-right font-bold text-white">{item.stok_akhir} {item.satuan}</td>
                          <td className="px-4 py-4 text-right font-semibold text-green-400 text-xs">{nilaiStok > 0 ? formatRp(nilaiStok) : '-'}</td>
                          <td className="px-4 py-4 text-center"><span className={`px-3 py-1 text-xs font-semibold rounded-full border ${statusClass}`}>{status}</span></td>
                          <td className="px-4 py-4 text-center">
                            <button onClick={() => openDetailModal(item)}
                              className="opacity-0 group-hover:opacity-100 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white px-3 py-1.5 rounded-lg text-xs font-medium border border-white/10 transition-all">
                              Detail 🔍
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* HPP TAB */}
        {activeTab === 'hpp' && (
          <div className="space-y-6">
            <form onSubmit={(e) => { e.preventDefault(); handleHppSubmit(); }} className="bg-[#161b22] border border-white/[0.05] rounded-2xl p-6 space-y-5">
              <h3 className="font-bold text-white text-lg">Input Pembelian</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-gray-300 text-sm">Tanggal <span className="text-red-500">*</span></label>
                  <input type="date" value={hppTanggal} onChange={e => setHppTanggal(e.target.value)} onClick={e => (e.target as any).showPicker?.()}
                    className="w-full cursor-pointer bg-[#0d1117] border border-white/10 text-white rounded-xl px-4 h-10 text-sm focus:outline-none focus:border-green-500 [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-gray-300 text-sm">Supplier</label>
                  <select value={hppSupplierId} onChange={e => setHppSupplierId(e.target.value)}
                    className="w-full bg-[#0d1117] border border-white/10 text-white rounded-xl px-4 h-10 text-sm focus:outline-none focus:border-green-500">
                    <option value="">Pilih supplier...</option>
                    {supplierList.map(s => <option key={s.id} value={s.id}>{s.nama}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-gray-300 text-sm">Tipe Bayar</label>
                  <select value={hppTipeBayar} onChange={e => setHppTipeBayar(e.target.value)}
                    className="w-full bg-[#0d1117] border border-white/10 text-white rounded-xl px-4 h-10 text-sm focus:outline-none focus:border-green-500">
                    <option value="Tunai">Tunai</option>
                    <option value="Tempo">Tempo</option>
                  </select>
                </div>
              </div>
              <div className="space-y-3">
                <div className="grid grid-cols-12 gap-3 text-xs text-gray-400 uppercase px-1">
                  <div className="col-span-4">Produk</div><div className="col-span-2">HPP/satuan (Rp)</div>
                  <div className="col-span-2">Qty</div><div className="col-span-2">Subtotal</div>
                  <div className="col-span-1">Catatan</div><div className="col-span-1"></div>
                </div>
                {hppRows.map((row, idx) => {
                  const produk = produkList.find(p => p.id === parseInt(row.produk_id))
                  const subtotal = (Number(row.hpp_satuan) || 0) * (Number(row.qty) || 0)
                  return (
                    <div key={idx} className="grid grid-cols-12 gap-3 items-center bg-[#0d1117] p-3 rounded-xl border border-white/5">
                      <div className="col-span-4">
                        <select value={row.produk_id} onChange={e => updateHppRow(idx, 'produk_id', e.target.value)}
                          className="w-full bg-[#161b22] border border-white/10 text-white rounded-lg px-3 h-10 text-sm focus:outline-none focus:border-green-500">
                          <option value="">Pilih produk...</option>
                          {produkList.map(p => <option key={p.id} value={p.id}>{p.nama} ({p.satuan})</option>)}
                        </select>
                      </div>
                      <div className="col-span-2">
                        <input type="number" min="0" value={row.hpp_satuan} onChange={e => updateHppRow(idx, 'hpp_satuan', e.target.value)} onWheel={(e) => (e.target as HTMLInputElement).blur()}
                          className="w-full bg-[#161b22] border border-white/10 rounded-lg px-3 h-10 text-white text-sm focus:outline-none focus:border-green-500/50" placeholder="Rp" />
                      </div>
                      <div className="col-span-2">
                        <input type="number" min="0" step="1" value={row.qty} onChange={e => updateHppRow(idx, 'qty', e.target.value)} onWheel={(e) => (e.target as HTMLInputElement).blur()}
                          className="w-full bg-[#161b22] border border-white/10 rounded-lg px-3 h-10 text-white text-sm focus:outline-none focus:border-green-500/50" placeholder="Qty" />
                      </div>
                      <div className="col-span-2">
                        <p className="text-green-400 font-semibold text-sm px-1">{subtotal > 0 ? formatRp(subtotal) : '-'}</p>
                      </div>
                      <div className="col-span-1">
                        <input type="text" value={row.catatan} onChange={e => updateHppRow(idx, 'catatan', e.target.value)}
                          className="w-full bg-[#161b22] border border-white/10 text-white rounded-lg px-3 h-10 text-sm focus:outline-none focus:border-green-500" placeholder="..." />
                      </div>
                      <div className="col-span-1 flex justify-center">
                        {hppRows.length > 1 && (
                          <button type="button" onClick={() => removeHppRow(idx)} className="w-7 h-7 rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-400 flex items-center justify-center text-xs font-bold">✕</button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="flex items-center justify-between pt-2">
                <button type="button" onClick={addHppRow} className="flex items-center gap-2 text-green-400 hover:text-green-300 text-sm font-medium transition-colors">
                  <span className="w-6 h-6 rounded-full bg-green-500/10 flex items-center justify-center text-base">+</span> Tambah Produk
                </button>
                <div className="flex items-center gap-6">
                  {hppTotalModal > 0 && (
                    <div className="text-right">
                      <p className="text-xs text-gray-400">Total Modal</p>
                      <p className="text-xl font-bold text-green-400">{formatRp(hppTotalModal)}</p>
                    </div>
                  )}
                  <button type="submit" disabled={isHppSubmitting}
                    className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-semibold px-6 py-3 rounded-xl transition-colors">
                    {isHppSubmitting ? "Menyimpan..." : "💾 Simpan HPP"}
                  </button>
                </div>
              </div>
            </form>
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
            <form onSubmit={(e) => { e.preventDefault(); handleOpnameSubmit(); }} className="col-span-2 bg-[#161b22] border border-white/[0.05] rounded-2xl p-6 space-y-4">
              <h3 className="font-bold text-white text-lg">Input Opname</h3>
              <div className="space-y-1.5">
                <label className="text-gray-300 text-sm">Tanggal <span className="text-red-500">*</span></label>
                <input type="date" value={opnameForm.tanggal} onChange={e => setOpnameForm({ ...opnameForm, tanggal: e.target.value })} onClick={e => (e.target as any).showPicker?.()}
                  className="w-full cursor-pointer bg-[#0d1117] border border-white/10 text-white rounded-xl px-4 h-10 text-sm focus:outline-none focus:border-green-500 [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert" />
              </div>
              <div className="space-y-1.5">
                <label className="text-gray-300 text-sm">Produk <span className="text-red-500">*</span></label>
                <select value={opnameForm.produk_id} onChange={e => setOpnameForm({ ...opnameForm, produk_id: e.target.value })}
                  className="w-full bg-[#0d1117] border border-white/10 text-white rounded-xl px-4 h-10 text-sm focus:outline-none focus:border-green-500">
                  <option value="">Pilih produk...</option>
                  {produkList.map(p => <option key={p.id} value={p.id}>{p.nama} ({p.satuan})</option>)}
                </select>
              </div>
              <div className="space-y-1.5 col-span-3 lg:col-span-1">
                <label className="text-gray-400 text-sm">Qty Aktual Fisik</label>
                <input type="number" min="0" step="1" value={opnameForm.qty_aktual} onWheel={(e) => (e.target as HTMLInputElement).blur()}
                  onChange={e => setOpnameForm({ ...opnameForm, qty_aktual: e.target.value })}
                  className="w-full bg-[#161b22] border border-white/10 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-green-500/50" placeholder="0" />
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
              <button type="submit" disabled={isOpnameSubmitting}
                className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors">
                {isOpnameSubmitting ? "Menyimpan..." : "📋 Simpan Opname"}
              </button>
            </form>
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

        {/* KONVERSI TAB */}
        {activeTab === 'konversi' && (
          <div className="space-y-6">
            {/* FORM INPUT */}
            <div className="bg-[#161b22] border border-white/[0.06] rounded-2xl p-6 space-y-5">
              <h3 className="text-white font-bold text-lg">🔄 Input Konversi Produk</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-gray-400 text-sm">Tanggal</label>
                  <input type="date" value={konversiTanggal} onChange={e => setKonversiTanggal(e.target.value)}
                    onClick={e => (e.target as HTMLInputElement).showPicker?.()}
                    className="w-full bg-[#0d1117] border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-green-500/50 cursor-pointer [&::-webkit-calendar-picker-indicator]:invert" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-gray-400 text-sm">Tipe Konversi</label>
                  <select value={konversiTipe} onChange={e => {
                    setKonversiTipe(e.target.value as any)
                    if (e.target.value === '1to1') {
                      setKonversiKeluar([{ arah: 'keluar', produk_id: null, nama_produk: '', satuan: '', qty: '', hpp_satuan: 0, total_nilai: 0 }])
                      setKonversiMasuk([{ arah: 'masuk', produk_id: null, nama_produk: '', satuan: '', qty: '', hpp_satuan: 0, total_nilai: 0 }])
                    }
                  }} className="w-full bg-[#0d1117] border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-green-500/50 cursor-pointer">
                    <option value="1to1">1 → 1 (Tukar Produk)</option>
                    <option value="manyto1">Banyak → 1 (Gabung jadi 1)</option>
                    <option value="1tomany">1 → Banyak (Pisah jadi beberapa)</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-gray-400 text-sm">Catatan</label>
                  <input type="text" value={konversiCatatan} onChange={e => setKonversiCatatan(e.target.value)}
                    placeholder="Alasan konversi..."
                    className="w-full bg-[#0d1117] border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-green-500/50" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                {/* KOLOM KIRI — PRODUK KELUAR */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-red-400 font-semibold text-sm">📤 Produk Keluar</h4>
                    {konversiTipe === 'manyto1' && (
                      <button onClick={() => setKonversiKeluar([...konversiKeluar, { arah: 'keluar', produk_id: null, nama_produk: '', satuan: '', qty: '', hpp_satuan: 0, total_nilai: 0 }])}
                        className="text-xs text-green-400 hover:text-green-300 border border-green-500/20 px-2 py-1 rounded-lg">+ Tambah</button>
                    )}
                  </div>
                  <div className="grid grid-cols-[1fr_80px_90px_80px] gap-2 px-1">
                    <span className="text-xs text-gray-500">Produk</span>
                    <span className="text-xs text-gray-500 text-right">Qty</span>
                    <span className="text-xs text-gray-500 text-right">HPP/Sat</span>
                    <span className="text-xs text-gray-500 text-right">Total</span>
                  </div>
                  {konversiKeluar.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-[1fr_80px_90px_80px] gap-2 items-center bg-[#0d1117] p-2 rounded-xl border border-red-500/10">
                      <select value={item.produk_id || ''} onChange={e => updateKeluar(idx, 'produk_id', e.target.value)}
                        className="w-full bg-[#161b22] border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none">
                        <option value="">Pilih...</option>
                        {produkList.map(p => <option key={p.id} value={p.id}>{p.nama}</option>)}
                      </select>
                      <input type="number" min="0" step="0.1"
                        value={item.qty === 0 ? '' : item.qty}
                        onChange={e => updateKeluar(idx, 'qty', e.target.value)}
                        onWheel={e => (e.target as HTMLInputElement).blur()}
                        placeholder="0"
                        className="w-full bg-[#161b22] border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white text-right focus:outline-none" />
                      <div className="text-xs text-gray-400 text-right font-mono">
                        {item.hpp_satuan > 0 ? `${(item.hpp_satuan / 1000).toFixed(0)}rb` : '-'}
                      </div>
                      <div className="text-xs text-red-400 text-right font-medium">
                        {item.total_nilai > 0 ? `${(item.total_nilai / 1000).toFixed(0)}rb` : '-'}
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-between items-center px-2 pt-1 border-t border-white/5">
                    <span className="text-xs text-gray-500">Total Nilai Keluar</span>
                    <span className="text-sm font-bold text-red-400">{formatRp(konversiKeluar.reduce((a, k) => a + k.total_nilai, 0))}</span>
                  </div>
                </div>

                {/* KOLOM KANAN — PRODUK MASUK */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-green-400 font-semibold text-sm">📥 Produk Masuk</h4>
                    {konversiTipe === '1tomany' && (
                      <button onClick={() => setKonversiMasuk([...konversiMasuk, { arah: 'masuk', produk_id: null, nama_produk: '', satuan: '', qty: '', hpp_satuan: 0, total_nilai: 0 }])}
                        className="text-xs text-green-400 hover:text-green-300 border border-green-500/20 px-2 py-1 rounded-lg">+ Tambah</button>
                    )}
                  </div>
                  <div className="grid grid-cols-[1fr_80px_90px_80px] gap-2 px-1">
                    <span className="text-xs text-gray-500">Produk</span>
                    <span className="text-xs text-gray-500 text-right">Qty</span>
                    <span className="text-xs text-gray-500 text-right">HPP/Sat</span>
                    <span className="text-xs text-gray-500 text-right">Total</span>
                  </div>
                  {konversiMasuk.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-[1fr_80px_90px_80px] gap-2 items-center bg-[#0d1117] p-2 rounded-xl border border-green-500/10">
                      <select value={item.produk_id || ''} onChange={e => updateMasuk(idx, 'produk_id', e.target.value)}
                        className="w-full bg-[#161b22] border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none">
                        <option value="">Pilih...</option>
                        {produkList.map(p => <option key={p.id} value={p.id}>{p.nama}</option>)}
                      </select>
                      <input type="number" min="0" step="0.1"
                        value={item.qty === 0 ? '' : item.qty}
                        onChange={e => updateMasuk(idx, 'qty', e.target.value)}
                        onWheel={e => (e.target as HTMLInputElement).blur()}
                        placeholder="0"
                        className="w-full bg-[#161b22] border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white text-right focus:outline-none" />
                      <div className="text-xs text-green-400/70 text-right font-mono">
                        {item.hpp_satuan > 0 ? `${(item.hpp_satuan / 1000).toFixed(0)}rb` : '-'}
                      </div>
                      <div className="text-xs text-green-400 text-right font-medium">
                        {item.total_nilai > 0 ? `${(item.total_nilai / 1000).toFixed(0)}rb` : '-'}
                      </div>
                    </div>
                  ))}
                  <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl px-3 py-2">
                    <p className="text-blue-400 text-xs">💡 HPP produk masuk dihitung otomatis dari total nilai keluar ÷ total qty masuk</p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button onClick={handleSimpanKonversi} disabled={isKonversiSubmitting}
                  className="bg-green-600 hover:bg-green-500 text-white font-semibold px-6 py-2.5 rounded-xl text-sm disabled:opacity-50 transition-colors">
                  {isKonversiSubmitting ? 'Menyimpan...' : '💾 Simpan Konversi'}
                </button>
              </div>
            </div>

            {/* RIWAYAT KONVERSI */}
            <div className="bg-[#161b22] border border-white/[0.06] rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
                <h3 className="text-white font-bold text-lg">📋 Riwayat Konversi</h3>
                {isKonversiLoading && <div className="w-4 h-4 rounded-full border-2 border-t-green-500 animate-spin" />}
              </div>
              {konversiList.length === 0 ? (
                <div className="p-12 text-center text-gray-500">
                  <span className="text-4xl block mb-3 opacity-40">🔄</span>
                  Belum ada riwayat konversi
                </div>
              ) : (
                <div className="divide-y divide-white/[0.04]">
                  {konversiList.map(k => {
                    const keluarItems = k.konversi_stok_detail.filter(d => d.arah === 'keluar')
                    const masukItems = k.konversi_stok_detail.filter(d => d.arah === 'masuk')
                    const isExpanded = expandedKonversi.has(k.id)
                    const tipeLabel = k.tipe === '1to1' ? '1→1' : k.tipe === 'manyto1' ? 'Banyak→1' : '1→Banyak'
                    const tipeBadge = k.tipe === '1to1' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                      : k.tipe === 'manyto1' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                      : 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                    return (
                      <div key={k.id} className="hover:bg-white/[0.01] transition-colors">
                        <div className="flex items-center gap-4 px-6 py-4">
                          <div className="text-sm text-gray-400 w-28 shrink-0">
                            {new Date(k.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium shrink-0 ${tipeBadge}`}>{tipeLabel}</span>
                          <div className="flex-1 flex items-center gap-2 min-w-0">
                            <span className="text-red-400 text-sm truncate">{keluarItems.map(d => `${d.nama_produk} (${d.qty} ${d.satuan})`).join(' + ')}</span>
                            <span className="text-gray-500 shrink-0">→</span>
                            <span className="text-green-400 text-sm truncate">{masukItems.map(d => `${d.nama_produk} (${d.qty} ${d.satuan})`).join(' + ')}</span>
                          </div>
                          {k.catatan && <span className="text-xs text-gray-500 italic shrink-0 max-w-[150px] truncate" title={k.catatan}>{k.catatan}</span>}
                          <div className="flex items-center gap-2 shrink-0">
                            <button onClick={() => toggleExpandedKonversi(k.id)}
                              className="text-xs px-3 py-1.5 rounded-lg bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
                              {isExpanded ? '▲ Tutup' : '▼ Detail'}
                            </button>
                            <button onClick={() => handleHapusKonversi(k.id)}
                              className="text-xs px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors">
                              🗑️ Hapus
                            </button>
                          </div>
                        </div>
                        {isExpanded && (
                          <div className="px-6 pb-4">
                            <div className="bg-[#0d1117] rounded-xl border border-white/5 overflow-hidden">
                              <table className="w-full text-sm">
                                <thead className="border-b border-white/5 bg-white/[0.02]">
                                  <tr>
                                    <th className="px-4 py-2 text-left text-xs text-gray-500 uppercase">Arah</th>
                                    <th className="px-4 py-2 text-left text-xs text-gray-500 uppercase">Produk</th>
                                    <th className="px-4 py-2 text-right text-xs text-gray-500 uppercase">Qty</th>
                                    <th className="px-4 py-2 text-right text-xs text-gray-500 uppercase">HPP/Sat</th>
                                    <th className="px-4 py-2 text-right text-xs text-gray-500 uppercase">Total Nilai</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-white/[0.03]">
                                  {k.konversi_stok_detail.map((d, i) => (
                                    <tr key={i} className="hover:bg-white/[0.01]">
                                      <td className="px-4 py-2">
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${d.arah === 'keluar' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-green-500/10 text-green-400 border-green-500/20'}`}>
                                          {d.arah === 'keluar' ? '📤 Keluar' : '📥 Masuk'}
                                        </span>
                                      </td>
                                      <td className="px-4 py-2 text-white font-medium">{d.nama_produk}</td>
                                      <td className="px-4 py-2 text-right text-gray-300">{d.qty} {d.satuan}</td>
                                      <td className="px-4 py-2 text-right text-gray-300">{formatRp(d.hpp_satuan)}</td>
                                      <td className={`px-4 py-2 text-right font-semibold ${d.arah === 'keluar' ? 'text-red-400' : 'text-green-400'}`}>
                                        {d.arah === 'keluar' ? '-' : '+'}{formatRp(d.total_nilai)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                                <tfoot className="border-t border-white/10 bg-white/[0.02]">
                                  <tr>
                                    <td colSpan={4} className="px-4 py-2 text-xs text-gray-500">Selisih nilai (jika ada) masuk sebagai penyesuaian stok</td>
                                    <td className="px-4 py-2 text-right text-xs text-gray-400">
                                      {(() => {
                                        const totalKeluar = k.konversi_stok_detail.filter(d => d.arah === 'keluar').reduce((a, d) => a + d.total_nilai, 0)
                                        const totalMasuk = k.konversi_stok_detail.filter(d => d.arah === 'masuk').reduce((a, d) => a + d.total_nilai, 0)
                                        const selisih = totalMasuk - totalKeluar
                                        return selisih === 0 ? '✅ Seimbang' : `Selisih: ${formatRp(Math.abs(selisih))}`
                                      })()}
                                    </td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Set Stok Awal Modal */}
      {showStokAwalModal && (
        <div ref={stokAwalModalRef} tabIndex={-1} onKeyDown={handleStokAwalModalKeyDown} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm outline-none">
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
                <input type="number" min="0" step="1" value={stokAwalForm.qty} onChange={e => setStokAwalForm({ ...stokAwalForm, qty: e.target.value })} onWheel={(e) => (e.target as HTMLInputElement).blur()}
                  className="w-full bg-[#0d1117] border border-white/10 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-green-500" placeholder="0" />
              </div>
              <div className="space-y-1.5">
                <label className="text-gray-300 text-sm">HPP Satuan (Rp) <span className="text-red-500">*</span></label>
                <input type="number" min="0" value={stokAwalForm.hpp_satuan} onChange={e => setStokAwalForm({ ...stokAwalForm, hpp_satuan: e.target.value })} onWheel={(e) => (e.target as HTMLInputElement).blur()}
                  className="w-full bg-[#0d1117] border border-white/10 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-green-500" placeholder="0" />
                <p className="text-xs text-gray-500">Harga beli per satuan produk ini</p>
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

      {/* Detail Stok Modal */}
      {detailProduk && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#161b22] border border-white/10 rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-6 border-b border-white/5">
              <div>
                <h3 className="text-lg font-bold text-white">📊 Riwayat Pergerakan Stok</h3>
                <p className="text-green-400 font-semibold mt-0.5">{detailProduk.nama_produk}</p>
              </div>
              <button onClick={() => { setDetailProduk(null); setDetailData(null) }}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400">✕</button>
            </div>

            {/* Summary bar */}
            <div className="grid grid-cols-3 gap-4 px-6 py-4 bg-[#0d1117]/50 border-b border-white/5">
              <div className="text-center">
                <p className="text-xs text-gray-500">Total Masuk</p>
                <p className="text-lg font-bold text-green-400">+{detailProduk.total_masuk} {detailProduk.satuan}</p>
              </div>
              <div className="text-center border-x border-white/5">
                <p className="text-xs text-gray-500">Total Keluar</p>
                <p className="text-lg font-bold text-red-400">-{detailProduk.total_keluar} {detailProduk.satuan}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500">Stok Akhir</p>
                <p className="text-lg font-bold text-white">{detailProduk.stok_akhir} {detailProduk.satuan}</p>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 p-6 space-y-6">
              {isDetailLoading ? (
                <div className="py-12 flex flex-col items-center text-gray-400">
                  <div className="w-8 h-8 border-4 border-green-500/30 border-t-green-500 rounded-full animate-spin mb-3"></div>
                  Memuat riwayat...
                </div>
              ) : detailData && (
                <>
                  {/* Barang Masuk */}
                  <div>
                    <h4 className="text-sm font-bold text-green-400 mb-3 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-green-400"></span> 📥 Barang Masuk ({detailData.masuk.length})
                    </h4>
                    {detailData.masuk.length === 0 ? (
                      <p className="text-gray-500 text-sm italic px-2">Belum ada data masuk</p>
                    ) : (
                      <table className="w-full text-sm text-gray-300">
                        <thead className="text-xs text-gray-400 uppercase bg-[#0d1117]/80 border-b border-white/[0.05]">
                          <tr>
                            <th className="px-4 py-2 text-left">Tanggal</th>
                            <th className="px-4 py-2 text-left">Supplier</th>
                            <th className="px-4 py-2 text-right">Qty</th>
                            <th className="px-4 py-2 text-right">HPP/sat</th>
                            <th className="px-4 py-2 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.02]">
                          {detailData.masuk.map(h => (
                            <tr key={h.id} className="hover:bg-white/[0.01]">
                              <td className="px-4 py-2.5 text-gray-400">{formatDate(h.tanggal)}</td>
                              <td className="px-4 py-2.5">{h.nama_supplier || "-"}</td>
                              <td className="px-4 py-2.5 text-right text-green-400 font-semibold">+{h.qty} {h.satuan}</td>
                              <td className="px-4 py-2.5 text-right">{formatRp(h.hpp_satuan)}</td>
                              <td className="px-4 py-2.5 text-right font-semibold text-green-400">{formatRp(h.total_modal)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>

                  {/* Barang Keluar */}
                  <div>
                    <h4 className="text-sm font-bold text-red-400 mb-3 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-red-400"></span> 📤 Barang Keluar (Terjual) ({detailData.keluar.length})
                    </h4>
                    {detailData.keluar.length === 0 ? (
                      <p className="text-gray-500 text-sm italic px-2">Belum ada penjualan</p>
                    ) : (
                      <table className="w-full text-sm text-gray-300">
                        <thead className="text-xs text-gray-400 uppercase bg-[#0d1117]/80 border-b border-white/[0.05]">
                          <tr>
                            <th className="px-4 py-2 text-left">Tanggal</th>
                            <th className="px-4 py-2 text-left">No Nota</th>
                            <th className="px-4 py-2 text-left">Pembeli</th>
                            <th className="px-4 py-2 text-right">Qty</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.02]">
                          {detailData.keluar.map(k => (
                            <tr key={k.id} className="hover:bg-white/[0.01]">
                              <td className="px-4 py-2.5 text-gray-400">{k.transaksi ? formatDate(k.transaksi.tanggal) : '-'}</td>
                              <td className="px-4 py-2.5 font-mono text-xs text-gray-300">{k.transaksi?.no_nota || '-'}</td>
                              <td className="px-4 py-2.5">{k.transaksi?.nama_pembeli || '-'}</td>
                              <td className="px-4 py-2.5 text-right text-red-400 font-semibold">-{k.qty} {detailProduk.satuan}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>

                  {/* Opname */}
                  <div>
                    <h4 className="text-sm font-bold text-blue-400 mb-3 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-400"></span> 📋 Opname ({detailData.opname.length})
                    </h4>
                    {detailData.opname.length === 0 ? (
                      <p className="text-gray-500 text-sm italic px-2">Belum ada data opname</p>
                    ) : (
                      <table className="w-full text-sm text-gray-300">
                        <thead className="text-xs text-gray-400 uppercase bg-[#0d1117]/80 border-b border-white/[0.05]">
                          <tr>
                            <th className="px-4 py-2 text-left">Tanggal</th>
                            <th className="px-4 py-2 text-right">Stok Sistem</th>
                            <th className="px-4 py-2 text-right">Stok Aktual</th>
                            <th className="px-4 py-2 text-right">Selisih</th>
                            <th className="px-4 py-2 text-left">Catatan</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.02]">
                          {detailData.opname.map(o => (
                            <tr key={o.id} className="hover:bg-white/[0.01]">
                              <td className="px-4 py-2.5 text-gray-400">{formatDate(o.tanggal)}</td>
                              <td className="px-4 py-2.5 text-right">{o.qty_sistem} {o.satuan}</td>
                              <td className="px-4 py-2.5 text-right">{o.qty_aktual} {o.satuan}</td>
                              <td className={`px-4 py-2.5 text-right font-semibold ${o.selisih >= 0 ? 'text-blue-400' : 'text-orange-400'}`}>
                                {o.selisih >= 0 ? '+' : ''}{o.selisih} {o.satuan}
                              </td>
                              <td className="px-4 py-2.5 text-gray-500 text-xs">{o.catatan || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="p-4 border-t border-white/5">
              <button onClick={() => { setDetailProduk(null); setDetailData(null) }}
                className="w-full py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl font-medium transition-colors">
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
