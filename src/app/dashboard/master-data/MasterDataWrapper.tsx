"use client"

import { useState } from "react"
import { ProdukTab } from "./components/ProdukTab"
import { PelangganTab } from "./components/PelangganTab"
import { SupplierTab } from "./components/SupplierTab"


type Tab = "produk" | "pelanggan" | "supplier"

export default function MasterDataWrapper() {
  const [activeTab, setActiveTab] = useState<Tab>("produk")

  return (
    <>
      <header className="sticky top-0 z-10 flex flex-col px-8 pt-5 bg-[#0d1117]/80 backdrop-blur border-b border-white/[0.05]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Master Data</h2>
            <p className="text-sm text-gray-500 mt-1">Kelola data seluruh produk, pelanggan, dan supplier Anda</p>
          </div>
        </div>

        <div className="flex gap-6 mt-2 relative">
          <button
            onClick={() => setActiveTab("produk")}
            className={`pb-3 text-sm font-semibold transition-colors border-b-2 ${activeTab === "produk" ? "text-white border-green-500" : "text-gray-400 border-transparent hover:text-gray-200"}`}
          >
            📦 Produk
          </button>
          <button
            onClick={() => setActiveTab("pelanggan")}
            className={`pb-3 text-sm font-semibold transition-colors border-b-2 ${activeTab === "pelanggan" ? "text-white border-green-500" : "text-gray-400 border-transparent hover:text-gray-200"}`}
          >
            👥 Pelanggan
          </button>
          <button
            onClick={() => setActiveTab("supplier")}
            className={`pb-3 text-sm font-semibold transition-colors border-b-2 ${activeTab === "supplier" ? "text-white border-green-500" : "text-gray-400 border-transparent hover:text-gray-200"}`}
          >
            🏭 Supplier
          </button>
        </div>
      </header>

      <main className="p-8">
        {activeTab === "produk" && <ProdukTab />}
        {activeTab === "pelanggan" && <PelangganTab />}
        {activeTab === "supplier" && <SupplierTab />}
      </main>
    </>
  )
}
