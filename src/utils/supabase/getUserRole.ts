import { createClient } from "@/utils/supabase/client"

export async function getUserRole(): Promise<'admin' | 'kasir' | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('user_roles')
    .select('role')
    .eq('id', user.id)
    .single()
  return (data?.role as 'admin' | 'kasir') ?? null
}
