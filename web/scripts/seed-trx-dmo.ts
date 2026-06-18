/**
 * Seed script: TRX DMO Building Security System
 * Run with: npx tsx scripts/seed-trx-dmo.ts
 *
 * Inserts:
 *  - Client: TRX City Sdn Bhd
 *  - Site:   DMO Office (TRX)
 *  - Systems: ACS, CCTV, VMS, Intercom, UPS
 *  - Devices: all equipment from warranty list (one row per model)
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'

// Load .env.local from the web/ directory
config({ path: resolve(process.cwd(), '.env.local') })
// Fallback to known local JWT keys if using new sb_* format
if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.startsWith('eyJ')) {
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function run() {
  // ── 1. Get org ──────────────────────────────────────────────────────────
  const { data: org, error: orgErr } = await supabase
    .from('organisations')
    .select('id')
    .limit(1)
    .single()

  if (orgErr || !org) {
    console.error('❌ No organisation found. Run /setup first.', orgErr?.message)
    process.exit(1)
  }
  console.log('✅ Org:', org.id)

  // ── 2. Client ────────────────────────────────────────────────────────────
  let clientId: string
  const { data: existingClient } = await supabase
    .from('clients')
    .select('id')
    .eq('name', 'TRX City Sdn Bhd')
    .maybeSingle()

  if (existingClient) {
    clientId = existingClient.id
    console.log('⚡ Client already exists:', clientId)
  } else {
    const { data: newClient, error: clientErr } = await supabase
      .from('clients')
      .insert({
        organisation_id: org.id,
        name: 'TRX City Sdn Bhd',
        type: 'commercial',
        contact_name: 'TRX Facilities Manager',
        contact_email: 'facilities@trx.my',
        contact_phone: '+603-2786 8000',
        is_active: true,
      })
      .select('id')
      .single()

    if (clientErr || !newClient) {
      console.error('❌ Failed to create client:', clientErr?.message)
      process.exit(1)
    }
    clientId = newClient.id
    console.log('✅ Client created:', clientId)
  }

  // ── 3. Site ──────────────────────────────────────────────────────────────
  let siteId: string
  const { data: existingSite } = await supabase
    .from('sites')
    .select('id')
    .eq('name', 'DMO Office - TRX')
    .maybeSingle()

  if (existingSite) {
    siteId = existingSite.id
    console.log('⚡ Site already exists:', siteId)
  } else {
    const { data: newSite, error: siteErr } = await supabase
      .from('sites')
      .insert({
        client_id: clientId,
        name: 'DMO Office - TRX',
        address: 'Tun Razak Exchange (TRX), Jalan Tun Razak',
        city: 'Kuala Lumpur',
        state: 'Wilayah Persekutuan',
        is_active: true,
      })
      .select('id')
      .single()

    if (siteErr || !newSite) {
      console.error('❌ Failed to create site:', siteErr?.message)
      process.exit(1)
    }
    siteId = newSite.id
    console.log('✅ Site created:', siteId)
  }

  // ── 4. ELV Systems ───────────────────────────────────────────────────────
  const systemDefs = [
    {
      key: 'ACS',
      type: 'access_control',
      name: 'Access Control System',
      brand: 'Gallagher',
      model: 'FT6000 Controller Linux',
      install_date: '2024-01-29',
      warranty_expiry: '2025-01-28',
      location_desc: 'DMO & DMMOS - Entire Building',
    },
    {
      key: 'CCTV',
      type: 'cctv',
      name: 'CCTV Surveillance System',
      brand: 'Surveon / Dahua',
      model: 'D4U-2U-SERVER',
      install_date: '2024-01-29',
      warranty_expiry: '2025-01-28',
      location_desc: 'DMO & DMMOS - All Floors',
    },
    {
      key: 'VMS',
      type: 'av',
      name: 'Visitor Management System (VMS)',
      brand: 'Device4U',
      model: 'Dell DL-WST3660MT-13',
      install_date: '2024-01-29',
      warranty_expiry: '2025-01-28',
      location_desc: 'DMO Reception / Security Counter',
    },
    {
      key: 'INTERCOM',
      type: 'pa',
      name: 'Intercom System',
      brand: 'Device4U',
      model: 'Master Intercom with Camera',
      install_date: '2024-01-29',
      warranty_expiry: '2025-01-28',
      location_desc: 'DMO Entrance',
    },
    {
      key: 'UPS',
      type: 'bms',
      name: 'UPS & Power System',
      brand: 'Liebert / Vertiv',
      model: 'GXT-6000LRT2U230',
      install_date: '2024-01-29',
      warranty_expiry: '2025-01-28',
      location_desc: 'DMO Server Room',
    },
  ]

  const systemIds: Record<string, string> = {}

  for (const sys of systemDefs) {
    const { data: existing } = await supabase
      .from('elv_systems')
      .select('id')
      .eq('site_id', siteId)
      .eq('type', sys.type)
      .maybeSingle()

    if (existing) {
      systemIds[sys.key] = existing.id
      console.log(`⚡ System already exists [${sys.type}]:`, existing.id)
      continue
    }

    const { data: newSys, error: sysErr } = await supabase
      .from('elv_systems')
      .insert({
        site_id: siteId,
        type: sys.type,
        name: sys.name,
        brand: sys.brand,
        model: sys.model,
        install_date: sys.install_date,
        warranty_expiry: sys.warranty_expiry,
        location_desc: sys.location_desc,
        is_active: true,
      })
      .select('id')
      .single()

    if (sysErr || !newSys) {
      console.error(`❌ Failed to create system [${sys.type}]:`, sysErr?.message)
      continue
    }
    systemIds[sys.key] = newSys.id
    console.log(`✅ System created [${sys.type}]:`, newSys.id)
  }

  // ── 5. Devices ───────────────────────────────────────────────────────────
  // Enum values: camera, nvr, dvr, door_reader, door_controller, door_lock,
  //              network_switch, patch_panel, cable_port, access_point, server, other
  const devices = [
    // ── ACS ────────────────────────────────────────────────────────────────
    {
      sys: 'ACS', device_type: 'door_reader', name: 'Gallagher T12 Reader (Black)',
      model: 'T12 Reader', serial_no: '2306362070', qty: 62,
      location_desc: 'DMO & DMMOS – Various doors (62 units, SN 2306362070–2306462149)',
    },
    {
      sys: 'ACS', device_type: 'door_reader', name: 'Gallagher T20 Multi Tech Reader',
      model: 'T20 Multi Tech', serial_no: '2310427073', qty: 5,
      location_desc: 'DMO & DMMOS – Special access points (5 units)',
    },
    {
      sys: 'ACS', device_type: 'door_controller', name: 'Gallagher FT6000 Controller Linux',
      model: 'FT6000', serial_no: '2329409041', qty: 5,
      location_desc: 'DMO & DMMOS – Security room (5 units, SN 2329409041–2329409013)',
    },
    {
      sys: 'ACS', device_type: 'other', name: 'Gallagher 8H Plug-In Module',
      model: '8H Plug-In Module', serial_no: '2330131057', qty: 5,
      location_desc: 'DMO & DMMOS – Controller panels (5 units)',
    },
    {
      sys: 'ACS', device_type: 'other', name: 'Gallagher HBUS 16 In 16 Out',
      model: 'HBUS 16/16', serial_no: '2238456024', qty: 2,
      location_desc: 'DMO & DMMOS (2 units)',
    },
    {
      sys: 'ACS', device_type: 'other', name: 'Gallagher HBUS Wiegand Module',
      model: 'HBUS Wiegand', serial_no: '2319325519', qty: 10,
      location_desc: 'DMO & DMMOS (10 units, SN 2319325519–2320325146)',
    },
    {
      sys: 'ACS', device_type: 'door_reader', name: 'Facial Recognition Scanner',
      model: 'Face Recognition Scanner', serial_no: '2244SMA0000029', qty: 11,
      location_desc: 'DMO & DMMOS – Key entry points (11 units)',
    },
    {
      sys: 'ACS', device_type: 'door_reader', name: 'Mifare Reader – D4U RFID USB',
      model: 'D4U Mifare RFID Reader', serial_no: '3607', qty: 1,
      location_desc: 'DMO & DMMOS – Enrolment station',
    },
    {
      sys: 'ACS', device_type: 'other', name: 'Gallagher Encoder Unit Mifare',
      model: 'Encoder Unit Mifare', serial_no: 'RR383-000093', qty: 1,
      location_desc: 'DMO & DMMOS – Card encoding station',
    },
    {
      sys: 'ACS', device_type: 'door_reader', name: 'Face Recognition Terminal (Fever + Mask)',
      model: 'Face Recognition Terminal', serial_no: '7L0D0BFPAJ49B7C', qty: 2,
      location_desc: 'DMO & DMMOS – Building entrance (2 units)',
    },
    {
      sys: 'ACS', device_type: 'other', name: '13.8V Switching Power Supply',
      model: '13.8V PSU', serial_no: 'SC2B2Q3571', qty: 20,
      location_desc: 'DMO & DMMOS – Various panels (20 units)',
    },
    {
      sys: 'ACS', device_type: 'other', name: '13.4V Switching Power Supply',
      model: '13.4V PSU', serial_no: 'SC292B9947', qty: 5,
      location_desc: 'DMO & DMMOS (5 units)',
    },
    {
      sys: 'ACS', device_type: 'server', name: '42U Multi-Vendor Server Rack',
      model: '42U Server', serial_no: 'DMO-ACS-RACK-01', qty: 1,
      location_desc: 'DMO & DMMOS – Server room',
    },
    {
      sys: 'ACS', device_type: 'other', name: 'Emergency Breakglass',
      model: 'Emergency Breakglass', serial_no: 'DR23-250096', qty: 43,
      location_desc: 'DMO & DMMOS – All emergency exit doors (43 units)',
    },
    {
      sys: 'ACS', device_type: 'other', name: 'Override Key Switch with Tamper Sensor',
      model: 'Override Key Switch', serial_no: '3586', qty: 6,
      location_desc: 'DMO & DMMOS (6 units, SN 3585–3598)',
    },
    {
      sys: 'ACS', device_type: 'other', name: 'Panic Button',
      model: 'Panic Button', serial_no: '3599', qty: 1,
      location_desc: 'DMO & DMMOS – Security desk',
    },
    {
      sys: 'ACS', device_type: 'other', name: 'Strobe Light',
      model: 'Strobe Light', serial_no: '3600', qty: 1,
      location_desc: 'DMO & DMMOS',
    },
    {
      sys: 'ACS', device_type: 'door_lock', name: 'Electromagnetic Lock 600 lbs',
      model: 'EM Lock 600 lbs', serial_no: '6L23-840329', qty: 62,
      location_desc: 'DMO & DMMOS – All access-controlled doors (62 units)',
    },
    {
      sys: 'ACS', device_type: 'other', name: '12V 12AH Backup Battery',
      model: '12V 12AH Battery', serial_no: '26781001', qty: 34,
      location_desc: 'DMO & DMMOS – Power supply backup (34 units)',
    },
    {
      sys: 'ACS', device_type: 'other', name: '12V 7.2AH Backup Battery',
      model: '12V 7.2AH Battery', serial_no: '26226138', qty: 5,
      location_desc: 'DMO & DMMOS (5 units)',
    },
    {
      sys: 'ACS', device_type: 'other', name: 'Exit Push Button with Base',
      model: 'Exit Push Button', serial_no: '3763', qty: 1,
      location_desc: 'DMO exit door',
    },

    // ── CCTV ───────────────────────────────────────────────────────────────
    {
      sys: 'CCTV', device_type: 'server', name: 'CCTV Server 2U (12-Bay)',
      model: 'D4U-2U-SERVER', serial_no: 'ST22588-IQL2304008-SC01', qty: 4,
      location_desc: 'DMO & DMMOS – Server room (4 units)',
    },
    {
      sys: 'CCTV', device_type: 'other', name: 'SAS Hard Disk 16TB 7200RPM',
      model: 'ST16000NM004J', serial_no: 'ZR5E03NB', qty: 5,
      location_desc: 'DMO & DMMOS – Installed in servers (5 units)',
    },
    {
      sys: 'CCTV', device_type: 'camera', name: '5MP Motorized Dome Network Camera',
      model: '5MP Motorized Dome', serial_no: 'SM68V112315001139', qty: 42,
      location_desc: 'DMO & DMMOS – All floors / common areas (42 units)',
    },
    {
      sys: 'CCTV', device_type: 'camera', name: '5MP Mini Dome Network Camera',
      model: '5MP Mini Dome', serial_no: 'EM82V102329001726', qty: 4,
      location_desc: 'DMO & DMMOS – Specific zones (4 units)',
    },
    {
      sys: 'CCTV', device_type: 'camera', name: 'Pro Dome Network Camera',
      model: 'Pro Dome', serial_no: 'EM82V102327000943', qty: 2,
      location_desc: 'DMO & DMMOS – External / entrance (2 units)',
    },
    {
      sys: 'CCTV', device_type: 'network_switch', name: '24-Port Network Switch',
      model: '24P Network Switch', serial_no: 'SJAE26372Q8D', qty: 3,
      location_desc: 'DMO & DMMOS – Comms room (3 units)',
    },
    {
      sys: 'CCTV', device_type: 'server', name: 'VMS Decoder & CCTV Workstation',
      model: 'Dell DL-WST5860-01', serial_no: 'DGMCWY3', qty: 1,
      location_desc: 'DMO & DMMOS – Control room',
    },
    {
      sys: 'CCTV', device_type: 'network_switch', name: '8-Port PoE Switch (90W)',
      model: '8P PoE Switch', serial_no: 'RVEPE2A000129', qty: 2,
      location_desc: 'DMO & DMMOS (2 units)',
    },
    {
      sys: 'CCTV', device_type: 'access_point', name: 'Ubiquiti NanoBeam AC Gen2',
      model: 'NBE-5AC-Gen2', serial_no: 'E43883A0A4E2', qty: 2,
      location_desc: 'DMO & DMMOS – Wireless link (2 units)',
    },
    {
      sys: 'CCTV', device_type: 'other', name: 'Ubiquiti INS-3AF-I-G PoE Adapter',
      model: 'INS-3AF-I-G', serial_no: 'K17120715763', qty: 2,
      location_desc: 'DMO & DMMOS (2 units)',
    },

    // ── VMS ────────────────────────────────────────────────────────────────
    {
      sys: 'VMS', device_type: 'server', name: 'VMS Workstation',
      model: 'Dell DL-WST3660MT-13', serial_no: 'JCMCWY3', qty: 1,
      location_desc: 'DMO Reception / Security counter',
    },
    {
      sys: 'VMS', device_type: 'camera', name: 'Logitech C930e Webcam',
      model: 'C930e', serial_no: '2329AP079MV9', qty: 1,
      location_desc: 'DMO VMS counter',
    },
    {
      sys: 'VMS', device_type: 'other', name: 'Dymo Label Writer',
      model: 'LabelWriter', serial_no: '1750111-2D56691', qty: 1,
      location_desc: 'DMO VMS counter – visitor badge printer',
    },

    // ── INTERCOM ───────────────────────────────────────────────────────────
    {
      sys: 'INTERCOM', device_type: 'other', name: 'Master Intercom with Camera',
      model: 'Device4U Master Intercom', serial_no: 'LGB4222001515', qty: 1,
      location_desc: 'DMO main entrance',
    },
    {
      sys: 'INTERCOM', device_type: 'other', name: 'Slave Video Intercom',
      model: 'Slave Video Intercom', serial_no: 'P2D3223000918', qty: 1,
      location_desc: 'DMO inner entrance',
    },

    // ── UPS ────────────────────────────────────────────────────────────────
    {
      sys: 'UPS', device_type: 'other', name: 'Liebert UPS 6KVA',
      model: 'GXT-6000LRT2U230', serial_no: '83622304500933', qty: 1,
      location_desc: 'DMO Server room – main UPS',
    },
    {
      sys: 'UPS', device_type: 'other', name: 'Liebert External Battery 2U (SNMP)',
      model: 'GXTRT-EBC192VRT2U', serial_no: '95162212100124', qty: 1,
      location_desc: 'DMO Server room',
    },
    {
      sys: 'UPS', device_type: 'other', name: 'Liebert External Battery 2U',
      model: 'GXTRT-EBC192VRT2U', serial_no: '95162212100125', qty: 3,
      location_desc: 'DMO Server room (3 units)',
    },
    {
      sys: 'UPS', device_type: 'other', name: 'Liebert UPS 2KVA',
      model: 'GXTRT-2000IRT2UXL', serial_no: '2322410047RT12C', qty: 1,
      location_desc: 'DMO – secondary UPS',
    },
    {
      sys: 'UPS', device_type: 'other', name: 'Vertiv VE Rack',
      model: 'SR-V061120SF-42Ux600Wx110D', serial_no: 'DMO-UPS-RACK-01', qty: 1,
      location_desc: 'DMO Server room',
    },
  ]

  let deviceCount = 0
  for (const dev of devices) {
    const sysId = systemIds[dev.sys]
    if (!sysId) {
      console.warn(`⚠️  No system ID for key [${dev.sys}] — skipping ${dev.name}`)
      continue
    }

    // Check if already exists (by serial_no + system_id)
    const { data: existing } = await supabase
      .from('devices')
      .select('id')
      .eq('system_id', sysId)
      .eq('serial_no', dev.serial_no)
      .maybeSingle()

    if (existing) {
      console.log(`⚡ Device already exists: ${dev.name}`)
      continue
    }

    const prefix = dev.device_type.toUpperCase().slice(0, 3)
    const rand = Math.floor(Math.random() * 9000) + 1000
    const tag_id = `DEV-${prefix}-${rand}`

    const { error: devErr } = await supabase.from('devices').insert({
      system_id: sysId,
      tag_id,
      name: dev.qty > 1 ? `${dev.name} (×${dev.qty})` : dev.name,
      device_type: dev.device_type,
      model: dev.model,
      serial_no: dev.serial_no,
      location_desc: dev.location_desc,
      is_active: true,
    })

    if (devErr) {
      console.error(`❌ Failed to create device [${dev.name}]:`, devErr.message)
    } else {
      deviceCount++
      console.log(`✅ Device: ${dev.name}`)
    }
  }

  console.log(`\n🎉 Done! Seeded TRX DMO data.`)
  console.log(`   Client : TRX City Sdn Bhd`)
  console.log(`   Site   : DMO Office - TRX`)
  console.log(`   Systems: ACS, CCTV, VMS, Intercom, UPS`)
  console.log(`   Devices: ${deviceCount} created`)
}

run().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
