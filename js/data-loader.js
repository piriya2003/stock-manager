// ══════════════════════════════════════════════════════════════
//  DATA LOADING — ดึงข้อมูลทั้งหมดจาก Supabase ตอน login
// ══════════════════════════════════════════════════════════════
async function loadAllData() {
  const [invRes, txRes, repRes, doHRes, doIRes, mpRes, custRes, grnHRes, grnIRes] = await Promise.all([
    supaClient.from('inventory').select('*').order('sn', { ascending: false }),
    supaClient.from('transactions').select('*').order('created_at', { ascending: false }).limit(TX_PAGE),
    supaClient.from('repair_jobs').select('*, customers(name)').order('created_at', { ascending: false }),
    supaClient.from('do_headers').select('*').order('created_at', { ascending: false }),
    supaClient.from('do_items').select('*'),
    supaClient.from('master_products').select('*').order('name'),
    supaClient.from('customers').select('*').order('name'),
    supaClient.from('grn_headers').select('*').order('created_at', { ascending: false }),
    supaClient.from('grn_items').select('*'),
  ]);

  [invRes, txRes, repRes, doHRes, doIRes, mpRes, custRes, grnHRes, grnIRes].forEach(r => { if (r.error) throw r.error; });

  // รายชื่อผู้ใช้ไว้แปลง id เป็นชื่อบนเอกสาร/ประวัติ
  // แอดมินอ่านได้ทุกแถว พนักงานทั่วไป RLS จะคืนมาแค่แถวตัวเอง — ไม่ใช่ error ปล่อยผ่านได้
  userNames = {};
  const usrRes = await supaClient.from('users').select('id, username');
  if (!usrRes.error) (usrRes.data || []).forEach(u => { userNames[u.id] = u.username; });

  stock = invRes.data;
  // ดึงประวัติชุดแรกพอให้เข้าระบบไว ที่เหลือกดโหลดเพิ่มได้จากหน้ารายงาน
  txns = txRes.data.map(mapTxRow);
  txnsAllLoaded = txRes.data.length < TX_PAGE;

  repairJobs = repRes.data.map(j => ({
    id: j.id, sn: j.sn, name: j.name, code: j.code, category: j.category,
    customer: j.customers ? j.customers.name : '', customerId: j.customer_id,
    techName: j.tech_name, symptom: j.symptom, status: j.status,
    notes: j.notes, createdAt: j.created_at, startedAt: j.started_at,
    finishedAt: j.finished_at, replacedSN: j.replaced_sn, claimReason: j.claim_reason,
  }));

  const itemsByHeader = {};
  doIRes.data.forEach(it => {
    if (!itemsByHeader[it.do_header_id]) itemsByHeader[it.do_header_id] = [];
    itemsByHeader[it.do_header_id].push({ id: it.id, name: it.item_name, code: it.item_code, category: it.item_category, sn: it.sn, unitPrice: it.unit_price, amount: it.amount });
  });
  doHistory = doHRes.data.map(d => ({
    id: d.id, doNo: d.do_no, date: d.do_date, type: d.type,
    customer: d.customer_name, customerAddress: d.customer_address, salesperson: d.salesperson, machine: d.machine,
    headerText: d.header_text, createdAt: d.created_at, createdBy: d.created_by,
    items: itemsByHeader[d.id] || [],
  }));

  masterProds = mpRes.data;
  customers   = custRes.data;

  const itemsByGRN = {};
  grnIRes.data.forEach(it => {
    if (!itemsByGRN[it.grn_header_id]) itemsByGRN[it.grn_header_id] = [];
    itemsByGRN[it.grn_header_id].push({ name: it.item_name, code: it.item_code, category: it.item_category, sn: it.sn });
  });
  grnHistory = grnHRes.data.map(g => ({
    id: g.id, grnNo: g.grn_no, date: g.grn_date, supplier: g.supplier, poNo: g.po_no, lotNo: g.lot_no,
    note: g.note, createdAt: g.created_at, createdBy: g.created_by,
    items: itemsByGRN[g.id] || [],
  }));
}
