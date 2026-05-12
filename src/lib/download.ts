import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const COMPANY_NAME = 'Berkat Jaya'
const COMPANY_SUB = 'Distribusi Ayam — Bandar Lampung'

export const MONTHS = [
  'Januari','Februari','Maret','April','Mei','Juni',
  'Juli','Agustus','September','Oktober','November','Desember'
]

export const fmtRp = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n)

export const fmtNum = (n: number) =>
  new Intl.NumberFormat('id-ID').format(n)

export type DownloadData = {
  bulan: number
  tahun: number
  ringkasan: {
    omzet: number
    hpp: number
    labaKotor: number
    pengeluaran: number
    labaBersih: number
    marginBersih: number
    jumlahTransaksi: number
  }
  labaRugi: {
    omzetTunai: number
    omzetTransfer: number
    omzetPiutang: number
    hppBreakdown: { nama: string; qty: number; hpp_satuan: number; total: number }[]
    pengeluaranPerKategori: [string, number][]
  }
  transaksi: { no_nota: string; tanggal: string; nama_pembeli: string; jenis_pembayaran: string; total: number }[]
  rekapProduk: { nama: string; qty: number; omzet: number; hpp: number; laba: number; margin: number }[]
  rekapPembeli: { nama: string; jumlah_transaksi: number; total: number; rata_rata: number; sisa_piutang: number }[]
  pengeluaran: { tanggal: string; kategori: string; keterangan: string; jumlah: number }[]
  piutang: { no_nota: string; tanggal: string; nama_pembeli: string; total: number; terbayar: number; sisa: number; status: string }[]
  utang: { tanggal: string; nama_supplier: string; total: number; terbayar: number; sisa: number; status: string }[]
}

