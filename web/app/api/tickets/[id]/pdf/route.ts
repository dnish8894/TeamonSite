import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// We generate the PDF on the client side using jspdf.
// This route just returns all data needed to build the PDF.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const [{ data: ticket }, { data: report }, { data: activities }, { data: org }] = await Promise.all([
    supabaseAdmin
      .from('tickets')
      .select(`
        id, ticket_no, title, description, type, priority, status,
        is_chargeable, quotation_no, reporter_name, reporter_phone, site_id,
        created_at, resolved_at, closed_at,
        sla_resolve_due, sla_response_due,
        sites ( name, address, city, state, site_contact, site_phone, clients ( name, type ) ),
        elv_systems ( name, type ),
        devices ( name, tag_id, device_type, model, serial_no, location_desc, floor ),
        engineers ( users ( full_name, phone ) )
      `)
      .eq('id', id)
      .single(),
    supabaseAdmin
      .from('job_reports')
      .select('findings, root_cause, work_done, recommendation, photos, parts_used, labour_hrs, travel_hrs, client_name, client_date, client_signature, signed_at, onsite_time, offsite_time, job_status, remarks, reported_by, reported_date, engineer_signature, custom_field_values')
      .eq('ticket_id', id)
      .single(),
    supabaseAdmin
      .from('ticket_activities')
      .select('action, new_value, note, created_at, users ( full_name )')
      .eq('ticket_id', id)
      .order('created_at', { ascending: true }),
    supabaseAdmin.from('organisations').select('name, phone, email, address, logo_url, report_settings').limit(1).single(),
  ])

  return NextResponse.json({ ticket, report, activities, org })
}
