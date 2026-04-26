import { getSupabase } from './supabase-server'

type BackupTable = {
  name: string
  select: string
  order?: string
  limit?: number
}

const TABLES: BackupTable[] = [
  {
    name: 'questions',
    select: '*',
    order: 'created_at',
    limit: 5000,
  },
  {
    name: 'profiles',
    select: '*',
    order: 'created_at',
    limit: 5000,
  },
  {
    name: 'player_memories',
    select: '*',
    order: 'created_at',
    limit: 10000,
  },
  {
    name: 'reflections',
    select: '*',
    order: 'created_at',
    limit: 10000,
  },
  {
    name: 'answer_feedback',
    select: '*',
    order: 'created_at',
    limit: 10000,
  },
  {
    name: 'answer_versions',
    select: '*',
    order: 'created_at',
    limit: 10000,
  },
  {
    name: 'kb_sources',
    select: '*',
    order: 'created_at',
    limit: 5000,
  },
  {
    name: 'elijah_preferences',
    select: '*',
    order: 'created_at',
    limit: 5000,
  },
  {
    name: 'waitlist',
    select: '*',
    order: 'created_at',
    limit: 5000,
  },
]

export type DataBackupResult = {
  backedUpAt: string
  path: string
  tables: Array<{ name: string; rows: number; error?: string }>
}

export async function runDataBackup(): Promise<DataBackupResult> {
  const supabase = getSupabase()
  const backedUpAt = new Date().toISOString()
  const snapshot: Record<string, unknown[]> = {}
  const tables: DataBackupResult['tables'] = []

  for (const table of TABLES) {
    let query = supabase
      .from(table.name)
      .select(table.select)
      .limit(table.limit || 5000)

    if (table.order) query = query.order(table.order, { ascending: false })

    const { data, error } = await query
    if (error) {
      snapshot[table.name] = []
      tables.push({ name: table.name, rows: 0, error: error.message })
      continue
    }

    snapshot[table.name] = data || []
    tables.push({ name: table.name, rows: (data || []).length })
  }

  const body = JSON.stringify({ backedUpAt, tables, snapshot })
  const path = `second-brain-backups/backup-${backedUpAt.slice(0, 10)}.json`

  const { data: buckets } = await supabase.storage.listBuckets()
  if (!buckets?.some((bucket) => bucket.name === 'backups')) {
    await supabase.storage.createBucket('backups', { public: false })
  }

  const { error: datedError } = await supabase.storage
    .from('backups')
    .upload(path, body, {
      contentType: 'application/json',
      upsert: true,
    })

  if (datedError) throw datedError

  const { error: latestError } = await supabase.storage
    .from('backups')
    .upload('second-brain-backups/latest.json', body, {
      contentType: 'application/json',
      upsert: true,
    })

  if (latestError) throw latestError

  return { backedUpAt, path, tables }
}
