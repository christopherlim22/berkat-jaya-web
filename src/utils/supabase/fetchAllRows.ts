import { supabase } from "@/utils/supabase/client"

export const fetchAllRows = async (table: string, selectQuery: string, filters?: any) => {
  let allData: any[] = []
  let from = 0
  const batchSize = 1000
  
  while (true) {
    let query = supabase.from(table).select(selectQuery).range(from, from + batchSize - 1)
    
    // Apply filters if any
    if (filters?.eq) {
      filters.eq.forEach(([col, val]: [string, any]) => { query = query.eq(col, val) })
    }
    if (filters?.in) {
      filters.in.forEach(([col, val]: [string, any[]]) => { query = query.in(col, val) })
    }
    if (filters?.gte) query = query.gte(filters.gte[0], filters.gte[1])
    if (filters?.lte) query = query.lte(filters.lte[0], filters.lte[1])
    if (filters?.order) query = query.order(filters.order[0], { ascending: filters.order[1] })
    
    const { data, error } = await query
    if (error || !data || data.length === 0) break
    allData = [...allData, ...data]
    if (data.length < batchSize) break
    from += batchSize
  }
  
  return allData
}
