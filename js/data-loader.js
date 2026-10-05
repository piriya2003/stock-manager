// ══════════════════════════════════════════════════════════════
//  DATA LOADING — ดึงข้อมูลทั้งหมดจาก Supabase ตอน login
// ══════════════════════════════════════════════════════════════
// Supabase ส่งให้ได้ไม่เกิน 1000 แถวต่อคำขอ — ขอรวดเดียวแล้วแถวที่เกินหายเงียบๆ ไม่มี error
// (เดิมคลัง/รายการในใบ DO/ใบ GRN โหลดแบบนั้น พอเกินพันชิ้นของหายจากจอ และใบ DO ที่ถอด/เพิ่ม SN
//  จะคิดยอดเงินจากรายการที่โหลดมาไม่ครบ แล้วเขียนยอดผิดกลับลงฐานข้อมูล)
// วนทีละหน้าจนครบ — orders ต้องปิดท้ายด้วยคอลัมน์ที่ไม่ซ้ำ ไม่งั้นแถวอาจข้าม/ซ้ำระหว่างหน้า
// คืน { data, error } รูปเดียวกับคำขอปกติ
async function selectAllRows(table, select = '*', orders = [['id', true]]) {
  const CHUNK = 1000, rows = [];
  for (let from = 0; ; from += CHUNK) {
    let q = supaClient.from(table).select(select);
    orders.forEach(([col, asc]) => { q = q.order(col, { ascending: asc }); });
    const { data, error } = await q.range(from, from + CHUNK - 1);
    if (error) return { data: null, error };
    rows.push(...(data || []));
    if (!data || data.length < CHUNK) return { data: rows, error: null };
  }
}

async function loadAllData() {
  const newestFirst = [['created_at', false], ['id', true]];
  const [invRes, txRes, repRes, doHRes, doIRes, mpRes, custRes, grnHRes, grnIRes] = await Promise.all([
    selectAllRows('inventory', '*', [['sn', false]]),
    supaClient.from('transactions').select('*').order('created_at', { ascending: false }).limit(TX_PAGE),
    selectAllRows('repair_jobs', '*, customers(name)', newestFirst),
    selectAllRows('do_headers', '*', newestFirst),
    selectAllRows('do_items'),
    selectAllRows('master_products', '*', [['name', true], ['id', true]]),
    selectAllRows('customers', '*', [['name', true]]),
    selectAllRows('grn_headers', '*', newestFirst),
    selectAllRows('grn_items'),
  ]);

  [invRes, txRes, repRes, doHRes, doIRes, mpRes, custRes, grnHRes, grnIRes].forEach(r => { if (r.error) throw r.error; });

  // อะไหล่เพิ่มมาทีหลัง — ดึงแยกและยอมให้ล้มเหลวได้ ถ้ายังไม่ได้รัน stockhq_schema.sql
  // ยัดรวมใน Promise.all ข้างบนไม่ได้ เพราะ error จะทำให้ล็อกอินไม่เข้าทั้งระบบ
  const [partsRes, movesRes] = await Promise.all([
    supaClient.from('parts').select('*').order('name'),
    supaClient.from('part_moves').select('*').order('created_at', { ascending: false }).limit(PART_MOVE_PAGE),
    // ยอดรับเข้า/เบิกสะสมต้องนับจากประวัติทุกแถว ไม่ใช่แค่ชุดที่โหลดมาแสดง
    loadPartTotals(),
  ]);
  partsTableMissing = !!partsRes.error;
  parts     = partsRes.error ? [] : (partsRes.data || []);
  partMoves = movesRes.error ? [] : (movesRes.data || []);
  // ดึงชุดแรกพอให้เข้าระบบไว ที่เหลือกดโหลดเพิ่มได้จากหน้าประวัติอะไหล่
  partMovesAllLoaded = !!movesRes.error || partMoves.length < PART_MOVE_PAGE;
  // คิวอะไหล่ที่ตัดขายแล้วรอออกใบ DO — ต้องหลังโหลด parts เพราะใช้ชื่อ/หน่วยจากตรงนั้น
  await loadPartSaleQueue();

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
    // qty มีค่าเฉพาะรายการจากอะไหล่ที่ไม่มี SN (sn เป็น null) — ไม่อ่านมาด้วย ใบเก่าจะนับ 30 จอเป็น "1 ชิ้น SN null"
    itemsByHeader[it.do_header_id].push({ id: it.id, name: it.item_name, code: it.item_code, category: it.item_category, sn: it.sn, qty: it.qty ?? null, unitPrice: it.unit_price, amount: it.amount });
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
