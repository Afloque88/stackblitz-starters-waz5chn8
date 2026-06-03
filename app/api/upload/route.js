import { b2Client, BUCKET_NAME } from '@/lib/b2'
import { createClient } from '@/lib/supabase'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { NextResponse } from 'next/server'

export async function POST(request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Tidak dibenarkan' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('file')
  const assignment_slot_id = formData.get('assignment_slot_id')

  if (!file) return NextResponse.json({ error: 'Tiada fail' }, { status: 400 })

  // Semak saiz fail — maksimum 10MB
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'Fail terlalu besar, maksimum 10MB' }, { status: 400 })
  }

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)
  const fileName = `${user.id}/${assignment_slot_id}/${Date.now()}-${file.name}`

  // Upload ke Backblaze B2
  await b2Client.send(new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: fileName,
    Body: buffer,
    ContentType: file.type,
  }))

  const file_url = `${process.env.B2_ENDPOINT}/${BUCKET_NAME}/${fileName}`

  // Simpan metadata dalam Supabase
  const { data: existing } = await supabase
    .from('submissions')
    .select('id')
    .eq('pelajar_id', user.id)
    .eq('assignment_slot_id', assignment_slot_id)
    .single()

  if (existing) {
    await supabase
      .from('submissions')
      .update({ file_url, file_name: file.name, updated_at: new Date() })
      .eq('id', existing.id)
  } else {
    await supabase
      .from('submissions')
      .insert({ pelajar_id: user.id, assignment_slot_id, file_url, file_name: file.name })
  }

  return NextResponse.json({ success: true, file_url })
}