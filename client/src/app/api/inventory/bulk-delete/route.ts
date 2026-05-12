import { NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

type UserRow = {
  id?: string | null
  user_id?: string | null
  role?: string | null
  status?: string | null
}

const clean = (value: unknown) => String(value ?? '').trim()

const chunkList = <T,>(items: T[], size = 200) => {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

const uniqueCleanIds = (ids: unknown[]) =>
  Array.from(new Set(ids.map((id) => clean(id)).filter(Boolean)))

const resolveAdminUser = async (supabase: SupabaseClient, email: string) => {
  if (!email) return { userId: '', role: '', status: '' }

  const { data } = await supabase
    .from('users')
    .select('id,user_id,role,status')
    .ilike('email', email)
    .limit(1)
    .maybeSingle()

  const row = data as UserRow | null

  return {
    userId: clean(row?.user_id ?? row?.id),
    role: clean(row?.role),
    status: clean(row?.status),
  }
}

const deleteRowsByIds = async (
  supabase: SupabaseClient,
  table: string,
  column: string,
  ids: string[]
) => {
  for (const chunk of chunkList(ids)) {
    const { error } = await supabase
      .from(table)
      .delete()
      .in(column, chunk)

    if (error) return error
  }

  return null
}

const deleteStorageFolders = async (
  supabase: SupabaseClient,
  bucket: string,
  folderIds: string[]
) => {
  const paths: string[] = []

  for (const folderChunk of chunkList(folderIds, 25)) {
    const listed = await Promise.all(
      folderChunk.map(async (folderId) => {
        try {
          const { data, error } = await supabase.storage
            .from(bucket)
            .list(folderId, { limit: 1000 })

          if (error || !Array.isArray(data) || data.length === 0) return []

          return data
            .filter((file) => !!file?.name && !String(file.name).endsWith('/'))
            .map((file) => `${folderId}/${file.name}`)
        } catch {
          return []
        }
      })
    )

    paths.push(...listed.flat())
  }

  for (const chunk of chunkList(paths)) {
    const { error } = await supabase.storage
      .from(bucket)
      .remove(chunk)

    if (error) return error
  }

  return null
}

export async function POST(req: Request) {
  try {
    const supabaseUrl = clean(process.env.NEXT_PUBLIC_SUPABASE_URL).replace(/\/+$/, '')
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Supabase is not configured' }, { status: 500 })
    }

    const body = await req.json().catch(() => ({}))
    const email = clean(req.headers.get('x-admin-email') || body?.email).toLowerCase()
    const vehicleIds = uniqueCleanIds(Array.isArray(body?.vehicleIds) ? body.vehicleIds : [])
    const carfaxFolderIds = uniqueCleanIds(Array.isArray(body?.carfaxFolderIds) ? body.carfaxFolderIds : vehicleIds)

    if (vehicleIds.length === 0) {
      return NextResponse.json({ error: 'No vehicles selected' }, { status: 400 })
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })

    const { userId, status } = await resolveAdminUser(supabase, email)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (status.toLowerCase() === 'disable') {
      return NextResponse.json({ error: 'Account disabled' }, { status: 403 })
    }

    const relatedDeletes = await Promise.all([
      deleteRowsByIds(supabase, 'edc_costs', 'vehicleId', vehicleIds),
      deleteRowsByIds(supabase, 'edc_disclosures', 'vehicleId', vehicleIds),
      deleteRowsByIds(supabase, 'edc_purchase', 'VehicleId', vehicleIds),
      deleteRowsByIds(supabase, 'edc_purchase_submissions', 'vehicle_id', vehicleIds),
      deleteRowsByIds(supabase, 'edc_warranty', 'id', vehicleIds),
    ])

    const relatedError = relatedDeletes.find(Boolean)
    if (relatedError) {
      return NextResponse.json({ error: 'Failed to delete related records', details: relatedError.message }, { status: 500 })
    }

    const storageDeletes = await Promise.all([
      deleteStorageFolders(supabase, 'vehicle-photos', vehicleIds),
      deleteStorageFolders(supabase, 'Carfax', carfaxFolderIds),
    ])

    const storageError = storageDeletes.find(Boolean)
    if (storageError) {
      return NextResponse.json({ error: 'Failed to delete stored files', details: storageError.message }, { status: 500 })
    }

    const vehicleError = await deleteRowsByIds(supabase, 'edc_vehicles', 'id', vehicleIds)
    if (vehicleError) {
      return NextResponse.json({ error: 'Failed to delete vehicles', details: vehicleError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, deletedCount: vehicleIds.length })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete vehicles' },
      { status: 500 }
    )
  }
}
