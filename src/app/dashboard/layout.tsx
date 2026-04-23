import { Sidebar } from "@/components/sidebar"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-[#0d1117] text-white">
      <Sidebar />
      <div className="pt-14 md:pt-0 md:pl-72">{children}</div>
    </div>
  )
}
