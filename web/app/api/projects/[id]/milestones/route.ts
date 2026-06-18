import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

const DEFAULT_MILESTONES = [
  // ADMIN
  { item_no:  1, title: 'Project Kick-Off Meeting',              category: 'ADMIN',        priority: 'High',   percent_done: 0 },
  { item_no:  2, title: 'Letter of Award / Contract Signed',     category: 'ADMIN',        priority: 'High',   percent_done: 0 },
  { item_no:  3, title: 'Insurance & Bonds Submission',          category: 'ADMIN',        priority: 'Medium', percent_done: 0 },
  { item_no:  4, title: 'Project Team Assignment',               category: 'ADMIN',        priority: 'Medium', percent_done: 0 },
  { item_no:  5, title: 'Project Schedule Baseline Approved',    category: 'ADMIN',        priority: 'High',   percent_done: 0 },
  // PLANNING
  { item_no:  6, title: 'Site Survey & Assessment',              category: 'PLANNING',     priority: 'High',   percent_done: 0 },
  { item_no:  7, title: 'Design Drawing Submission',             category: 'PLANNING',     priority: 'High',   percent_done: 0 },
  { item_no:  8, title: 'Design Drawing Approval',               category: 'PLANNING',     priority: 'High',   percent_done: 0 },
  { item_no:  9, title: 'Method Statement Submission',           category: 'PLANNING',     priority: 'Medium', percent_done: 0 },
  { item_no: 10, title: 'Method Statement Approval',             category: 'PLANNING',     priority: 'Medium', percent_done: 0 },
  { item_no: 11, title: 'Risk Assessment Submission',            category: 'PLANNING',     priority: 'Medium', percent_done: 0 },
  { item_no: 12, title: 'Material Submittal Submission',         category: 'PLANNING',     priority: 'High',   percent_done: 0 },
  { item_no: 13, title: 'Material Submittal Approval',           category: 'PLANNING',     priority: 'High',   percent_done: 0 },
  // PROCUREMENT
  { item_no: 14, title: 'Purchase Order Issued',                 category: 'PROCUREMENT',  priority: 'High',   percent_done: 0 },
  { item_no: 15, title: 'Factory Acceptance Test (FAT)',         category: 'PROCUREMENT',  priority: 'Medium', percent_done: 0 },
  { item_no: 16, title: 'Equipment Delivery to Site',            category: 'PROCUREMENT',  priority: 'High',   percent_done: 0 },
  { item_no: 17, title: 'Delivery Inspection / Receiving',       category: 'PROCUREMENT',  priority: 'Medium', percent_done: 0 },
  // INSTALLATION
  { item_no: 18, title: 'Permit to Work (PTW) Obtained',         category: 'INSTALLATION', priority: 'High',   percent_done: 0 },
  { item_no: 19, title: 'Cable Tray / Conduit Installation',     category: 'INSTALLATION', priority: 'High',   percent_done: 0 },
  { item_no: 20, title: 'Cable Pulling & Termination',           category: 'INSTALLATION', priority: 'High',   percent_done: 0 },
  { item_no: 21, title: 'Equipment Mounting & Installation',     category: 'INSTALLATION', priority: 'High',   percent_done: 0 },
  { item_no: 22, title: 'Earthing & Bonding Works',              category: 'INSTALLATION', priority: 'Medium', percent_done: 0 },
  { item_no: 23, title: 'Point-to-Point Cable Testing',          category: 'INSTALLATION', priority: 'High',   percent_done: 0 },
  { item_no: 24, title: 'Power-On & Pre-commissioning',          category: 'INSTALLATION', priority: 'High',   percent_done: 0 },
  { item_no: 25, title: 'System Integration Testing',            category: 'INSTALLATION', priority: 'High',   percent_done: 0 },
  { item_no: 26, title: 'Loop / Zone Testing',                   category: 'INSTALLATION', priority: 'High',   percent_done: 0 },
  { item_no: 27, title: 'Functional Testing Completed',          category: 'INSTALLATION', priority: 'High',   percent_done: 0 },
  { item_no: 28, title: 'Inspection by Authorities (BOMBA/JKR)', category: 'INSTALLATION', priority: 'High',   percent_done: 0 },
  // HANDOVER
  { item_no: 29, title: 'Technical & Non-Compliance (TNC) Report', category: 'HANDOVER',   priority: 'High',   percent_done: 0 },
  { item_no: 30, title: 'User Acceptance Test (UAT)',            category: 'HANDOVER',     priority: 'High',   percent_done: 0 },
  { item_no: 31, title: 'Defect Rectification Completed',        category: 'HANDOVER',     priority: 'High',   percent_done: 0 },
  { item_no: 32, title: 'As-Built Drawing Submission',           category: 'HANDOVER',     priority: 'High',   percent_done: 0 },
  { item_no: 33, title: 'As-Built Drawing Approval',             category: 'HANDOVER',     priority: 'High',   percent_done: 0 },
  { item_no: 34, title: 'O&M Manual Submission',                 category: 'HANDOVER',     priority: 'Medium', percent_done: 0 },
  { item_no: 35, title: 'Spare Parts Handover',                  category: 'HANDOVER',     priority: 'Low',    percent_done: 0 },
  { item_no: 36, title: 'Training to End User',                  category: 'HANDOVER',     priority: 'Medium', percent_done: 0 },
  { item_no: 37, title: 'Certificate of Completion (CPC/CMGD)',  category: 'HANDOVER',     priority: 'High',   percent_done: 0 },
  { item_no: 38, title: 'Practical Completion Certificate',      category: 'HANDOVER',     priority: 'High',   percent_done: 0 },
  // POST-PROJECT
  { item_no: 39, title: 'Defect Liability Period (DLP) Start',   category: 'POST-PROJECT', priority: 'High',   percent_done: 0 },
  { item_no: 40, title: 'Preventive Maintenance Schedule Set',   category: 'POST-PROJECT', priority: 'Medium', percent_done: 0 },
  { item_no: 41, title: 'Final Account Submission',              category: 'POST-PROJECT', priority: 'High',   percent_done: 0 },
  { item_no: 42, title: 'Final Account Approved',                category: 'POST-PROJECT', priority: 'High',   percent_done: 0 },
  { item_no: 43, title: 'Final Retention Payment Received',      category: 'POST-PROJECT', priority: 'High',   percent_done: 0 },
  { item_no: 44, title: 'DLP Inspection & Sign-Off',             category: 'POST-PROJECT', priority: 'High',   percent_done: 0 },
  { item_no: 45, title: 'Project Closure Report',                category: 'POST-PROJECT', priority: 'Medium', percent_done: 0 },
  { item_no: 46, title: 'Lessons Learned Documentation',         category: 'POST-PROJECT', priority: 'Low',    percent_done: 0 },
  { item_no: 47, title: 'Archive Project Documents',             category: 'POST-PROJECT', priority: 'Low',    percent_done: 0 },
]

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { data, error } = await supabaseAdmin
    .from('project_milestones')
    .select('*')
    .eq('project_id', id)
    .order('item_no', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // If no milestones yet, seed defaults
  if (!data || data.length === 0) {
    const rows = DEFAULT_MILESTONES.map(m => ({ ...m, project_id: id, status: 'pending' }))
    const { data: seeded, error: seedErr } = await supabaseAdmin
      .from('project_milestones')
      .insert(rows)
      .select()
    if (seedErr) return NextResponse.json({ error: seedErr.message }, { status: 500 })
    return NextResponse.json(seeded ?? [])
  }

  return NextResponse.json(data)
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()

  if (!body.title?.trim()) return NextResponse.json({ error: 'Title is required.' }, { status: 400 })
  if (!body.category)      return NextResponse.json({ error: 'Category is required.' }, { status: 400 })

  // Get max item_no
  const { data: existing } = await supabaseAdmin
    .from('project_milestones')
    .select('item_no')
    .eq('project_id', id)
    .order('item_no', { ascending: false })
    .limit(1)
  const nextNo = existing && existing.length > 0 ? existing[0].item_no + 1 : 1

  const { data, error } = await supabaseAdmin
    .from('project_milestones')
    .insert({
      project_id:      id,
      item_no:         body.item_no ?? nextNo,
      title:           body.title.trim(),
      status:          body.status          || 'pending',
      completion_date: body.completion_date || null,
      category:        body.category,
      priority:        body.priority        || 'Medium',
      notes:           body.notes           || null,
      ref_doc:         body.ref_doc         || null,
      percent_done:    body.percent_done    ?? 0,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
