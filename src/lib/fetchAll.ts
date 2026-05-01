import { supabase } from '@/utils/supabase/client'

export async function fetchAllRows(
  table: string,
  selectQuery: string,
  filters?: {
    eq?: [string, any][]
    gte?: [string, any]
    lte?: [string, any]
    in?: [string, any[]]
    order?: [string, boolean]
  }
): Promise<any[]> {
  let allData: any[] = []
  let from = 0
  const batchSize = 1000

  while (true) {
    let query = supabase.from(table).select(selectQuery).range(from, from + batchSize - 1)
    if (filters?.eq) filters.eq.forEach(([col, val]) => { query = query.eq(col, val) })
    if (filters?.gte) query = query.gte(filters.gte[0], filters.gte[1])
    if (filters?.lte) query = query.lte(filters.lte[0], filters.lte[1])
    if (filters?.in) query = query.in(filters.in[0], filters.in[1])
    if (filters?.order) query = query.order(filters.order[0], { ascending: filters.order[1] })

    const { data, error } = await query
    if (error || !data || data.length === 0) break
    allData = [...allData, ...data]
    if (data.length < batchSize) break
    from += batchSize
  }

  return allData
}