export function downloadExcel(data: DownloadData) {
  const wb = XLSX.utils.book_new()
  const periodLabel = `${MONTHS[data.bulan]} ${data.tahun}`

  // Sheet 1: Ringkasan
  const wsRingkasan = XLSX.utils.aoa_to_sheet([
    [COMPANY_NAME], [COMPANY_SUB], [`Laporan Bulanan: ${periodLabel}`], [],
    ['RINGKASAN KEUANGAN'],
    ['Total Omzet', data.ringkasan.omzet],
    ['Total HPP / COGS', data.ringkasan.hpp],
    ['Laba Kotor', data.ringkasan.labaKotor],
    ['Total Pengeluaran', data.ringkasan.pengeluaran],
    ['Laba Bersih', data.ringkasan.labaBersih],
    ['Margin Bersih (%)', `${data.ringkasan.marginBersih.toFixed(1)}%`], [],
    ['OPERASIONAL'],
    ['Jumlah Transaksi', data.ringkasan.jumlahTransaksi],
    ['Jumlah Pelanggan', data.rekapPembeli.length],
    ['Total Piutang Belum Lunas', data.piutang.filter(p => p.status === 'belum lunas').reduce((a, p) => a + p.sisa, 0)],
    ['Total Utang Belum Lunas', data.utang.filter(u => u.status === 'belum lunas').reduce((a, u) => a + u.sisa, 0)],
  ])
  wsRingkasan['!cols'] = [{ wch: 30 }, { wch: 20 }]
  XLSX.utils.book_append_sheet(wb, wsRingkasan, 'Ringkasan')

  // Sheet 2: Laba Rugi
  const wsLR = XLSX.utils.aoa_to_sheet([
    [COMPANY_NAME], [`Laporan Laba Rugi — ${periodLabel}`], [],
    ['A. PENDAPATAN'],
    ['Penjualan Bersih', data.ringkasan.omzet],
    ['  → Tunai', data.labaRugi.omzetTunai],
    ['  → Transfer', data.labaRugi.omzetTransfer],
    ['  → Piutang/Tempo', data.labaRugi.omzetPiutang], [],
    ['B. HPP / COGS'],
    ...data.labaRugi.hppBreakdown.map(h => [`  → ${h.nama} (${fmtNum(h.qty)} × ${fmtRp(h.hpp_satuan)})`, h.total]),
    ['Total HPP', data.ringkasan.hpp], [],
    ['C. LABA KOTOR (A - B)', data.ringkasan.labaKotor], [],
    ['D. BIAYA OPERASIONAL'],
    ...data.labaRugi.pengeluaranPerKategori.map(([k, v]) => [`  → ${k}`, v]),
    ['Total Biaya Operasional', data.ringkasan.pengeluaran], [],
    ['E. LABA BERSIH (C - D)', data.ringkasan.labaBersih],
    ['Margin Bersih', `${data.ringkasan.marginBersih.toFixed(1)}%`],
  ])
  wsLR['!cols'] = [{ wch: 40 }, { wch: 20 }]
  XLSX.utils.book_append_sheet(wb, wsLR, 'Laba Rugi Formal')

  // Sheet 3: Transaksi
  const wsTrx = XLSX.utils.aoa_to_sheet([
    [COMPANY_NAME], [`Data Transaksi — ${periodLabel}`], [],
    ['No. Nota', 'Tanggal', 'Nama Pembeli', 'Jenis Pembayaran', 'Total (Rp)'],
    ...data.transaksi.map(t => [t.no_nota, new Date(t.tanggal).toLocaleDateString('id-ID'), t.nama_pembeli, t.jenis_pembayaran || '-', t.total]),
    [], ['Total', '', '', '', data.transaksi.reduce((a, t) => a + t.total, 0)]
  ])
  wsTrx['!cols'] = [{ wch: 20 }, { wch: 20 }, { wch: 30 }, { wch: 20 }, { wch: 20 }]
  XLSX.utils.book_append_sheet(wb, wsTrx, 'Transaksi')

  // Sheet 4: Rekap Produk
  const wsProduk = XLSX.utils.aoa_to_sheet([
    [COMPANY_NAME], [`Rekap Produk — ${periodLabel}`], [],
    ['No', 'Nama Produk', 'Qty Terjual', 'Omzet (Rp)', 'HPP (Rp)', 'Laba Kotor (Rp)', 'Margin (%)'],
    ...data.rekapProduk.map((p, i) => [i + 1, p.nama, p.qty, p.omzet, p.hpp, p.laba, `${p.margin.toFixed(1)}%`]),
    [], ['', 'TOTAL', data.rekapProduk.reduce((a, p) => a + p.qty, 0), data.rekapProduk.reduce((a, p) => a + p.omzet, 0), data.rekapProduk.reduce((a, p) => a + p.hpp, 0), data.rekapProduk.reduce((a, p) => a + p.laba, 0)]
  ])
  wsProduk['!cols'] = [{ wch: 5 }, { wch: 25 }, { wch: 15 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 12 }]
  XLSX.utils.book_append_sheet(wb, wsProduk, 'Rekap Produk')

  // Sheet 5: Rekap Pembeli
  const wsPembeli = XLSX.utils.aoa_to_sheet([
    [COMPANY_NAME], [`Rekap Pembeli — ${periodLabel}`], [],
    ['No', 'Nama Pembeli', 'Jml Transaksi', 'Total Beli (Rp)', 'Rata-rata/Trx (Rp)', 'Sisa Piutang (Rp)'],
    ...data.rekapPembeli.map((p, i) => [i + 1, p.nama, p.jumlah_transaksi, p.total, p.rata_rata, p.sisa_piutang || 0]),
    [], ['', 'TOTAL', data.rekapPembeli.reduce((a, p) => a + p.jumlah_transaksi, 0), data.rekapPembeli.reduce((a, p) => a + p.total, 0), '', data.rekapPembeli.reduce((a, p) => a + (p.sisa_piutang || 0), 0)]
  ])
  wsPembeli['!cols'] = [{ wch: 5 }, { wch: 30 }, { wch: 15 }, { wch: 20 }, { wch: 20 }, { wch: 20 }]
  XLSX.utils.book_append_sheet(wb, wsPembeli, 'Rekap Pembeli')

  // Sheet 6: Pengeluaran
  const wsPen = XLSX.utils.aoa_to_sheet([
    [COMPANY_NAME], [`Pengeluaran — ${periodLabel}`], [],
    ['Tanggal', 'Kategori', 'Keterangan', 'Jumlah (Rp)'],
    ...data.pengeluaran.map(p => [new Date(p.tanggal).toLocaleDateString('id-ID'), p.kategori, p.keterangan || '-', p.jumlah]),
    [], ['', '', 'TOTAL', data.pengeluaran.reduce((a, p) => a + p.jumlah, 0)]
  ])
  wsPen['!cols'] = [{ wch: 15 }, { wch: 20 }, { wch: 35 }, { wch: 20 }]
  XLSX.utils.book_append_sheet(wb, wsPen, 'Pengeluaran')

  // Sheet 7: Piutang
  const wsPiutang = XLSX.utils.aoa_to_sheet([
    [COMPANY_NAME], [`Data Piutang — ${periodLabel}`], [],
    ['No. Nota', 'Tanggal', 'Nama Pembeli', 'Total (Rp)', 'Terbayar (Rp)', 'Sisa (Rp)', 'Status'],
    ...data.piutang.map(p => [p.no_nota, new Date(p.tanggal).toLocaleDateString('id-ID'), p.nama_pembeli, p.total, p.terbayar || 0, p.sisa, p.status.toUpperCase()]),
    [], ['', '', 'TOTAL', data.piutang.reduce((a, p) => a + p.total, 0), data.piutang.reduce((a, p) => a + (p.terbayar || 0), 0), data.piutang.reduce((a, p) => a + p.sisa, 0)]
  ])
  wsPiutang['!cols'] = [{ wch: 20 }, { wch: 15 }, { wch: 30 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 15 }]
  XLSX.utils.book_append_sheet(wb, wsPiutang, 'Piutang')

  // Sheet 8: Utang Supplier
  const wsUtang = XLSX.utils.aoa_to_sheet([
    [COMPANY_NAME], [`Utang Supplier — ${periodLabel}`], [],
    ['Tanggal', 'Nama Supplier', 'Total (Rp)', 'Terbayar (Rp)', 'Sisa (Rp)', 'Status'],
    ...data.utang.map(u => [new Date(u.tanggal).toLocaleDateString('id-ID'), u.nama_supplier, u.total, u.terbayar || 0, u.sisa, u.status.toUpperCase()]),
    [], ['', 'TOTAL', data.utang.reduce((a, u) => a + u.total, 0), data.utang.reduce((a, u) => a + (u.terbayar || 0), 0), data.utang.reduce((a, u) => a + u.sisa, 0)]
  ])
  wsUtang['!cols'] = [{ wch: 15 }, { wch: 30 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 15 }]
  XLSX.utils.book_append_sheet(wb, wsUtang, 'Utang Supplier')

  XLSX.writeFile(wb, `Laporan_BerkatJaya_${MONTHS[data.bulan]}_${data.tahun}.xlsx`)
}

