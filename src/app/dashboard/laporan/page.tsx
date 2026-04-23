"use client"

import { useState, useEffect, useMemo } from "react"
import { supabase } from "@/utils/supabase/client"
import { Calendar, DollarSign, Package, Users, Banknote, CreditCard, Wallet, TrendingUp } from "lucide-react"
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, Sector
} from "recharts"

type Transaksi = {
  id: number
  no_nota: string
  tanggal: string
  nama_pembeli: string
  jenis_pembayaran: string
  total: number
}

type TransaksiDetail = {
  id: number
  transaksi_id: number
  nama_produk: string
  qty: number
  harga: number
  subtotal: number
}

type Pengeluaran = {
  id: number
  tanggal: string
  kategori: string
  keterangan: string
  sub_kategori: string
  jumlah: number
}

type HPP = {
  id: number
  tanggal: string
  total_modal: number
}

type HPPFull = {
  id: number
  tanggal: string
  nama_produk: string
  qty: number
  hpp_satuan: number
  total_modal: number
}

type ProdukRow = {
  id: number
  nama: string
  stok_awal: number
}

type OpnameRecord = {
  id: number
  tanggal: string
  nama_produk: string
  selisih: number
}

type DetailWithDate = {
  nama_produk: string
  qty: number
  transaksi: { tanggal: string }[] | { tanggal: string } | null
}

const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
]

type Tab = 'penjualan' | 'pengeluaran' | 'laba' | 'labarugi' | 'neraca' | 'aruskas'

type KasMasukItem = {
  tanggal: string
  keterangan: string
  kategori: "Tunai" | "Transfer" | "Bayar Piutang"
  jumlah: number
}

type KasKeluarItem = {
  tanggal: string
  keterangan: string
  kategori: string
  jumlah: number
}

