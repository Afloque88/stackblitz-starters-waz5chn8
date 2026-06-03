import { createClient } from '@/lib/supabase'
import { b2Client, BUCKET_NAME } from '@/lib/b2'
import { GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { NextResponse } from 'next/server'

// Guru: ambil semua submissions ikut assignment slot
export async function GET(request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Tidak dibenarkan' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const assignment_slot_id = searchParams.get('assignment_slot_id')

  const { data, error } = await supabase
    .from('submissions')
    .select(`*, profiles(name), assignment_slots(tajuk, bahagian)`)
    .eq('assignment_slot_id', assignment_slot_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Generate signed URL untuk download
  const submissionsWithUrl = await Promise.all(data.map(async (sub) => {
    const key = sub.file_url.split(`${BUCKET_NAME}/`)[1]
    const url = await getSignedUrl(b2Client, new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    }), { expiresIn: 3600 })
    return { ...sub, download_url: url }
  }))

  return NextResponse.json({ data: submissionsWithUrl })
}

// Pelajar: delete submission
export async function DELETE(request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Tidak dibenarkan' }, { status: 401 })

  const { submission_id } = await request.json()

  const { data: sub } = await supabase
    .from('submissions')
    .select('file_url, pelajar_id')
    .eq('id', submission_id)
    .single()

  if (sub.pelajar_id !== user.id) {
    return NextResponse.json({ error: 'Tidak dibenarkan' }, { status: 403 })
  }

  // Delete dari B2
  const key = sub.file_url.split(`${BUCKET_NAME}/`)[1]
  await b2Client.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: key }))

  // Delete dari Supabase
  await supabase.from('submissions').delete().eq('id', submission_id)

  return NextResponse.json({ success: true })
}