export function downloadPDF(data: DownloadData) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const periodLabel = `${MONTHS[data.bulan]} ${data.tahun}`
  const pageW = doc.internal.pageSize.getWidth()

  const addHeader = (title: string) => {
    doc.setFontSize(14); doc.setFont('helvetica', 'bold')
    doc.text(COMPANY_NAME, pageW / 2, 15, { align: 'center' })
    doc.setFontSize(9); doc.setFont('helvetica', 'normal')
    doc.text(COMPANY_SUB, pageW / 2, 20, { align: 'center' })
    doc.setFontSize(11); doc.setFont('helvetica', 'bold')
    doc.text(title, pageW / 2, 27, { align: 'center' })
    doc.text(`Periode: ${periodLabel}`, pageW / 2, 33, { align: 'center' })
    doc.setLineWidth(0.5); doc.line(14, 36, pageW - 14, 36)
  }

  // Halaman 1: Ringkasan
  addHeader('LAPORAN BULANAN')
  autoTable(doc, {
    startY: 40,
    head: [['Keterangan', 'Nilai']],
    body: [
      ['Total Omzet Penjualan', fmtRp(data.ringkasan.omzet)],
      ['Total HPP / COGS', fmtRp(data.ringkasan.hpp)],
      ['Laba Kotor', fmtRp(data.ringkasan.labaKotor)],
      ['Total Pengeluaran Operasional', fmtRp(data.ringkasan.pengeluaran)],
      ['Laba Bersih', fmtRp(data.ringkasan.labaBersih)],
      ['Margin Bersih', `${data.ringkasan.marginBersih.toFixed(1)}%`],
      ['', ''],
      ['Jumlah Transaksi', `${fmtNum(data.ringkasan.jumlahTransaksi)} nota`],
      ['Jumlah Pelanggan Aktif', `${data.rekapPembeli.length} orang`],
      ['Total Piutang Belum Lunas', fmtRp(data.piutang.filter(p => p.status === 'belum lunas').reduce((a, p) => a + p.sisa, 0))],
      ['Total Utang Belum Lunas', fmtRp(data.utang.filter(u => u.status === 'belum lunas').reduce((a, u) => a + u.sisa, 0))],
    ],
    headStyles: { fillColor: [46, 125, 50], textColor: 255, fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 100 }, 1: { cellWidth: 70, halign: 'right' } },
    styles: { fontSize: 10 },
    alternateRowStyles: { fillColor: [245, 245, 245] },
  })

  // Halaman 2: Laba Rugi
  doc.addPage(); addHeader('LAPORAN LABA RUGI FORMAL')
  const lrBody: any[] = [
    [{ content: 'A. PENDAPATAN', colSpan: 2, styles: { fontStyle: 'bold', fillColor: [232, 245, 233] } }],
    ['Penjualan Bersih', fmtRp(data.ringkasan.omzet)],
    ['  → Tunai', fmtRp(data.labaRugi.omzetTunai)],
    ['  → Transfer', fmtRp(data.labaRugi.omzetTransfer)],
    ['  → Piutang/Tempo', fmtRp(data.labaRugi.omzetPiutang)],
    [{ content: 'B. HPP / COGS', colSpan: 2, styles: { fontStyle: 'bold', fillColor: [255, 235, 238] } }],
    ...data.labaRugi.hppBreakdown.map(h => [`  → ${h.nama} (${fmtNum(h.qty)} × ${fmtRp(h.hpp_satuan)})`, fmtRp(h.total)]),
    ['Total HPP', fmtRp(data.ringkasan.hpp)],
    [{ content: `C. LABA KOTOR: ${fmtRp(data.ringkasan.labaKotor)}`, colSpan: 2, styles: { fontStyle: 'bold', fillColor: [227, 242, 253] } }],
    [{ content: 'D. BIAYA OPERASIONAL', colSpan: 2, styles: { fontStyle: 'bold', fillColor: [255, 243, 224] } }],
    ...data.labaRugi.pengeluaranPerKategori.map(([k, v]) => [`  → ${k}`, fmtRp(v)]),
    ['Total Biaya Operasional', fmtRp(data.ringkasan.pengeluaran)],
    [{ content: `E. LABA BERSIH: ${fmtRp(data.ringkasan.labaBersih)}  (Margin: ${data.ringkasan.marginBersih.toFixed(1)}%)`, colSpan: 2, styles: { fontStyle: 'bold', fillColor: data.ringkasan.labaBersih >= 0 ? [232, 245, 233] : [255, 235, 238], textColor: data.ringkasan.labaBersih >= 0 ? [27, 94, 32] : [183, 28, 28] } }],
  ]
  autoTable(doc, { startY: 40, body: lrBody, columnStyles: { 0: { cellWidth: 120 }, 1: { cellWidth: 55, halign: 'right' } }, styles: { fontSize: 9 } })

  // Halaman 3: Rekap Produk
  doc.addPage(); addHeader('REKAP PRODUK')
  autoTable(doc, {
    startY: 40,
    head: [['No', 'Produk', 'Qty', 'Omzet (Rp)', 'HPP (Rp)', 'Laba (Rp)', 'Margin']],
    body: [
      ...data.rekapProduk.map((p, i) => [i + 1, p.nama, fmtNum(p.qty), fmtRp(p.omzet), fmtRp(p.hpp), fmtRp(p.laba), `${p.margin.toFixed(1)}%`]),
      [{ content: 'TOTAL', colSpan: 2, styles: { fontStyle: 'bold' } }, fmtNum(data.rekapProduk.reduce((a, p) => a + p.qty, 0)), fmtRp(data.rekapProduk.reduce((a, p) => a + p.omzet, 0)), fmtRp(data.rekapProduk.reduce((a, p) => a + p.hpp, 0)), fmtRp(data.rekapProduk.reduce((a, p) => a + p.laba, 0)), '']
    ],
    headStyles: { fillColor: [46, 125, 50], textColor: 255, fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 8, halign: 'center' }, 1: { cellWidth: 45 }, 2: { cellWidth: 18, halign: 'right' }, 3: { cellWidth: 32, halign: 'right' }, 4: { cellWidth: 32, halign: 'right' }, 5: { cellWidth: 32, halign: 'right' }, 6: { cellWidth: 15, halign: 'right' } },
    styles: { fontSize: 8 }, alternateRowStyles: { fillColor: [245, 245, 245] },
  })

  // Halaman 4: Rekap Pembeli
  doc.addPage(); addHeader('REKAP PEMBELI')
  autoTable(doc, {
    startY: 40,
    head: [['No', 'Nama Pembeli', 'Jml Trx', 'Total Beli (Rp)', 'Rata-rata (Rp)', 'Sisa Piutang (Rp)']],
    body: [
      ...data.rekapPembeli.map((p, i) => [i + 1, p.nama, p.jumlah_transaksi, fmtRp(p.total), fmtRp(p.rata_rata), fmtRp(p.sisa_piutang || 0)]),
      [{ content: 'TOTAL', colSpan: 2, styles: { fontStyle: 'bold' } }, data.rekapPembeli.reduce((a, p) => a + p.jumlah_transaksi, 0), fmtRp(data.rekapPembeli.reduce((a, p) => a + p.total, 0)), '', fmtRp(data.rekapPembeli.reduce((a, p) => a + (p.sisa_piutang || 0), 0))]
    ],
    headStyles: { fillColor: [46, 125, 50], textColor: 255, fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 8, halign: 'center' }, 1: { cellWidth: 55 }, 2: { cellWidth: 15, halign: 'center' }, 3: { cellWidth: 35, halign: 'right' }, 4: { cellWidth: 35, halign: 'right' }, 5: { cellWidth: 35, halign: 'right' } },
    styles: { fontSize: 8 }, alternateRowStyles: { fillColor: [245, 245, 245] },
  })

  // Halaman 5: Piutang
  doc.addPage(); addHeader('DATA PIUTANG')
  autoTable(doc, {
    startY: 40,
    head: [['No. Nota', 'Tanggal', 'Pembeli', 'Total (Rp)', 'Terbayar (Rp)', 'Sisa (Rp)', 'Status']],
    body: [
      ...data.piutang.map(p => [p.no_nota, new Date(p.tanggal).toLocaleDateString('id-ID'), p.nama_pembeli, fmtRp(p.total), fmtRp(p.terbayar || 0), fmtRp(p.sisa), p.status.toUpperCase()]),
      [{ content: 'TOTAL', colSpan: 3, styles: { fontStyle: 'bold' } }, fmtRp(data.piutang.reduce((a, p) => a + p.total, 0)), fmtRp(data.piutang.reduce((a, p) => a + (p.terbayar || 0), 0)), fmtRp(data.piutang.reduce((a, p) => a + p.sisa, 0)), '']
    ],
    headStyles: { fillColor: [46, 125, 50], textColor: 255, fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 28 }, 1: { cellWidth: 22 }, 2: { cellWidth: 40 }, 3: { cellWidth: 28, halign: 'right' }, 4: { cellWidth: 28, halign: 'right' }, 5: { cellWidth: 28, halign: 'right' }, 6: { cellWidth: 18, halign: 'center' } },
    styles: { fontSize: 7.5 }, alternateRowStyles: { fillColor: [245, 245, 245] },
  })

  // Halaman 6: Utang Supplier
  doc.addPage(); addHeader('UTANG SUPPLIER')
  autoTable(doc, {
    startY: 40,
    head: [['Tanggal', 'Nama Supplier', 'Total (Rp)', 'Terbayar (Rp)', 'Sisa (Rp)', 'Status']],
    body: [
      ...data.utang.map(u => [new Date(u.tanggal).toLocaleDateString('id-ID'), u.nama_supplier, fmtRp(u.total), fmtRp(u.terbayar || 0), fmtRp(u.sisa), u.status.toUpperCase()]),
      [{ content: 'TOTAL', colSpan: 2, styles: { fontStyle: 'bold' } }, fmtRp(data.utang.reduce((a, u) => a + u.total, 0)), fmtRp(data.utang.reduce((a, u) => a + (u.terbayar || 0), 0)), fmtRp(data.utang.reduce((a, u) => a + u.sisa, 0)), '']
    ],
    headStyles: { fillColor: [46, 125, 50], textColor: 255, fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 25 }, 1: { cellWidth: 55 }, 2: { cellWidth: 30, halign: 'right' }, 3: { cellWidth: 30, halign: 'right' }, 4: { cellWidth: 30, halign: 'right' }, 5: { cellWidth: 20, halign: 'center' } },
    styles: { fontSize: 8 }, alternateRowStyles: { fillColor: [245, 245, 245] },
  })

  // Halaman 7: Pengeluaran
  doc.addPage(); addHeader('PENGELUARAN OPERASIONAL')
  autoTable(doc, {
    startY: 40,
    head: [['Tanggal', 'Kategori', 'Keterangan', 'Jumlah (Rp)']],
    body: [
      ...data.pengeluaran.map(p => [new Date(p.tanggal).toLocaleDateString('id-ID'), p.kategori, p.keterangan || '-', fmtRp(p.jumlah)]),
      [{ content: 'TOTAL', colSpan: 3, styles: { fontStyle: 'bold' } }, fmtRp(data.pengeluaran.reduce((a, p) => a + p.jumlah, 0))]
    ],
    headStyles: { fillColor: [46, 125, 50], textColor: 255, fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 25 }, 1: { cellWidth: 35 }, 2: { cellWidth: 90 }, 3: { cellWidth: 32, halign: 'right' } },
    styles: { fontSize: 8 }, alternateRowStyles: { fillColor: [245, 245, 245] },
  })

  // Nomor halaman
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8); doc.setFont('helvetica', 'normal')
    doc.text(`Halaman ${i} dari ${pageCount} — Dicetak: ${new Date().toLocaleDateString('id-ID')}`, pageW / 2, doc.internal.pageSize.getHeight() - 8, { align: 'center' })
  }

  doc.save(`Laporan_BerkatJaya_${MONTHS[data.bulan]}_${data.tahun}.pdf`)
}