export default function LaporanPage() {
  const currentDate = new Date()
  const [activeTab, setActiveTab] = useState<Tab>('penjualan')
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth())
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear())

  const [transaksi, setTransaksi] = useState<Transaksi[]>([])
  const [transaksiDetail, setTransaksiDetail] = useState<TransaksiDetail[]>([])
  const [pengeluaran, setPengeluaran] = useState<Pengeluaran[]>([])
  const [hppList, setHppList] = useState<HPP[]>([])
  const [produkList, setProdukList] = useState<ProdukRow[]>([])
  const [hppAllList, setHppAllList] = useState<HPPFull[]>([])
  const [opnameAllList, setOpnameAllList] = useState<OpnameRecord[]>([])
  const [detailAllList, setDetailAllList] = useState<DetailWithDate[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Arus Kas State
  const [kasMasukList, setKasMasukList] = useState<KasMasukItem[]>([])
  const [kasKeluarList, setKasKeluarList] = useState<KasKeluarItem[]>([])
  const [isLoadingArusKas, setIsLoadingArusKas] = useState(false)
  const [saldoAwalArusKas, setSaldoAwalArusKas] = useState(0)

  // Neraca State
  const [saldoAwal, setSaldoAwal] = useState(0)
  const [totalPiutangNeraca, setTotalPiutangNeraca] = useState(0)
  const [totalUtangNeraca, setTotalUtangNeraca] = useState(0)
  const [nilaiStokNeraca, setNilaiStokNeraca] = useState(0)
  const [kasBankNeraca, setKasBankNeraca] = useState(0)
  const [labaBersihKumulatif, setLabaBersihKumulatif] = useState(0)
  const [isLoadingNeraca, setIsLoadingNeraca] = useState(false)

  // Neraca Manual Input State
  const [neracaKas, setNeracaKas] = useState<number>(0)
  const [neracaBank, setNeracaBank] = useState<number>(0)
  const [neracaPeralatan, setNeracaPeralatan] = useState<number>(0)
  const [neracaKendaraan, setNeracaKendaraan] = useState<number>(0)
  const [neracaTanahBangunan, setNeracaTanahBangunan] = useState<number>(0)
  const [neracaHutangModal, setNeracaHutangModal] = useState<number>(0)
  const [neracaModalUsaha, setNeracaModalUsaha] = useState<number>(0)

  const years = Array.from({ length: currentDate.getFullYear() - 2024 + 2 }, (_, i) => 2024 + i)

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)

      const startDate = new Date(selectedYear, selectedMonth, 1)
      const endDate = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59, 999)
      const startStr = startDate.toISOString().split('T')[0]
      const endStr = endDate.toISOString().split('T')[0]

      const [trxRes, pengeluaranRes, hppRes, produkRes, hppAllRes, opnameAllRes, detailAllRes] = await Promise.all([
        supabase.from("transaksi").select("*").gte("tanggal", startDate.toISOString()).lte("tanggal", endDate.toISOString()),
        supabase.from("pengeluaran").select("*").gte("tanggal", startStr).lte("tanggal", endStr).order("tanggal", { ascending: false }),
        supabase.from("hpp").select("id, tanggal, total_modal").gte("tanggal", startStr).lte("tanggal", endStr),
        supabase.from("produk").select("id, nama, stok_awal"),
        supabase.from("hpp").select("id, tanggal, nama_produk, qty, hpp_satuan, total_modal").order("tanggal", { ascending: true }),
        supabase.from("opname").select("id, tanggal, nama_produk, selisih").order("tanggal", { ascending: true }),
        supabase.from("transaksi_detail").select("nama_produk, qty, transaksi!inner(tanggal)"),
      ])

      const trxData = trxRes.data as Transaksi[] || []
      setTransaksi(trxData)
      if (pengeluaranRes.data) setPengeluaran(pengeluaranRes.data as Pengeluaran[])
      if (hppRes.data) setHppList(hppRes.data as HPP[])
      if (produkRes.data) setProdukList(produkRes.data as ProdukRow[])
      if (hppAllRes.data) setHppAllList(hppAllRes.data as HPPFull[])
      if (opnameAllRes.data) setOpnameAllList(opnameAllRes.data as OpnameRecord[])
      if (detailAllRes.data) setDetailAllList(detailAllRes.data as unknown as DetailWithDate[])

      if (trxData.length > 0) {
        const trxIds = trxData.map(t => t.id)
        const { data: detailData } = await supabase.from("transaksi_detail").select("*").in("transaksi_id", trxIds)
        setTransaksiDetail(detailData as TransaksiDetail[] || [])
      } else {
        setTransaksiDetail([])
      }

      setIsLoading(false)
    }

    fetchData()
  }, [selectedMonth, selectedYear])

  // Fetch Arus Kas
  useEffect(() => {
    if (activeTab !== 'aruskas') return
    const fetchArusKas = async () => {
      setIsLoadingArusKas(true)
      try {
        const { data: configData } = await supabase.from('pengaturan').select('value').eq('key', 'saldo_awal_kas').single()
        setSaldoAwalArusKas(parseFloat(configData?.value || "0") || 0)

        const mm = String(selectedMonth + 1).padStart(2, "0")
        const lastDay = new Date(selectedYear, selectedMonth + 1, 0).getDate()
        const startStr = `${selectedYear}-${mm}-01`
        const endStr = `${selectedYear}-${mm}-${String(lastDay).padStart(2, "0")}`
        const startDate = new Date(selectedYear, selectedMonth, 1)
        const endDate = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59, 999)

        const [trxRes, piutangRes, pengeluaranRes, utangRes] = await Promise.all([
          supabase
            .from("transaksi")
            .select("tanggal, jenis_pembayaran, total, no_nota, nama_pembeli")
            .in("jenis_pembayaran", ["Tunai", "Transfer"])
            .gte("tanggal", startDate.toISOString())
            .lte("tanggal", endDate.toISOString())
            .order("tanggal", { ascending: true }),
          supabase
            .from("piutang")
            .select("tanggal_lunas, terbayar, nama_pembeli, no_nota, metode_bayar")
            .eq("status", "lunas")
            .gte("tanggal_lunas", startStr)
            .lte("tanggal_lunas", endStr),
          supabase
            .from("pengeluaran")
            .select("*")
            .gte("tanggal", startStr)
            .lte("tanggal", endStr)
            .order("tanggal", { ascending: true }),
          supabase
            .from("utang_supplier")
            .select("tanggal_lunas, terbayar, nama_supplier")
            .eq("status", "lunas")
            .gte("tanggal_lunas", startStr)
            .lte("tanggal_lunas", endStr),
        ])

        const masuk: KasMasukItem[] = []
        if (trxRes.data) {
          trxRes.data.forEach((tx: any) => {
            masuk.push({
              tanggal: tx.tanggal.split("T")[0],
              keterangan: `${tx.nama_pembeli} – ${tx.no_nota}`,
              kategori: tx.jenis_pembayaran as "Tunai" | "Transfer",
              jumlah: tx.total,
            })
          })
        }
        if (piutangRes.data) {
          piutangRes.data.forEach((p: any) => {
            if ((p.terbayar ?? 0) > 0) {
              const piutangKategori = p.metode_bayar === 'Transfer' ? 'Transfer (Piutang)' : 'Tunai (Piutang)'
              masuk.push({
                tanggal: p.tanggal_lunas,
                keterangan: `Bayar piutang – ${p.nama_pembeli} (${p.no_nota})`,
                kategori: piutangKategori as any,
                jumlah: p.terbayar,
              })
            }
          })
        }
        masuk.sort((a, b) => a.tanggal.localeCompare(b.tanggal))
        setKasMasukList(masuk)

        const keluar: KasKeluarItem[] = []
        if (pengeluaranRes.data) {
          pengeluaranRes.data.forEach((p: any) => {
            keluar.push({
              tanggal: p.tanggal,
              keterangan: p.keterangan || p.sub_kategori || p.kategori,
              kategori: p.kategori,
              jumlah: p.jumlah,
            })
          })
        }
        if (utangRes.data) {
          utangRes.data.forEach((u: any) => {
            if ((u.terbayar ?? 0) > 0) {
              keluar.push({
                tanggal: u.tanggal_lunas,
                keterangan: `Bayar utang – ${u.nama_supplier}`,
                kategori: "Bayar Utang",
                jumlah: u.terbayar,
              })
            }
          })
        }
        keluar.sort((a, b) => a.tanggal.localeCompare(b.tanggal))
        setKasKeluarList(keluar)
      } catch (err) {
        console.error("Arus kas fetch error:", err)
      } finally {
        setIsLoadingArusKas(false)
      }
    }
    fetchArusKas()
  }, [activeTab, selectedMonth, selectedYear])

  // Fetch Neraca
  useEffect(() => {
    if (activeTab !== 'neraca') return
    const fetchNeraca = async () => {
      setIsLoadingNeraca(true)
      try {
        const endDate = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59, 999)
        const endStr = endDate.toISOString().split('T')[0]
        const endIso = endDate.toISOString()

        // 1. Fetch Manual Configs
        const keys = [
          'saldo_awal_kas', 'neraca_kas', 'neraca_bank', 'neraca_peralatan', 
          'neraca_kendaraan', 'neraca_tanah_bangunan', 'neraca_hutang_modal', 'neraca_modal_usaha'
        ]
        const { data: configData } = await supabase.from('pengaturan').select('key, value').in('key', keys)
        const cMap: Record<string, number> = {}
        configData?.forEach(c => { cMap[c.key] = parseFloat(c.value || "0") || 0 })
        
        const sa = cMap['saldo_awal_kas'] || 0
        setSaldoAwal(sa)
        setNeracaKas(cMap['neraca_kas'] || 0)
        setNeracaBank(cMap['neraca_bank'] || 0)
        setNeracaPeralatan(cMap['neraca_peralatan'] || 0)
        setNeracaKendaraan(cMap['neraca_kendaraan'] || 0)
        setNeracaTanahBangunan(cMap['neraca_tanah_bangunan'] || 0)
        setNeracaHutangModal(cMap['neraca_hutang_modal'] || 0)
        setNeracaModalUsaha(cMap['neraca_modal_usaha'] || 0)

        // 2. Piutang Usaha
        const { data: piutangData } = await supabase.from('piutang').select('sisa').eq('status', 'belum lunas').lte('tanggal', endIso)
        setTotalPiutangNeraca((piutangData || []).reduce((acc, curr) => acc + curr.sisa, 0))

        // 3. Utang Supplier
        const { data: utangData } = await supabase.from('utang_supplier').select('sisa').eq('status', 'belum lunas').lte('tanggal', endIso)
        setTotalUtangNeraca((utangData || []).reduce((acc, curr) => acc + curr.sisa, 0))

        // 4. Nilai Stok
        const [produkRes, hppAllRes, opnameRes, trxDetailRes] = await Promise.all([
          supabase.from('produk').select('id, nama, stok_awal'),
          supabase.from('hpp').select('nama_produk, qty, hpp_satuan').lte('tanggal', endStr).order('tanggal', { ascending: true }),
          supabase.from('opname').select('nama_produk, selisih').lte('tanggal', endStr),
          supabase.from('transaksi_detail').select('nama_produk, qty, transaksi!inner(tanggal)')
        ])
        const produkListN = produkRes.data || []
        const hppListN = hppAllRes.data || []
        const opnameListN = opnameRes.data || []
        const detailListN = (trxDetailRes.data || []) as any[]
        const filteredDetailListN = detailListN.filter(d => {
          const t = d.transaksi
          const dateStr = Array.isArray(t) ? t[0]?.tanggal : t?.tanggal
          return dateStr && new Date(dateStr) <= endDate
        })

        const allNames = Array.from(new Set([...produkListN.map(p => p.nama), ...hppListN.map(h => h.nama_produk)]))
        const hppSatuanMap: Record<string, number> = {}
        hppListN.forEach(h => { hppSatuanMap[h.nama_produk] = h.hpp_satuan })
        const stokAwalMap: Record<string, number> = {}
        produkListN.forEach(p => { stokAwalMap[p.nama] = p.stok_awal })

        let ns = 0
        for (const nama of allNames) {
          const hppSatuan = hppSatuanMap[nama] || 0
          if (!hppSatuan) continue
          const masuk = hppListN.filter(h => h.nama_produk === nama).reduce((a, h) => a + h.qty, 0)
          const keluar = filteredDetailListN.filter(d => d.nama_produk === nama).reduce((a, d) => a + d.qty, 0)
          const opname = opnameListN.filter(o => o.nama_produk === nama).reduce((a, o) => a + o.selisih, 0)
          const qty = (stokAwalMap[nama] || 0) + masuk - keluar + opname
          ns += Math.max(0, qty) * hppSatuan
        }
        setNilaiStokNeraca(ns)

        // 5. Kas Bank
        const [trxRes, piutangLunasRes, pengeluaranRes, utangLunasRes, hppModalRes] = await Promise.all([
          supabase.from('transaksi').select('total, jenis_pembayaran').lte('tanggal', endIso),
          supabase.from('piutang').select('terbayar').eq('status', 'lunas').lte('tanggal_lunas', endStr),
          supabase.from('pengeluaran').select('jumlah').lte('tanggal', endStr),
          supabase.from('utang_supplier').select('terbayar').eq('status', 'lunas').lte('tanggal_lunas', endStr),
          supabase.from('hpp').select('total_modal').lte('tanggal', endStr)
        ])

        const trxDataN = trxRes.data || []
        const kasKeluarPengeluaran = (pengeluaranRes.data || []).reduce((a, p) => a + p.jumlah, 0)

        const totalOmzet = trxDataN.reduce((a, t) => a + t.total, 0)
        const totalHPP = (hppModalRes.data || []).reduce((a, h) => a + h.total_modal, 0)
        setLabaBersihKumulatif(totalOmzet - totalHPP - kasKeluarPengeluaran)
      } catch (err) {
        console.error("Neraca fetch error:", err)
      } finally {
        setIsLoadingNeraca(false)
      }
    }
    fetchNeraca()
  }, [activeTab, selectedMonth, selectedYear])

  const formatRp = (num: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(num)

  // Penjualan
  const omzet = useMemo(() => {
    let total = 0, tunai = 0, transfer = 0, piutang = 0
    transaksi.forEach(t => {
      total += t.total
      if (t.jenis_pembayaran === "Tunai") tunai += t.total
      else if (t.jenis_pembayaran === "Transfer") transfer += t.total
      else if (t.jenis_pembayaran === "Piutang") piutang += t.total
    })
    return { total, tunai, transfer, piutang }
  }, [transaksi])

  const topProducts = useMemo(() => {
    const map: Record<string, number> = {}
    transaksiDetail.forEach(td => { map[td.nama_produk] = (map[td.nama_produk] || 0) + td.qty })
    return Object.entries(map).map(([nama, qty]) => ({ nama, qty })).sort((a, b) => b.qty - a.qty).slice(0, 10)
  }, [transaksiDetail])

  const topCustomers = useMemo(() => {
    const map: Record<string, number> = {}
    transaksi.forEach(t => { map[t.nama_pembeli] = (map[t.nama_pembeli] || 0) + t.total })
    return Object.entries(map).map(([nama, total]) => ({ nama, total })).sort((a, b) => b.total - a.total).slice(0, 10)
  }, [transaksi])

  // Pengeluaran
  const totalPengeluaran = useMemo(() => pengeluaran.reduce((acc, p) => acc + p.jumlah, 0), [pengeluaran])

  const breakdownKategori = useMemo(() => {
    const map: Record<string, number> = {}
    pengeluaran.forEach(p => { map[p.kategori] = (map[p.kategori] || 0) + p.jumlah })
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5)
  }, [pengeluaran])

  const pengeluaranPerKategori = useMemo(() => {
    const map: Record<string, number> = {}
    pengeluaran.forEach(p => { map[p.kategori] = (map[p.kategori] || 0) + p.jumlah })
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }, [pengeluaran])

  // Laba
  const totalHPP = useMemo(() => hppList.reduce((acc, h) => acc + h.total_modal, 0), [hppList])

  const cogsData = useMemo(() => {
    const startDate = new Date(selectedYear, selectedMonth, 1)
    const endDate = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59, 999)

    const allNama = Array.from(new Set([
      ...produkList.map(p => p.nama),
      ...hppAllList.map(h => h.nama_produk),
    ]))

    const hppSatuanMap: Record<string, number> = {}
    hppAllList.forEach(h => { hppSatuanMap[h.nama_produk] = h.hpp_satuan })

    const stokAwalProduk: Record<string, number> = {}
    produkList.forEach(p => { stokAwalProduk[p.nama] = p.stok_awal })

    const getTanggal = (d: DetailWithDate): string | null => {
      if (!d.transaksi) return null
      if (Array.isArray(d.transaksi)) return d.transaksi[0]?.tanggal ?? null
      return d.transaksi.tanggal
    }

    let totalNilaiStokAwal = 0
    let totalNilaiStokAkhir = 0

    for (const nama of allNama) {
      const hppSatuan = hppSatuanMap[nama] || 0
      if (!hppSatuan) continue

      const masukSebelum = hppAllList.filter(h => h.nama_produk === nama && new Date(h.tanggal) < startDate).reduce((a, h) => a + h.qty, 0)
      const keluarSebelum = detailAllList.filter(d => { const t = getTanggal(d); return d.nama_produk === nama && t && new Date(t) < startDate }).reduce((a, d) => a + d.qty, 0)
      const opnameSebelum = opnameAllList.filter(o => o.nama_produk === nama && new Date(o.tanggal) < startDate).reduce((a, o) => a + o.selisih, 0)
      const stokAwalQty = (stokAwalProduk[nama] || 0) + masukSebelum - keluarSebelum + opnameSebelum

      const masukBulan = hppAllList.filter(h => h.nama_produk === nama && new Date(h.tanggal) >= startDate && new Date(h.tanggal) <= endDate).reduce((a, h) => a + h.qty, 0)
      const keluarBulan = detailAllList.filter(d => { const t = getTanggal(d); return d.nama_produk === nama && t && new Date(t) >= startDate && new Date(t) <= endDate }).reduce((a, d) => a + d.qty, 0)
      const opnameBulan = opnameAllList.filter(o => o.nama_produk === nama && new Date(o.tanggal) >= startDate && new Date(o.tanggal) <= endDate).reduce((a, o) => a + o.selisih, 0)
      const stokAkhirQty = stokAwalQty + masukBulan - keluarBulan + opnameBulan

      totalNilaiStokAwal += Math.max(0, stokAwalQty) * hppSatuan
      totalNilaiStokAkhir += Math.max(0, stokAkhirQty) * hppSatuan
    }

    const pembelianBulan = totalHPP
    const cogs = totalNilaiStokAwal + pembelianBulan - totalNilaiStokAkhir
    return { totalNilaiStokAwal, pembelianBulan, totalNilaiStokAkhir, cogs }
  }, [produkList, hppAllList, detailAllList, opnameAllList, selectedMonth, selectedYear, totalHPP])

  const labaKotor = omzet.total - cogsData.cogs
  const labaBersih = labaKotor - totalPengeluaran

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const pct = (val: number, base: number) => base > 0 ? `${((val / base) * 100).toFixed(1)}%` : '-'

  const fmtShort = (v: number) => {
    if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}jt`
    if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(0)}rb`
    return `${v}`
  }

  // ── Arus Kas Calculations ───────────────────────────────────────────────────
  const totalMasuk = useMemo(() => kasMasukList.reduce((acc, k) => acc + k.jumlah, 0), [kasMasukList])
  const totalKeluar = useMemo(() => kasKeluarList.reduce((acc, k) => acc + k.jumlah, 0), [kasKeluarList])
  const arusKasBersih = totalMasuk - totalKeluar

  const chartDataArusKas = useMemo(() => {
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate()
    const mm = String(selectedMonth + 1).padStart(2, "0")
    return Array.from({ length: daysInMonth }, (_, i) => {
      const d = i + 1
      const dateStr = `${selectedYear}-${mm}-${String(d).padStart(2, "0")}`
      const masuk = kasMasukList.filter(k => k.tanggal === dateStr).reduce((a, k) => a + k.jumlah, 0)
      const keluar = kasKeluarList.filter(k => k.tanggal === dateStr).reduce((a, k) => a + k.jumlah, 0)
      return { date: String(d), masuk, keluar }
    })
  }, [kasMasukList, kasKeluarList, selectedMonth, selectedYear])

  const saldoDataArusKas = useMemo(() => {
    let cum = saldoAwalArusKas
    return chartDataArusKas.map(d => {
      cum += d.masuk - d.keluar
      return { date: d.date, saldo: cum }
    })
  }, [chartDataArusKas, saldoAwalArusKas])

  const formatDate = (str: string) =>
    new Date(str + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })

  const badgeMasuk = (kat: string) => {
    if (kat === 'Tunai') return 'bg-green-500/10 text-green-400 border-green-500/20'
    if (kat === 'Transfer') return 'bg-blue-500/10 text-blue-400 border-blue-500/20'
    if (kat === 'Tunai (Piutang)') return 'bg-green-500/10 text-green-400 border-green-500/20'
    if (kat === 'Transfer (Piutang)') return 'bg-blue-500/10 text-blue-400 border-blue-500/20'
    return 'bg-teal-500/10 text-teal-400 border-teal-500/20'
  }

  const badgeKeluar = (kat: string) => {
    if (kat === "Bayar Utang") return "bg-red-500/10 text-red-400 border-red-500/20"
    return "bg-orange-500/10 text-orange-400 border-orange-500/20"
  }

  // ── Neraca Calculations ───────────────────────────────────────────────────
  const asetLancar = neracaKas + neracaBank + totalPiutangNeraca + nilaiStokNeraca
  const totalAsetTetap = neracaPeralatan + neracaKendaraan + neracaTanahBangunan
  const totalAset = asetLancar + totalAsetTetap
  const totalKewajiban = totalUtangNeraca + neracaHutangModal
  const totalEkuitas = neracaModalUsaha + labaBersihKumulatif
  const totalKewajibanEkuitas = totalKewajiban + totalEkuitas
  const isBalance = Math.abs(totalAset - totalKewajibanEkuitas) < 1

  const endDate = new Date(selectedYear, selectedMonth + 1, 0)
  const endDateStr = endDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
  
  const handleSimpanNeraca = async () => {
    const entries = [
      { key: 'neraca_kas', value: String(neracaKas) },
      { key: 'neraca_bank', value: String(neracaBank) },
      { key: 'neraca_peralatan', value: String(neracaPeralatan) },
      { key: 'neraca_kendaraan', value: String(neracaKendaraan) },
      { key: 'neraca_tanah_bangunan', value: String(neracaTanahBangunan) },
      { key: 'neraca_hutang_modal', value: String(neracaHutangModal) },
      { key: 'neraca_modal_usaha', value: String(neracaModalUsaha) },
    ]
    await supabase.from('pengaturan').upsert(entries)
    alert("Data neraca berhasil disimpan!")
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    return (
      <div className="bg-[#0d1117] border border-white/10 rounded-xl px-4 py-3 shadow-xl text-sm">
        <p className="text-gray-400 mb-2 font-medium">{label}</p>
        {payload.map((p: any, i: number) => (
          <p key={i} style={{ color: p.color }} className="font-semibold">
            {p.name}: {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(p.value)}
          </p>
        ))}
      </div>
    )
  }

  const CustomTooltipQty = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    return (
      <div className="bg-[#0d1117] border border-white/10 rounded-xl px-4 py-3 shadow-xl text-sm">
        <p className="text-gray-400 mb-2 font-medium">{label}</p>
        {payload.map((p: any, i: number) => (
          <p key={i} style={{ color: p.color }} className="font-semibold">{p.name}: {p.value}</p>
        ))}
      </div>
    )
  }

  // ── Chart data: Penjualan per hari ──────────────────────────────────────────
  const dailySalesData = useMemo(() => {
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate()
    const map: Record<number, { omzet: number; tunai: number; transfer: number; piutang: number }> = {}
    for (let d = 1; d <= daysInMonth; d++) map[d] = { omzet: 0, tunai: 0, transfer: 0, piutang: 0 }
    transaksi.forEach(t => {
      const d = new Date(t.tanggal).getDate()
      if (!map[d]) return
      map[d].omzet += t.total
      if (t.jenis_pembayaran === 'Tunai') map[d].tunai += t.total
      else if (t.jenis_pembayaran === 'Transfer') map[d].transfer += t.total
      else if (t.jenis_pembayaran === 'Piutang') map[d].piutang += t.total
    })
    return Object.entries(map).map(([day, v]) => ({ day: Number(day), label: `${day}`, ...v }))
  }, [transaksi, selectedMonth, selectedYear])

  // ── Chart data: Pengeluaran per hari & per kategori ─────────────────────────
  const dailyExpenseData = useMemo(() => {
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate()
    const map: Record<number, number> = {}
    for (let d = 1; d <= daysInMonth; d++) map[d] = 0
    pengeluaran.forEach(p => {
      const d = new Date(p.tanggal).getDate()
      if (map[d] !== undefined) map[d] += p.jumlah
    })
    return Object.entries(map).map(([day, jumlah]) => ({ label: `${day}`, jumlah }))
  }, [pengeluaran, selectedMonth, selectedYear])

  const PIE_COLORS = ['#f97316', '#ef4444', '#f43f5e', '#a855f7', '#3b82f6', '#22c55e']

  const pieData = useMemo(() => {
    const map: Record<string, number> = {}
    pengeluaran.forEach(p => { map[p.kategori] = (map[p.kategori] || 0) + p.jumlah })
    return Object.entries(map).map(([name, value]) => ({ name, value }))
  }, [pengeluaran])

  // ── Chart data: 12 bulan terakhir (Laba tab) ─────────────────────────────────
  const [monthlyTrendData, setMonthlyTrendData] = useState<{ label: string; omzet: number; hpp: number; laba: number }[]>([])

  useEffect(() => {
    const fetchTrend = async () => {
      const results: { label: string; omzet: number; hpp: number; laba: number }[] = []
      const now = new Date()
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const start = new Date(d.getFullYear(), d.getMonth(), 1)
        const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999)
        const [trxRes, hppRes, penRes] = await Promise.all([
          supabase.from('transaksi').select('total').gte('tanggal', start.toISOString()).lte('tanggal', end.toISOString()),
          supabase.from('hpp').select('total_modal').gte('tanggal', start.toISOString().split('T')[0]).lte('tanggal', end.toISOString().split('T')[0]),
          supabase.from('pengeluaran').select('jumlah').gte('tanggal', start.toISOString().split('T')[0]).lte('tanggal', end.toISOString().split('T')[0]),
        ])
        const omzetMonth = (trxRes.data || []).reduce((a: number, t: any) => a + t.total, 0)
        const hppMonth = (hppRes.data || []).reduce((a: number, h: any) => a + h.total_modal, 0)
        const opexMonth = (penRes.data || []).reduce((a: number, p: any) => a + p.jumlah, 0)
        const labaMonth = omzetMonth - hppMonth - opexMonth
        results.push({
          label: `${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear().toString().slice(2)}`,
          omzet: omzetMonth, hpp: hppMonth, laba: labaMonth
        })
      }
      setMonthlyTrendData(results)
    }
    fetchTrend()
  }, [])

  const FilterBar = () => (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2 bg-[#161b22] px-3 py-2 rounded-xl border border-white/10 shadow-sm">
        <Calendar className="w-5 h-5 text-gray-400" />
        <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))}
          className="bg-transparent text-white border-none focus:ring-0 text-sm outline-none cursor-pointer">
          {MONTHS.map((m, i) => <option key={i} value={i} className="bg-[#161b22] text-white">{m}</option>)}
        </select>
      </div>
      <div className="flex items-center gap-2 bg-[#161b22] px-3 py-2 rounded-xl border border-white/10 shadow-sm">
        <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}
          className="bg-transparent text-white border-none focus:ring-0 text-sm outline-none cursor-pointer">
          {years.map(y => <option key={y} value={y} className="bg-[#161b22] text-white">{y}</option>)}
        </select>
      </div>
    </div>
  )

  return (
    <div className="flex flex-col h-full bg-[#0d1117] min-h-screen">
      <header className="sticky top-0 z-10 flex items-center justify-between px-8 py-6 bg-[#0d1117]/80 backdrop-blur border-b border-white/[0.05]">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <TrendingUp className="text-green-500" />
            Laporan
          </h2>
          <p className="text-sm text-gray-400 mt-1">Ringkasan penjualan, pengeluaran, dan laba bersih</p>
        </div>
        <FilterBar />
      </header>

      <main className="flex-1 p-8 overflow-y-auto space-y-6">
        {/* Tabs */}
        <div className="flex gap-2 border-b border-white/[0.05]">
          {[
            { key: 'penjualan', label: '📈 Penjualan' },
            { key: 'pengeluaran', label: '💸 Pengeluaran' },
            { key: 'laba', label: '💰 Laba Bersih' },
            { key: 'labarugi', label: '📋 Laba Rugi Formal' },
            { key: 'neraca', label: '⚖️ Neraca' },
            { key: 'aruskas', label: '💧 Arus Kas' },
          ].map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key as Tab)}
              className={`px-5 py-3 text-sm font-semibold rounded-t-xl transition-colors ${activeTab === tab.key ? 'bg-[#161b22] text-white border border-b-0 border-white/10' : 'text-gray-500 hover:text-gray-300'}`}>
              {tab.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center p-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
          </div>
        ) : (
          <>
            {/* ===== TAB PENJUALAN ===== */}
            {activeTab === 'penjualan' && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="bg-[#161b22] border border-white/[0.05] rounded-2xl p-6 relative overflow-hidden group">
                    <div className="absolute -right-4 -bottom-4 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity">
                      <DollarSign className="w-32 h-32" />
                    </div>
                    <div className="flex items-center gap-4 mb-4">
                      <div className="p-3 bg-green-500/10 rounded-xl border border-green-500/20">
                        <DollarSign className="w-6 h-6 text-green-500" />
                      </div>
                      <div>
                        <h3 className="text-gray-400 text-sm font-medium">Total Penjualan</h3>
                        <p className="text-white text-2xl font-bold tracking-tight mt-0.5">{formatRp(omzet.total)}</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-[#161b22] border border-white/[0.05] rounded-2xl p-6 relative overflow-hidden group">
                    <div className="absolute -right-4 -bottom-4 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity">
                      <Banknote className="w-32 h-32" />
                    </div>
                    <div className="flex items-center gap-4 mb-4">
                      <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20">
                        <Banknote className="w-6 h-6 text-blue-500" />
                      </div>
                      <div>
                        <h3 className="text-gray-400 text-sm font-medium">Tunai (Cash)</h3>
                        <p className="text-white text-xl font-bold tracking-tight mt-0.5">{formatRp(omzet.tunai)}</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-[#161b22] border border-white/[0.05] rounded-2xl p-6 relative overflow-hidden group">
                    <div className="absolute -right-4 -bottom-4 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity">
                      <CreditCard className="w-32 h-32" />
                    </div>
                    <div className="flex items-center gap-4 mb-4">
                      <div className="p-3 bg-purple-500/10 rounded-xl border border-purple-500/20">
                        <CreditCard className="w-6 h-6 text-purple-500" />
                      </div>
                      <div>
                        <h3 className="text-gray-400 text-sm font-medium">Transfer Bank / QRIS</h3>
                        <p className="text-white text-xl font-bold tracking-tight mt-0.5">{formatRp(omzet.transfer)}</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-[#161b22] border border-white/[0.05] rounded-2xl p-6 relative overflow-hidden group">
                    <div className="absolute -right-4 -bottom-4 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity">
                      <Wallet className="w-32 h-32" />
                    </div>
                    <div className="flex items-center gap-4 mb-4">
                      <div className="p-3 bg-orange-500/10 rounded-xl border border-orange-500/20">
                        <Wallet className="w-6 h-6 text-orange-500" />
                      </div>
                      <div>
                        <h3 className="text-gray-400 text-sm font-medium">Piutang (Kredit)</h3>
                        <p className="text-white text-xl font-bold tracking-tight mt-0.5">{formatRp(omzet.piutang)}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Charts Penjualan ── */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {/* Line chart: Omzet per hari */}
                  <div className="bg-[#161b22] border border-white/[0.05] rounded-2xl p-5">
                    <h4 className="text-sm font-bold text-white mb-4">📈 Omzet per Hari</h4>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={dailySalesData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                        <XAxis dataKey="label" tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false} axisLine={false} interval={4} />
                        <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={fmtShort} width={40} />
                        <Tooltip content={<CustomTooltip />} />
                        <Line type="monotone" dataKey="omzet" name="Omzet" stroke="#22c55e" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#22c55e' }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Bar chart: Tunai vs Transfer vs Piutang */}
                  <div className="bg-[#161b22] border border-white/[0.05] rounded-2xl p-5">
                    <h4 className="text-sm font-bold text-white mb-4">💳 Tunai vs Transfer vs Piutang per Hari</h4>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={dailySalesData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }} barCategoryGap="30%">
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                        <XAxis dataKey="label" tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false} axisLine={false} interval={4} />
                        <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={fmtShort} width={40} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
                        <Bar dataKey="tunai" name="Tunai" fill="#22c55e" radius={[3,3,0,0]} />
                        <Bar dataKey="transfer" name="Transfer" fill="#3b82f6" radius={[3,3,0,0]} />
                        <Bar dataKey="piutang" name="Piutang" fill="#f43f5e" radius={[3,3,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-[#161b22] border border-white/[0.05] rounded-2xl p-6 flex flex-col">
                    <div className="flex items-center gap-3 mb-6">
                      <Package className="w-5 h-5 text-gray-300" />
                      <h3 className="text-lg font-bold text-white">Produk Terlaris</h3>
                    </div>
                    {topProducts.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-48 text-gray-500">
                        <Package className="w-10 h-10 mb-2 opacity-20" />
                        <p className="text-sm">Belum ada data produk terjual</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {topProducts.map((p, i) => (
                          <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-[#0d1117] border border-white/5 hover:border-white/10 transition-colors">
                            <div className="flex items-center gap-4">
                              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-white/5 text-gray-400 font-bold text-sm">{i + 1}</span>
                              <span className="text-white font-medium">{p.nama}</span>
                            </div>
                            <div className="flex items-baseline gap-1">
                              <span className="text-green-400 font-bold text-lg">{p.qty}</span>
                              <span className="text-gray-500 text-sm">terjual</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="bg-[#161b22] border border-white/[0.05] rounded-2xl p-6 flex flex-col">
                    <div className="flex items-center gap-3 mb-6">
                      <Users className="w-5 h-5 text-gray-300" />
                      <h3 className="text-lg font-bold text-white">Top Pelanggan</h3>
                    </div>
                    {topCustomers.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-48 text-gray-500">
                        <Users className="w-10 h-10 mb-2 opacity-20" />
                        <p className="text-sm">Belum ada data pelanggan transaksi</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {topCustomers.map((c, i) => (
                          <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-[#0d1117] border border-white/5 hover:border-white/10 transition-colors">
                            <div className="flex items-center gap-4">
                              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-white/5 text-gray-400 font-bold text-sm">{i + 1}</span>
                              <span className="text-white font-medium truncate max-w-[200px]">{c.nama}</span>
                            </div>
                            <span className="text-green-400 font-bold">{formatRp(c.total)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* ===== TAB PENGELUARAN ===== */}
            {activeTab === 'pengeluaran' && (
              <div className="space-y-6">
                {/* Summary cards */}
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-5">
                  <div className="col-span-2 lg:col-span-1 bg-[#161b22] border border-white/[0.06] rounded-2xl p-5">
                    <p className="text-gray-400 text-sm mb-1">Total Pengeluaran {MONTHS[selectedMonth]}</p>
                    <p className="text-3xl font-bold text-red-400">{formatRp(totalPengeluaran)}</p>
                    <p className="text-xs text-gray-500 mt-1">{pengeluaran.length} transaksi</p>
                  </div>
                  {breakdownKategori.map(([kat, jumlah]) => (
                    <div key={kat} className="bg-[#161b22] border border-white/[0.06] rounded-2xl p-5">
                      <p className="text-gray-400 text-xs mb-1 truncate">{kat}</p>
                      <p className="text-xl font-bold text-orange-400">{formatRp(jumlah)}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {totalPengeluaran > 0 ? Math.round((jumlah / totalPengeluaran) * 100) : 0}% dari total
                      </p>
                    </div>
                  ))}
                </div>

                {/* ── Charts Pengeluaran ── */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {/* Donut: per kategori */}
                  <div className="bg-[#161b22] border border-white/[0.05] rounded-2xl p-5">
                    <h4 className="text-sm font-bold text-white mb-4">🍩 Breakdown Kategori</h4>
                    {pieData.length === 0 ? (
                      <div className="flex items-center justify-center h-[200px] text-gray-500 text-sm">Tidak ada data</div>
                    ) : (
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value" nameKey="name">
                            {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                          </Pie>
                          <Tooltip
                            content={({ active, payload }) => {
                              if (!active || !payload?.length) return null
                              const p = payload[0]
                              const pct = totalPengeluaran > 0 ? ((p.value as number / totalPengeluaran) * 100).toFixed(1) : '0'
                              return (
                                <div className="bg-[#0d1117] border border-white/10 rounded-xl px-4 py-3 shadow-xl text-sm">
                                  <p style={{ color: p.payload.fill }} className="font-bold">{p.name}</p>
                                  <p className="text-gray-300">{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(p.value as number)}</p>
                                  <p className="text-gray-500">{pct}% dari total</p>
                                </div>
                              )
                            }}
                          />
                          <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>

                  {/* Bar: Pengeluaran per hari */}
                  <div className="bg-[#161b22] border border-white/[0.05] rounded-2xl p-5">
                    <h4 className="text-sm font-bold text-white mb-4">📅 Pengeluaran per Hari</h4>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={dailyExpenseData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                        <XAxis dataKey="label" tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false} axisLine={false} interval={4} />
                        <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={fmtShort} width={40} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="jumlah" name="Pengeluaran" fill="#f97316" radius={[3,3,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Tabel */}
                <div className="bg-[#161b22] border border-white/[0.05] rounded-2xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-white/[0.05]">
                    <h3 className="font-bold text-white">Riwayat Pengeluaran — {MONTHS[selectedMonth]} {selectedYear}</h3>
                  </div>
                  {pengeluaran.length === 0 ? (
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
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.02]">
                        {pengeluaran.map(p => (
                          <tr key={p.id} className="hover:bg-white/[0.01]">
                            <td className="px-5 py-3 text-gray-400 whitespace-nowrap">
                              {new Date(p.tanggal).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                            </td>
                            <td className="px-5 py-3">
                              <span className="bg-white/5 text-gray-300 text-xs px-2.5 py-1 rounded-full border border-white/10">{p.kategori}</span>
                            </td>
                            <td className="px-5 py-3 text-gray-400">{p.keterangan || p.sub_kategori || "-"}</td>
                            <td className="px-5 py-3 text-right font-semibold text-red-400">{formatRp(p.jumlah)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="border-t border-white/10 bg-[#0d1117]/60">
                        <tr>
                          <td colSpan={3} className="px-5 py-3 text-gray-400 font-semibold">Total</td>
                          <td className="px-5 py-3 text-right font-bold text-red-400 text-base">{formatRp(totalPengeluaran)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  )}
                </div>
              </div>
            )}

            {/* ===== TAB LABA BERSIH ===== */}
            {activeTab === 'laba' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {/* Komponen kiri */}
                  <div className="space-y-4">
                    <div className="bg-[#161b22] border border-green-500/20 rounded-2xl p-6">
                      <p className="text-gray-400 text-sm mb-1">Omzet Penjualan</p>
                      <p className="text-3xl font-bold text-green-400">{formatRp(omzet.total)}</p>
                      <p className="text-xs text-gray-500 mt-1">{transaksi.length} transaksi</p>
                    </div>
                    <div className="bg-[#161b22] border border-red-500/20 rounded-2xl p-6 space-y-3">
                      <div>
                        <p className="text-gray-400 text-sm mb-1">HPP / COGS</p>
                        <p className="text-3xl font-bold text-red-400">- {formatRp(cogsData.cogs)}</p>
                        <p className="text-xs text-gray-500 mt-1">Stok Awal + Pembelian − Stok Akhir</p>
                      </div>
                      <div className="border-t border-white/5 pt-3 space-y-1 text-xs">
                        <div className="flex justify-between text-gray-500">
                          <span>+ Nilai Stok Awal</span>
                          <span className="text-gray-300">{formatRp(cogsData.totalNilaiStokAwal)}</span>
                        </div>
                        <div className="flex justify-between text-gray-500">
                          <span>+ Pembelian Bulan</span>
                          <span className="text-gray-300">{formatRp(cogsData.pembelianBulan)}</span>
                        </div>
                        <div className="flex justify-between text-gray-500">
                          <span>− Nilai Stok Akhir</span>
                          <span className="text-gray-300">{formatRp(cogsData.totalNilaiStokAkhir)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="bg-[#161b22] border border-blue-500/20 rounded-2xl p-6">
                      <p className="text-gray-400 text-sm mb-1">Laba Kotor</p>
                      <p className={`text-3xl font-bold ${labaKotor >= 0 ? 'text-blue-400' : 'text-red-400'}`}>{formatRp(labaKotor)}</p>
                      <p className="text-xs text-gray-500 mt-1">Omzet − HPP</p>
                    </div>
                    <div className="bg-[#161b22] border border-orange-500/20 rounded-2xl p-6">
                      <p className="text-gray-400 text-sm mb-1">Total Pengeluaran Operasional</p>
                      <p className="text-3xl font-bold text-orange-400">- {formatRp(totalPengeluaran)}</p>
                      <p className="text-xs text-gray-500 mt-1">{pengeluaran.length} pos pengeluaran</p>
                    </div>
                  </div>

                  {/* Laba bersih kanan */}
                  <div className="flex flex-col gap-4">
                    <div className={`flex-1 rounded-2xl p-8 flex flex-col justify-center items-center text-center border-2 ${labaBersih >= 0 ? 'bg-green-500/5 border-green-500/30' : 'bg-red-500/5 border-red-500/30'}`}>
                      <p className="text-gray-400 text-base mb-3">💰 Laba Bersih</p>
                      <p className="text-gray-400 text-sm mb-2">{MONTHS[selectedMonth]} {selectedYear}</p>
                      <p className={`text-5xl font-bold mb-4 ${labaBersih >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {formatRp(labaBersih)}
                      </p>
                      <p className="text-xs text-gray-500">Laba Kotor − Pengeluaran OpEx</p>
                      {omzet.total > 0 && (
                        <div className="mt-4 bg-white/5 rounded-xl px-4 py-2">
                          <p className="text-xs text-gray-400">Margin Bersih</p>
                          <p className={`text-xl font-bold ${labaBersih >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {((labaBersih / omzet.total) * 100).toFixed(1)}%
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="bg-[#161b22] border border-white/[0.06] rounded-2xl p-4">
                      <p className="text-xs text-gray-500 flex items-start gap-2">
                        <span className="text-yellow-500 mt-0.5">ℹ️</span>
                        <span>CapEx (pembelian aset) tidak dihitung sebagai pengeluaran operasional dalam kalkulasi laba bersih ini.</span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* ── Chart Laba: 12 bulan terakhir ── */}
                <div className="bg-[#161b22] border border-white/[0.05] rounded-2xl p-5">
                  <h4 className="text-sm font-bold text-white mb-1">📊 Tren 12 Bulan Terakhir</h4>
                  <p className="text-xs text-gray-500 mb-4">Omzet, HPP, dan Laba Bersih — tidak terpengaruh filter bulan</p>
                  {monthlyTrendData.length === 0 ? (
                    <div className="flex items-center justify-center h-[220px]">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500" />
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={monthlyTrendData} margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                        <XAxis dataKey="label" tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false} axisLine={false} />
                        <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={fmtShort} width={44} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
                        <Line type="monotone" dataKey="omzet" name="Omzet" stroke="#22c55e" strokeWidth={2} dot={{ r: 3, fill: '#22c55e' }} activeDot={{ r: 5 }} />
                        <Line type="monotone" dataKey="hpp" name="HPP" stroke="#ef4444" strokeWidth={2} dot={{ r: 3, fill: '#ef4444' }} activeDot={{ r: 5 }} />
                        <Line type="monotone" dataKey="laba" name="Laba Bersih" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 3, fill: '#3b82f6' }} activeDot={{ r: 5 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>

                {/* Ringkasan tabel */}
                <div className="bg-[#161b22] border border-white/[0.05] rounded-2xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-white/[0.05]">
                    <h3 className="font-bold text-white">Ringkasan Kalkulasi</h3>
                  </div>
                  <table className="w-full text-sm text-gray-300">
                    <tbody className="divide-y divide-white/[0.02]">
                      {[
                        { label: "Omzet Penjualan", value: omzet.total, color: "text-green-400", sign: "" },
                        { label: "HPP / COGS (Stok Awal + Beli − Stok Akhir)", value: cogsData.cogs, color: "text-red-400", sign: "- " },
                        { label: "Laba Kotor", value: labaKotor, color: labaKotor >= 0 ? "text-blue-400" : "text-red-400", sign: "", bold: true },
                        { label: "Pengeluaran Operasional (OpEx)", value: totalPengeluaran, color: "text-orange-400", sign: "- " },
                        { label: "Laba Bersih", value: labaBersih, color: labaBersih >= 0 ? "text-green-400" : "text-red-400", sign: "", bold: true },
                      ].map((row, i) => (
                        <tr key={i} className={`hover:bg-white/[0.01] ${row.bold ? 'bg-white/[0.02]' : ''}`}>
                          <td className={`px-6 py-4 ${row.bold ? 'font-bold text-white' : 'text-gray-400'}`}>{row.label}</td>
                          <td className={`px-6 py-4 text-right font-${row.bold ? 'bold text-lg' : 'semibold'} ${row.color}`}>
                            {row.sign}{formatRp(Math.abs(row.value))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {/* ===== TAB LABA RUGI FORMAL ===== */}
            {activeTab === 'labarugi' && (
              <div className="max-w-3xl mx-auto space-y-6">
                <div className="bg-[#161b22] border border-white/[0.05] rounded-2xl p-8 text-center space-y-2">
                  <h3 className="text-gray-400 uppercase tracking-widest text-xs font-bold">Berkat Jaya — Distribusi Ayam</h3>
                  <h2 className="text-2xl font-bold text-white">Laporan Laba Rugi</h2>
                  <p className="text-sm text-gray-400">Periode: {MONTHS[selectedMonth]} {selectedYear}</p>
                </div>

                <div className="bg-[#161b22] border border-white/[0.05] rounded-2xl overflow-hidden">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-[#0d1117] border-b border-white/[0.05] text-gray-400 uppercase text-xs tracking-wider">
                      <tr>
                        <th className="px-6 py-4 font-medium">Keterangan</th>
                        <th className="px-6 py-4 font-medium text-right w-40">Jumlah (Rp)</th>
                        <th className="px-6 py-4 font-medium text-right w-24">% Omzet</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.02]">
                      {/* SECTION A — PENDAPATAN */}
                      <tr className="bg-green-500/5">
                        <td className="px-6 py-3 font-semibold text-green-400">A. PENDAPATAN</td>
                        <td className="px-6 py-3"></td>
                        <td className="px-6 py-3"></td>
                      </tr>
                      <tr>
                        <td className="px-6 py-2.5 text-gray-300 pl-10">Penjualan Bersih</td>
                        <td className="px-6 py-2.5 text-right font-medium text-white">{formatRp(omzet.total)}</td>
                        <td className="px-6 py-2.5 text-right text-gray-400">{pct(omzet.total, omzet.total)}</td>
                      </tr>
                      <tr className="text-xs text-gray-500">
                        <td className="px-6 py-1.5 pl-14">→ Tunai</td>
                        <td className="px-6 py-1.5 text-right">{formatRp(omzet.tunai)}</td>
                        <td className="px-6 py-1.5 text-right">{pct(omzet.tunai, omzet.total)}</td>
                      </tr>
                      <tr className="text-xs text-gray-500">
                        <td className="px-6 py-1.5 pl-14">→ Transfer</td>
                        <td className="px-6 py-1.5 text-right">{formatRp(omzet.transfer)}</td>
                        <td className="px-6 py-1.5 text-right">{pct(omzet.transfer, omzet.total)}</td>
                      </tr>
                      <tr className="text-xs text-gray-500">
                        <td className="px-6 py-1.5 pl-14 pb-3">→ Piutang (Kredit)</td>
                        <td className="px-6 py-1.5 text-right pb-3">{formatRp(omzet.piutang)}</td>
                        <td className="px-6 py-1.5 text-right pb-3">{pct(omzet.piutang, omzet.total)}</td>
                      </tr>

                      {/* SECTION B — HPP */}
                      <tr className="bg-red-500/5">
                        <td className="px-6 py-3 font-semibold text-red-400">B. HARGA POKOK PENJUALAN (HPP)</td>
                        <td className="px-6 py-3"></td>
                        <td className="px-6 py-3"></td>
                      </tr>
                      <tr>
                        <td className="px-6 py-2 text-gray-300 pl-10">Persediaan Awal</td>
                        <td className="px-6 py-2 text-right">{formatRp(cogsData.totalNilaiStokAwal)}</td>
                        <td className="px-6 py-2 text-right text-gray-500">{pct(cogsData.totalNilaiStokAwal, omzet.total)}</td>
                      </tr>
                      <tr>
                        <td className="px-6 py-2 text-gray-300 pl-10">Pembelian Periode</td>
                        <td className="px-6 py-2 text-right">{formatRp(cogsData.pembelianBulan)}</td>
                        <td className="px-6 py-2 text-right text-gray-500">{pct(cogsData.pembelianBulan, omzet.total)}</td>
                      </tr>
                      <tr>
                        <td className="px-6 py-2 text-gray-300 pl-10">Persediaan Akhir</td>
                        <td className="px-6 py-2 text-right">({formatRp(cogsData.totalNilaiStokAkhir)})</td>
                        <td className="px-6 py-2 text-right text-gray-500">{pct(cogsData.totalNilaiStokAkhir, omzet.total)}</td>
                      </tr>
                      <tr className="border-t border-white/5">
                        <td className="px-6 py-3 text-red-300 font-semibold pl-10">Total HPP</td>
                        <td className="px-6 py-3 text-right font-semibold text-red-300">{formatRp(cogsData.cogs)}</td>
                        <td className="px-6 py-3 text-right text-gray-400">{pct(cogsData.cogs, omzet.total)}</td>
                      </tr>

                      {/* SECTION C — LABA KOTOR */}
                      <tr className="bg-blue-500/10 border-t-2 border-blue-500/20">
                        <td className="px-6 py-4 font-bold text-blue-300 text-base">LABA KOTOR (A − B)</td>
                        <td className={`px-6 py-4 text-right font-bold text-2xl ${labaKotor >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatRp(labaKotor)}</td>
                        <td className="px-6 py-4 text-right font-semibold text-blue-300">{pct(labaKotor, omzet.total)}</td>
                      </tr>

                      {/* SECTION D — BIAYA OPERASIONAL */}
                      <tr className="bg-orange-500/5">
                        <td className="px-6 py-3 font-semibold text-orange-400">C. BIAYA OPERASIONAL</td>
                        <td className="px-6 py-3"></td>
                        <td className="px-6 py-3"></td>
                      </tr>
                      {pengeluaranPerKategori.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="px-6 py-4 text-center text-gray-500 italic">Tidak ada pengeluaran operasional</td>
                        </tr>
                      ) : (
                        pengeluaranPerKategori.map(([kat, jum]) => (
                          <tr key={kat}>
                            <td className="px-6 py-2 text-gray-300 pl-10">{kat}</td>
                            <td className="px-6 py-2 text-right">{formatRp(jum)}</td>
                            <td className="px-6 py-2 text-right text-gray-500">{pct(jum, omzet.total)}</td>
                          </tr>
                        ))
                      )}
                      <tr className="border-t border-white/5">
                        <td className="px-6 py-3 text-orange-300 font-semibold pl-10">Total Biaya Operasional</td>
                        <td className="px-6 py-3 text-right font-semibold text-orange-300">{formatRp(totalPengeluaran)}</td>
                        <td className="px-6 py-3 text-right text-gray-400">{pct(totalPengeluaran, omzet.total)}</td>
                      </tr>

                      {/* SECTION E — LABA BERSIH */}
                      <tr className={`border-t-2 ${labaBersih >= 0 ? 'bg-green-500/10 border-green-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                        <td className="px-6 py-5 font-bold text-white text-lg">LABA BERSIH (C − D)</td>
                        <td className={`px-6 py-5 text-right font-bold text-2xl ${labaBersih >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatRp(labaBersih)}</td>
                        <td className={`px-6 py-5 text-right font-bold ${labaBersih >= 0 ? 'text-green-400' : 'text-red-400'}`}>{pct(labaBersih, omzet.total)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Card Catatan Laporan */}
                <div className="bg-[#161b22] border border-white/10 rounded-2xl p-6 mb-8">
                  <h4 className="text-white font-semibold mb-3">Catatan Laporan:</h4>
                  <ul className="space-y-2 text-sm text-gray-400">
                    <li className="flex gap-2 items-start"><span className="text-yellow-500">•</span> HPP dihitung dengan metode perpetual: Stok Awal + Pembelian − Stok Akhir.</li>
                    <li className="flex gap-2 items-start"><span className="text-yellow-500">•</span> Piutang dicatat sebagai penjualan pada periode transaksi, bukan saat pelunasan.</li>
                    <li className="flex gap-2 items-start"><span className="text-yellow-500">•</span> Pengeluaran CapEx (aset tetap) tidak termasuk dalam biaya operasional.</li>
                    <li className="flex gap-2 items-start"><span className="text-yellow-500">•</span> Laporan dibuat otomatis berdasarkan data transaksi, HPP, dan pengeluaran yang diinput ke sistem.</li>
                  </ul>
                </div>
              </div>
            )}
            {/* ===== TAB NERACA ===== */}
            {activeTab === 'neraca' && (
              <div className="max-w-5xl mx-auto space-y-6">
                {isLoadingNeraca ? (
                  <div className="flex justify-center p-20"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div></div>
                ) : (
                  <>
                    <div className="bg-[#161b22] border border-white/[0.05] rounded-2xl p-8 text-center space-y-2">
                      <h3 className="text-gray-400 uppercase tracking-widest text-xs font-bold">Berkat Jaya — Distribusi Ayam</h3>
                      <h2 className="text-2xl font-bold text-white">Neraca</h2>
                      <p className="text-sm text-gray-400">Per {endDateStr}</p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* KOLOM KIRI - ASET */}
                      <div className="bg-[#161b22] border border-white/[0.05] rounded-2xl p-6 flex flex-col">
                        <h3 className="text-green-400 uppercase tracking-wider font-bold mb-6">ASET</h3>
                        
                        <div className="space-y-4 flex-1">
                          <div>
                            <h4 className="text-white font-semibold mb-3 border-b border-white/5 pb-2">Aset Lancar</h4>
                            <div className="space-y-1">
                              <div className="flex justify-between items-center py-2 border-b border-white/5">
                                <span className="text-gray-300 w-40">Kas</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-gray-500 text-sm">Rp</span>
                                  <input type="number" value={neracaKas} onChange={e => setNeracaKas(Number(e.target.value))} className="bg-[#0d1117] border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm w-36 text-right focus:outline-none focus:border-green-500/50" />
                                </div>
                              </div>
                              <div className="flex justify-between items-center py-2 border-b border-white/5">
                                <span className="text-gray-300 w-40">Bank</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-gray-500 text-sm">Rp</span>
                                  <input type="number" value={neracaBank} onChange={e => setNeracaBank(Number(e.target.value))} className="bg-[#0d1117] border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm w-36 text-right focus:outline-none focus:border-green-500/50" />
                                </div>
                              </div>
                              <div className="flex justify-between items-center py-2 border-b border-white/5">
                                <div className="flex items-center gap-2">
                                  <span className="text-gray-300">Piutang Usaha</span>
                                  <span className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded">otomatis</span>
                                </div>
                                <span className="text-white font-medium">{formatRp(totalPiutangNeraca)}</span>
                              </div>
                              <div className="flex justify-between items-center py-2 border-b border-white/5">
                                <div className="flex items-center gap-2">
                                  <span className="text-gray-300">Persediaan Barang</span>
                                  <span className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded">otomatis</span>
                                </div>
                                <span className="text-white font-medium">{formatRp(nilaiStokNeraca)}</span>
                              </div>
                              <div className="flex justify-between items-center py-3 mt-1 border-t border-white/10">
                                <span className="text-white font-bold">Total Aset Lancar</span>
                                <span className="text-white font-bold text-lg">{formatRp(asetLancar)}</span>
                              </div>
                            </div>
                          </div>

                          <div className="pt-4">
                            <h4 className="text-white font-semibold mb-3 border-b border-white/5 pb-2">Aset Tetap</h4>
                            <div className="space-y-1">
                              <div className="flex justify-between items-center py-2 border-b border-white/5">
                                <span className="text-gray-300 w-40">Peralatan</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-gray-500 text-sm">Rp</span>
                                  <input type="number" value={neracaPeralatan} onChange={e => setNeracaPeralatan(Number(e.target.value))} className="bg-[#0d1117] border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm w-36 text-right focus:outline-none focus:border-green-500/50" />
                                </div>
                              </div>
                              <div className="flex justify-between items-center py-2 border-b border-white/5">
                                <span className="text-gray-300 w-40">Kendaraan</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-gray-500 text-sm">Rp</span>
                                  <input type="number" value={neracaKendaraan} onChange={e => setNeracaKendaraan(Number(e.target.value))} className="bg-[#0d1117] border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm w-36 text-right focus:outline-none focus:border-green-500/50" />
                                </div>
                              </div>
                              <div className="flex justify-between items-center py-2 border-b border-white/5">
                                <span className="text-gray-300 w-40">Tanah / Bangunan</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-gray-500 text-sm">Rp</span>
                                  <input type="number" value={neracaTanahBangunan} onChange={e => setNeracaTanahBangunan(Number(e.target.value))} className="bg-[#0d1117] border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm w-36 text-right focus:outline-none focus:border-green-500/50" />
                                </div>
                              </div>
                              <div className="flex justify-between items-center py-3 mt-1 border-t border-white/10">
                                <span className="text-white font-bold">Total Aset Tetap</span>
                                <span className="text-white font-bold text-lg">{formatRp(totalAsetTetap)}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="mt-8 pt-4 border-t-2 border-white/10 flex justify-between items-center">
                          <span className="text-gray-300 font-bold text-lg">TOTAL ASET</span>
                          <span className="text-green-400 font-bold text-xl">{formatRp(totalAset)}</span>
                        </div>
                      </div>

                      {/* KOLOM KANAN - KEWAJIBAN & EKUITAS */}
                      <div className="bg-[#161b22] border border-white/[0.05] rounded-2xl p-6 flex flex-col">
                        <h3 className="text-orange-400 uppercase tracking-wider font-bold mb-6">KEWAJIBAN & EKUITAS</h3>
                        
                        <div className="space-y-4 flex-1">
                          <div>
                            <h4 className="text-white font-semibold mb-3 border-b border-white/5 pb-2">Kewajiban</h4>
                            <div className="space-y-1">
                              <div className="flex justify-between items-center py-2 border-b border-white/5">
                                <div className="flex items-center gap-2">
                                  <span className="text-gray-300">Hutang Supplier</span>
                                  <span className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded">otomatis</span>
                                </div>
                                <span className="text-white font-medium">{formatRp(totalUtangNeraca)}</span>
                              </div>
                              <div className="flex justify-between items-center py-2 border-b border-white/5">
                                <span className="text-gray-300 w-40">Hutang Modal</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-gray-500 text-sm">Rp</span>
                                  <input type="number" value={neracaHutangModal} onChange={e => setNeracaHutangModal(Number(e.target.value))} className="bg-[#0d1117] border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm w-36 text-right focus:outline-none focus:border-green-500/50" />
                                </div>
                              </div>
                              <div className="flex justify-between items-center py-3 mt-1 border-t border-white/10">
                                <span className="text-white font-bold">Total Kewajiban</span>
                                <span className="text-white font-bold text-lg">{formatRp(totalKewajiban)}</span>
                              </div>
                            </div>
                          </div>

                          <div className="pt-4">
                            <h4 className="text-white font-semibold mb-3 border-b border-white/5 pb-2">Ekuitas</h4>
                            <div className="space-y-1">
                              <div className="flex justify-between items-center py-2 border-b border-white/5">
                                <span className="text-gray-300 w-40">Modal Usaha</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-gray-500 text-sm">Rp</span>
                                  <input type="number" value={neracaModalUsaha} onChange={e => setNeracaModalUsaha(Number(e.target.value))} className="bg-[#0d1117] border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm w-36 text-right focus:outline-none focus:border-green-500/50" />
                                </div>
                              </div>
                              <div className="flex justify-between items-center py-2 border-b border-white/5">
                                <div className="flex items-center gap-2">
                                  <span className="text-gray-300">Laba Bersih Kumulatif</span>
                                  <span className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded">otomatis</span>
                                </div>
                                <span className={labaBersihKumulatif >= 0 ? "text-green-400 font-medium" : "text-red-400 font-medium"}>{formatRp(labaBersihKumulatif)}</span>
                              </div>
                              <div className="flex justify-between items-center py-3 mt-1 border-t border-white/10">
                                <span className="text-white font-bold">Total Ekuitas</span>
                                <span className="text-white font-bold text-lg">{formatRp(totalEkuitas)}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="mt-8 pt-4 border-t-2 border-white/10 flex justify-between items-center">
                          <span className="text-gray-300 font-bold text-lg">TOTAL KEWAJIBAN + EKUITAS</span>
                          <span className="text-orange-400 font-bold text-xl">{formatRp(totalKewajibanEkuitas)}</span>
                        </div>
                      </div>
                    </div>

                    <button onClick={handleSimpanNeraca} className="w-full bg-green-600 hover:bg-green-500 text-white font-semibold py-3 rounded-xl transition-colors">
                      💾 Simpan Semua Nilai Manual
                    </button>

                    {/* Indikator Balance */}
                    {isBalance ? (
                      <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-4 flex items-center justify-center gap-3">
                        <span className="text-xl">✅</span>
                        <p className="text-green-400 font-semibold">Neraca Seimbang — Total Aset = Total Kewajiban + Ekuitas</p>
                      </div>
                    ) : (
                      <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-5 flex flex-col items-center justify-center gap-2 text-center">
                        <div className="flex items-center gap-3">
                          <span className="text-xl">⚠️</span>
                          <p className="text-red-400 font-bold text-lg">Neraca Tidak Seimbang — Selisih: {formatRp(Math.abs(totalAset - totalKewajibanEkuitas))}</p>
                        </div>
                        <p className="text-xs text-gray-500 mt-1 max-w-lg">
                          Kemungkinan ada data yang belum lengkap (HPP, stok awal, atau saldo awal kas).
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ===== TAB ARUS KAS ===== */}
            {activeTab === 'aruskas' && (
              <div className="space-y-6">
                {isLoadingArusKas ? (
                  <div className="flex items-center justify-center p-24">
                    <div className="w-10 h-10 border-4 border-green-500/30 border-t-green-500 rounded-full animate-spin"></div>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
                      <div className="bg-[#161b22] border border-white/[0.05] rounded-2xl p-5 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-green-500/10 rounded-full blur-3xl -mr-6 -mt-6" />
                        <div className="relative z-10">
                          <p className="text-gray-400 text-sm mb-1">Total Kas Masuk</p>
                          <h3 className="text-2xl font-bold text-green-400">{formatRp(totalMasuk)}</h3>
                          <p className="text-xs text-gray-500 mt-1">{kasMasukList.length} transaksi</p>
                        </div>
                      </div>
                      <div className="bg-[#161b22] border border-white/[0.05] rounded-2xl p-5 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/10 rounded-full blur-3xl -mr-6 -mt-6" />
                        <div className="relative z-10">
                          <p className="text-gray-400 text-sm mb-1">Total Kas Keluar</p>
                          <h3 className="text-2xl font-bold text-red-400">{formatRp(totalKeluar)}</h3>
                          <p className="text-xs text-gray-500 mt-1">{kasKeluarList.length} transaksi</p>
                        </div>
                      </div>
                      <div className="bg-[#161b22] border border-white/[0.05] rounded-2xl p-5 relative overflow-hidden">
                        <div className={`absolute top-0 right-0 w-24 h-24 rounded-full blur-3xl -mr-6 -mt-6 ${arusKasBersih >= 0 ? "bg-green-500/10" : "bg-red-500/10"}`} />
                        <div className="relative z-10">
                          <p className="text-gray-400 text-sm mb-1">Arus Kas Bersih</p>
                          <h3 className={`text-2xl font-bold ${arusKasBersih >= 0 ? "text-green-400" : "text-red-400"}`}>
                            {arusKasBersih >= 0 ? "+" : ""}{formatRp(arusKasBersih)}
                          </h3>
                          <p className="text-xs text-gray-500 mt-1">Masuk − Keluar</p>
                        </div>
                      </div>
                      <div className="bg-[#161b22] border border-white/[0.05] rounded-2xl p-5 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-3xl -mr-6 -mt-6" />
                        <div className="relative z-10">
                          <p className="text-gray-400 text-sm mb-1">Saldo Akhir Bulan</p>
                          <h3 className="text-2xl font-bold text-blue-400">{formatRp(saldoDataArusKas[saldoDataArusKas.length - 1]?.saldo || saldoAwalArusKas)}</h3>
                          <p className="text-xs text-gray-500 mt-1">{MONTHS[selectedMonth]} {selectedYear}</p>
                        </div>
                      </div>
                    </div>

                    {/* BAR CHART */}
                    <div className="bg-[#161b22] border border-white/[0.05] rounded-2xl p-6">
                      <h3 className="text-white font-bold mb-0.5">Kas Masuk vs Kas Keluar per Hari</h3>
                      <p className="text-xs text-gray-500 mb-5">{MONTHS[selectedMonth]} {selectedYear}</p>
                      <div style={{ height: 260 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={chartDataArusKas} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barGap={2}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                            <XAxis dataKey="date" tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} interval={1} />
                            <YAxis tickFormatter={fmtShort} tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} width={58} />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                            <Legend formatter={(v) => <span style={{ color: "#9ca3af", fontSize: 12 }}>{v}</span>} />
                            <Bar dataKey="masuk" name="Kas Masuk" fill="#22c55e" radius={[3, 3, 0, 0]} maxBarSize={18} />
                            <Bar dataKey="keluar" name="Kas Keluar" fill="#ef4444" radius={[3, 3, 0, 0]} maxBarSize={18} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* DETAIL TABLES */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Kas Masuk */}
                      <div className="bg-[#161b22] border border-white/[0.05] rounded-2xl overflow-hidden shadow-xl">
                        <div className="px-5 py-4 border-b border-white/[0.05] flex items-center justify-between bg-[#0d1117]/50">
                          <div>
                            <h3 className="text-white font-bold flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
                              Kas Masuk
                            </h3>
                            <p className="text-xs text-gray-500 mt-0.5">{kasMasukList.length} transaksi</p>
                          </div>
                          <span className="text-green-400 font-bold text-sm">{formatRp(totalMasuk)}</span>
                        </div>
                        <div className="overflow-x-auto" style={{ maxHeight: 400, overflowY: "auto" }}>
                          {kasMasukList.length === 0 ? (
                            <div className="p-12 text-center text-gray-500 flex flex-col items-center">
                              <span className="text-4xl mb-3 opacity-30">💰</span>
                              <p>Tidak ada kas masuk bulan ini</p>
                            </div>
                          ) : (
                            <table className="w-full text-sm text-gray-300">
                              <thead className="text-xs text-gray-400 uppercase bg-[#0d1117]/80 border-b border-white/[0.05] sticky top-0">
                                <tr>
                                  <th className="px-4 py-3 text-left font-medium">Tanggal</th>
                                  <th className="px-4 py-3 text-left font-medium">Keterangan</th>
                                  <th className="px-4 py-3 text-center font-medium">Kategori</th>
                                  <th className="px-4 py-3 text-right font-medium">Jumlah</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-white/[0.02]">
                                {kasMasukList.map((k, i) => (
                                  <tr key={i} className="hover:bg-white/[0.01] transition-colors">
                                    <td className="px-4 py-3 text-gray-400 whitespace-nowrap text-xs">{formatDate(k.tanggal)}</td>
                                    <td className="px-4 py-3 text-gray-300 max-w-[150px] truncate text-xs" title={k.keterangan}>{k.keterangan}</td>
                                    <td className="px-4 py-3 text-center">
                                      <span className={`px-2 py-0.5 text-[11px] font-semibold rounded-full border ${badgeMasuk(k.kategori)}`}>
                                        {k.kategori}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 text-right font-semibold text-green-400">{formatRp(k.jumlah)}</td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot className="border-t border-white/10 bg-[#0d1117]/60">
                                <tr>
                                  <td colSpan={3} className="px-4 py-3 font-bold text-gray-400 text-sm">Total Kas Masuk</td>
                                  <td className="px-4 py-3 text-right font-bold text-green-400">{formatRp(totalMasuk)}</td>
                                </tr>
                              </tfoot>
                            </table>
                          )}
                        </div>
                      </div>

                      {/* Kas Keluar */}
                      <div className="bg-[#161b22] border border-white/[0.05] rounded-2xl overflow-hidden shadow-xl">
                        <div className="px-5 py-4 border-b border-white/[0.05] flex items-center justify-between bg-[#0d1117]/50">
                          <div>
                            <h3 className="text-white font-bold flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
                              Kas Keluar
                            </h3>
                            <p className="text-xs text-gray-500 mt-0.5">{kasKeluarList.length} transaksi</p>
                          </div>
                          <span className="text-red-400 font-bold text-sm">{formatRp(totalKeluar)}</span>
                        </div>
                        <div className="overflow-x-auto" style={{ maxHeight: 400, overflowY: "auto" }}>
                          {kasKeluarList.length === 0 ? (
                            <div className="p-12 text-center text-gray-500 flex flex-col items-center">
                              <span className="text-4xl mb-3 opacity-30">💸</span>
                              <p>Tidak ada kas keluar bulan ini</p>
                            </div>
                          ) : (
                            <table className="w-full text-sm text-gray-300">
                              <thead className="text-xs text-gray-400 uppercase bg-[#0d1117]/80 border-b border-white/[0.05] sticky top-0">
                                <tr>
                                  <th className="px-4 py-3 text-left font-medium">Tanggal</th>
                                  <th className="px-4 py-3 text-left font-medium">Keterangan</th>
                                  <th className="px-4 py-3 text-center font-medium">Kategori</th>
                                  <th className="px-4 py-3 text-right font-medium">Jumlah</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-white/[0.02]">
                                {kasKeluarList.map((k, i) => (
                                  <tr key={i} className="hover:bg-white/[0.01] transition-colors">
                                    <td className="px-4 py-3 text-gray-400 whitespace-nowrap text-xs">{formatDate(k.tanggal)}</td>
                                    <td className="px-4 py-3 text-gray-300 max-w-[150px] truncate text-xs" title={k.keterangan}>{k.keterangan}</td>
                                    <td className="px-4 py-3 text-center">
                                      <span className={`px-2 py-0.5 text-[11px] font-semibold rounded-full border ${badgeKeluar(k.kategori)}`}>
                                        {k.kategori}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 text-right font-semibold text-red-400">{formatRp(k.jumlah)}</td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot className="border-t border-white/10 bg-[#0d1117]/60">
                                <tr>
                                  <td colSpan={3} className="px-4 py-3 font-bold text-gray-400 text-sm">Total Kas Keluar</td>
                                  <td className="px-4 py-3 text-right font-bold text-red-400">{formatRp(totalKeluar)}</td>
                                </tr>
                              </tfoot>
                            </table>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* LINE CHART — TREN SALDO */}
                    <div className="bg-[#161b22] border border-white/[0.05] rounded-2xl p-6">
                      <h3 className="text-white font-bold mb-0.5">Tren Saldo Kas Harian</h3>
                      <p className="text-xs text-gray-500 mb-5">Akumulasi saldo kas sepanjang {MONTHS[selectedMonth]} {selectedYear} (saldo awal: {formatRp(saldoAwalArusKas)})</p>
                      <div style={{ height: 220 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={saldoDataArusKas} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                            <XAxis dataKey="date" tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} interval={1} />
                            <YAxis tickFormatter={fmtShort} tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} width={58} />
                            <Tooltip content={<CustomTooltip />} cursor={{ stroke: "rgba(255,255,255,0.1)" }} />
                            <Line type="monotone" dataKey="saldo" name="Saldo Kas" stroke="#3b82f6" strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: "#3b82f6", strokeWidth: 0 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}