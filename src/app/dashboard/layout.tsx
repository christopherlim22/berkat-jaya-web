"use client"

import { useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { getUserRole } from "@/utils/supabase/getUserRole"
import { Sidebar } from "@/components/sidebar"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const checkRole = async () => {
      const role = await getUserRole()
      if (role === 'kasir' && pathname === '/dashboard') {
        router.replace('/dashboard/kasir')
      }
    }
    checkRole()
  }, [pathname, router])

  return (
    <div className="min-h-screen bg-[#0d1117] text-white">
      <Sidebar />
      <div className="pt-14 md:pt-0 md:pl-72">{children}</div>
    </div>
  )
}
