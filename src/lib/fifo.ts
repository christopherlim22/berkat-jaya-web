export type HPPLayer = {
  tanggal: string
  qty_awal: number
  qty_sisa: number
  hpp_satuan: number
}

export type FIFOResult = {
  hpp_satuan_weighted: number
  total_hpp: number
  detail_layers: { tanggal: string; qty_used: number; hpp_satuan: number; nilai: number }[]
}

export function hitungHPPFIFO(layers: HPPLayer[], qtyTerjual: number): FIFOResult {
  let remaining = qtyTerjual
  let totalHPP = 0
  const detailLayers: FIFOResult['detail_layers'] = []

  for (const layer of layers) {
    if (remaining <= 0) break
    if (layer.qty_sisa <= 0) continue
    const qtyUsed = Math.min(remaining, layer.qty_sisa)
    const nilai = qtyUsed * layer.hpp_satuan
    totalHPP += nilai
    detailLayers.push({ tanggal: layer.tanggal, qty_used: qtyUsed, hpp_satuan: layer.hpp_satuan, nilai })
    remaining -= qtyUsed
  }

  return {
    hpp_satuan_weighted: qtyTerjual > 0 ? totalHPP / qtyTerjual : 0,
    total_hpp: totalHPP,
    detail_layers: detailLayers
  }
}

export function buildLayersAtDate(
  hppAllList: any[],
  transaksiDetailAll: any[],
  konversiDetail: any[],
  stokAwalMap: Record<string, { qty: number; hpp_satuan: number; tanggal: string }>,
  namaProduk: string,
  sampaiTanggal: Date
): HPPLayer[] {
  const layers: HPPLayer[] = []

  // Stok awal sebagai layer pertama
  const sa = stokAwalMap[namaProduk]
  if (sa && sa.qty > 0 && sa.hpp_satuan > 0) {
    layers.push({
      tanggal: sa.tanggal,
      qty_awal: sa.qty,
      qty_sisa: sa.qty,
      hpp_satuan: sa.hpp_satuan
    })
  }

  // Tambah pembelian (HPP) sebelum sampaiTanggal, urut ascending
  hppAllList
    .filter(h => h.nama_produk === namaProduk && new Date(h.tanggal) < sampaiTanggal)
    .sort((a, b) => new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime())
    .forEach(h => {
      layers.push({
        tanggal: h.tanggal,
        qty_awal: h.qty,
        qty_sisa: h.qty,
        hpp_satuan: h.hpp_satuan
      })
    })

  // Consume dari transaksi sebelum sampaiTanggal, urut ascending
  const getTanggal = (d: any): string | null => {
    if (!d.transaksi) return null
    if (Array.isArray(d.transaksi)) return d.transaksi[0]?.tanggal ?? null
    return d.transaksi.tanggal
  }

  transaksiDetailAll
    .filter(d => {
      const tgl = getTanggal(d)
      return d.nama_produk === namaProduk && tgl && new Date(tgl) < sampaiTanggal
    })
    .sort((a, b) => new Date(getTanggal(a) || 0).getTime() - new Date(getTanggal(b) || 0).getTime())
    .forEach(d => {
      let remaining = d.qty
      for (const layer of layers) {
        if (remaining <= 0) break
        const consumed = Math.min(remaining, layer.qty_sisa)
        layer.qty_sisa -= consumed
        remaining -= consumed
      }
    })

  // Consume dari konversi keluar sebelum sampaiTanggal
  konversiDetail
    .filter(k => k.arah === 'keluar' && k.nama_produk === namaProduk)
    .forEach(k => {
      let remaining = k.qty
      for (const layer of layers) {
        if (remaining <= 0) break
        const consumed = Math.min(remaining, layer.qty_sisa)
        layer.qty_sisa -= consumed
        remaining -= consumed
      }
    })

  return layers.filter(l => l.qty_sisa > 0)
}
