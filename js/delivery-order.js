  // วันที่จ่ายออก = วันที่กดเพิ่มจริง ไม่ใช่วันของใบเดิม
  // เดิมยัดให้เป็นชุดเดียวกับของเดิมในใบ ของที่เพิ่มวันนี้เลยไปโผล่ใต้วันเก่า หาไม่เจอตอนกรองตามวันที่
  const batchAt = nowISO();// ══════════════════════════════════════════════════════════════
//  DO — CREATE / SAVE / PRINT
// ══════════════════════════════════════════════════════════════
// เลขที่ใบ DO: DO-ปีเดือน-ลำดับ เช่น DO-2608-0001 — ขึ้นเดือนใหม่เริ่มนับ 0001 ใหม่
// (เลขเก่ารูปแบบ DO-260821-xxxx ที่มีวันอยู่ด้วย จะไม่ถูกนับรวม เพราะคนละ prefix กัน)
function genDONo() {
  const n = new Date(), yy = String(n.getFullYear()).slice(-2), mm = String(n.getMonth()+1).padStart(2,'0');
  return nextDocNo(`DO-${yy}${mm}-`, doHistory.map(d => d.doNo));
}

function openDOModal() {
  doFromLiveSession = true;
  doItems = outSession.slice();
  prepDOModal();
}

// หาลูกค้าในทะเบียนจากชื่อที่ติดอยู่กับตัวสินค้า — ไม่สนเว้นวรรคเกิน/ตัวพิมพ์ (ดู normCustName)
function custByName(name) {
  const k = normCustName(name);
  return k ? customers.find(c => normCustName(c.name) === k) || null : null;
}

// เปิดใบ DO ของ "ของที่จ่ายออกไปแล้ว" — ลูกค้าบนใบต้องเป็นเจ้าของของในใบเสมอ
// เดิมทางประวัติไม่ได้บอกเจ้าของ ส่วนทางชุดการจ่ายเทียบชื่อตรงตัวเป๊ะ พอหาไม่เจอก็ตกไปใช้
// ลูกค้าที่ค้างเลือกอยู่ในหน้าโอน/ขาย ใบของ TOPS เลยออกมาพร้อมที่อยู่ของร้านอื่น
// ownerName ว่าง = ไม่รู้เจ้าของ (ของเก่ามาก) จึงยอมใช้ลูกค้าที่เลือกค้างไว้แทนแบบเดิม
// items ปกติมี .sn (สินค้าที่มี SN, นับ 1 แถว = 1 ชิ้น) — ถ้ามี .qty แทน ถือว่ามาจากอะไหล่ที่ไม่มี SN
// (1 แถว = ทั้งจำนวน) ต้องคงรูปนี้ไว้ ไม่ไปแปลงเป็น sn เพราะ groupDOItems ใช้แยกสองแบบนี้อยู่
function openDOForSold(items, ownerName) {
  doFromLiveSession = false;
  doItems = items.map(i => i.qty != null
    ? { name: i.name, code: i.code, category: i.category, qty: i.qty, partId: i.partId }
    : { name: i.name, code: i.code, category: i.category, sn: String(i.sn) });
  const owner = ownerName ? custByName(ownerName) : undefined;
  prepDOModal(owner);
  // เจ้าของที่ไม่อยู่ในทะเบียนลูกค้า — ใส่ชื่อตามที่ติดกับสินค้า ที่อยู่ให้กรอกเอง
  if (ownerName && !owner) document.getElementById('do-cust').value = ownerName;
}

// ของหลายชิ้นที่จะรวมเป็นใบเดียว ถ้าเป็นของลูกค้าคนละเจ้าต้องถามก่อน (ใบหนึ่งระบุลูกค้าได้คนเดียว)
function confirmMixedOwners(items) {
  const custs = [...new Set(items.map(i => normCustName(i.dispatched_to)).filter(Boolean))];
  if (custs.length < 2) return true;
  const names = [...new Set(items.map(i => i.dispatched_to).filter(Boolean))].join('\n• ');
  return confirm(`สินค้าที่เลือกเป็นของลูกค้าคนละเจ้า:\n• ${names}\n\nใบ DO ใบเดียวระบุลูกค้าได้คนเดียว จะรวมต่อไหม?`);
}

function openDOFromHistory() {
  const items = getFilteredSoldItems();
  if (!items.length) return toast('ไม่มีรายการสินค้าที่ขายออก (ตามที่กรองอยู่)', 'error');
  // ถ้าเลือกกรองลูกค้าไว้ ของทุกชิ้นเป็นของเจ้านั้นอยู่แล้ว ไม่งั้นใช้เจ้าของของชิ้นแรกที่รู้เจ้าของ
  const histCust = document.getElementById('o-hist-cust')?.value;
  if (!histCust && !confirmMixedOwners(items)) return;
  openDOForSold(items, histCust || items.find(i => i.dispatched_to)?.dispatched_to || '');
}

// สร้าง DO เฉพาะ "ชุดการจ่าย" เดียว (ตามเวลาที่จ่ายออก)
function openDOFromBatch(batchIndex) {
  const b = outboundBatches[batchIndex];
  if (!b || !b.items.length) return toast('ไม่พบรายการในชุดนี้', 'error');
  // ใบนี้เป็นของ "ลูกค้าเจ้าของชุด" ไม่ใช่ลูกค้าที่ค้างเลือกอยู่ในหน้าสแกน
  openDOForSold(b.items, b.cust);
}

// สร้าง DO จากเลข SN ที่พิมพ์/วาง/สแกนมาโดยตรง — ไม่ต้องหาผ่านตัวกรองวันที่/ลูกค้า
// ใช้ตอนของชิ้นเดียวกันถูกจ่ายไปคนละวัน/คนละรอบสแกน แล้วอยากรวมใบเดียวแบบเจาะจงเป็นชิ้นๆ
function openDOFromSNList() {
  const raw = document.getElementById('do-sn-list').value || '';
  const list = [...new Set(raw.split(/[\s,]+/).map(s => s.trim().replace(/^\*+|\*+$/g, '')).filter(Boolean))];
  if (!list.length) return inlineMsg('do-sn-msg', '❌ กรุณาวาง/พิมพ์หรือสแกน SN ก่อน', false);

  const found = [], notFound = [], notSold = [];
  list.forEach(sn => {
    const item = stock.find(i => String(i.sn) === sn);
    if (!item) notFound.push(sn);
    else if (item.status !== 'Sold') notSold.push(sn);
    else found.push(item);
  });
  if (!found.length) return inlineMsg('do-sn-msg', `❌ ไม่มี SN ที่ออก DO ได้ (ไม่พบ ${notFound.length}, ยังไม่ได้จ่ายออก ${notSold.length})`, false);

  // SN ที่ระบุมาอาจเป็นของคนละลูกค้า (จ่ายไปคนละรอบ) ต้องรู้ตัวก่อนรวมเป็นใบเดียว
  if (!confirmMixedOwners(found)) return;
  openDOForSold(found, found.find(i => i.dispatched_to)?.dispatched_to || '');

  let msg = `✅ พบ ${found.length} รายการ นำเข้าใบ DO แล้ว`;
  if (notFound.length || notSold.length) msg += `  (ข้าม: ไม่พบ ${notFound.length}, ยังไม่ได้จ่ายออก ${notSold.length})`;
  inlineMsg('do-sn-msg', msg, true);
}

// ══════════════════════════════════════════════════════════════
//  อะไหล่ที่ตัดขายแล้ว (ไม่มี SN) — รอออกใบ DO
//  ตัดยอด+ลง part_moves ไปแล้วตั้งแต่ตอนกด "ตัดขาย" ในหน้าอะไหล่ (ดู js/parts.js)
//  ตรงนี้แค่รวบเป็นใบ DO ทีหลัง เหมือนของที่มี SN ที่ตัดสต็อกไปแล้วรอออกใบ
// ══════════════════════════════════════════════════════════════
function renderPartsDOQueue() {
  const tbody = document.getElementById('parts-do-tbody');
  if (!tbody) return;
  if (partSaleSchemaMissing) {
    tbody.innerHTML = `<tr><td colspan="4" class="tbl-empty">${t('ต้องรัน sql/add-do-items-qty.sql ใน Supabase ก่อน จึงจะขายอะไหล่และออกใบ DO ได้')}</td></tr>`;
    return;
  }
  const groups = {};
  partsDOQueue.forEach(q => {
    const key = q.custId || normCustName(q.custName) || '—';
    if (!groups[key]) groups[key] = { custId: q.custId, custName: q.custName, items: [], qty: 0 };
    groups[key].items.push(q);
    groups[key].qty += q.qty;
  });
  const list = Object.values(groups);
  window.__partsQueueGroups = list;   // ให้ openDOFromPartsQueue(gi) อ้าง index เดียวกับที่วาดตรงนี้
  tbody.innerHTML = list.length ? list.map((g, gi) => `
    <tr>
      <td>${escapeHtml(g.custName || '—')}</td>
      <td>${g.items.map(it => `<div style="display:flex;align-items:center;gap:6px"><span>${escapeHtml(it.name)} × ${it.qty} ${escapeHtml(it.unit || 'ชิ้น')}</span>`
        + `<button onclick="cancelPartSale(${jsArg(it.id)})" class="btn btn-ghost btn-sm" style="padding:0 6px" title="${t('ยกเลิกการขาย — คืนยอดเข้าอะไหล่')}">✕</button></div>`).join('')}</td>
      <td style="text-align:center;font-family:var(--mono);font-weight:700;color:var(--orange)">${g.qty}</td>
      <td style="text-align:center"><button onclick="openDOFromPartsQueue(${gi})" class="btn btn-primary btn-sm">📄 สร้าง DO</button></td>
    </tr>`).join('') : `<tr><td colspan="4" class="tbl-empty">${t('ยังไม่มีอะไหล่ที่ตัดขายรอออกใบ')}</td></tr>`;
}

// สร้างใบ DO จากอะไหล่ที่ตัดขายไว้ให้ลูกค้าคนเดียวกัน (gi = index ในกลุ่มที่วาดโดย renderPartsDOQueue)
function openDOFromPartsQueue(gi) {
  const g = (window.__partsQueueGroups || [])[gi];
  if (!g || !g.items.length) return toast('ไม่พบรายการ', 'error');
  openDOForSold(g.items, g.custName);
  pendingPartsDOBatch = g.items.slice();   // ตั้งหลัง prepDOModal (ที่ openDOForSold เรียก) เพราะมันล้างค่านี้ทิ้งก่อนเสมอ
}

function prepDOModal(custOverride) {
  // ล้างค้างจากครั้งก่อนเสมอ — เปิดใบ DO ใบใหม่ที่ไม่ได้มาจากคิวอะไหล่ ต้องไม่พาลบรายการในคิวของครั้งก่อน
  // (openDOFromPartsQueue ตั้งค่านี้เอง "หลัง" เรียก prepDOModal อีกที)
  pendingPartsDOBatch = null;
  doModalMode = 'create';
  document.getElementById('do-modal-badge').style.display = 'none';
  document.getElementById('do-modal-hint').textContent = 'กรอกข้อมูลและกด "บันทึก DO" เพื่อบันทึกประวัติ';
  document.getElementById('do-save-btn').style.display = 'inline-flex';
  document.getElementById('do-header-text').contentEditable = 'true';
  document.getElementById('do-no').readOnly = false;
  document.getElementById('do-cust').readOnly = false;
  document.getElementById('do-salesperson').readOnly = false;
  document.getElementById('do-machine').readOnly = false;
  document.getElementById('do-date').readOnly = false;
  // ใบใหม่ใช้ปุ่ม "บันทึก DO" ไม่ใช่ปุ่มแก้ไขของใบเก่า
  document.getElementById('do-edit-btn').style.display = 'none';
  document.getElementById('do-update-btn').style.display = 'none';
  document.getElementById('do-manage-btn').style.display = 'none';
  document.getElementById('do-no').value = genDONo();
  document.getElementById('do-date').value = fmtDODate(nowISO());
  // custOverride: ลูกค้าในทะเบียน / null = รู้เจ้าของแต่ไม่อยู่ในทะเบียน / undefined = ใช้ที่เลือกค้างในหน้าสแกน
  // ห้ามถอยไปใช้หน้าสแกนเมื่อได้ null — ไม่งั้นใบจะได้ที่อยู่ของลูกค้าคนละเจ้า
  const custSel = document.getElementById('o-cust');
  const custObj = custOverride !== undefined ? custOverride : customers.find(c => c.id === custSel.value);
  doCustId = custObj ? custObj.id : null;   // ใช้ตอนบันทึก แทนการอ่านค่าจาก dropdown หน้าสแกนซ้ำ
  document.getElementById('do-cust').value = custObj ? custObj.name : '';

  // ที่อยู่มาจากทะเบียนลูกค้า (หน้าข้อมูลหลัก) — ยังพิมพ์ทับได้ถ้าใบนี้ต้องส่งที่อื่น
  const addr = document.getElementById('do-cust-addr');
  if (addr) { addr.textContent = custObj?.address || ''; addr.contentEditable = 'true'; }
  const items = document.getElementById('do-items');
  if (!doItems.length) {
    items.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:12px;color:#888">ไม่มีรายการ</td></tr>';
  } else {
    const grp = groupDOItems(doItems);
    items.innerHTML = Object.entries(grp).map(([name, v], i) => doItemRow(name, v, i)).join('');
  }
  recalcDOTotals();
  document.getElementById('do-modal').classList.add('open');
}

// วันที่บนใบ DO รูปแบบ 24-Jul-2026 (ตามใบจริง)
// วันที่ "บนใบ" (do_date) แก้ย้อนหลังได้ — ต่างจาก created_at ที่เป็นเวลาที่กดบันทึกจริง แก้ไม่ได้
// ใบเก่าที่ยังไม่มี do_date ให้ถอยไปใช้วันที่สร้างแทน (ค่าเดิมของมันคือวันเดียวกันอยู่แล้ว)
function doDateOf(d) {
  if (d.date) return String(d.date).slice(0, 10);
  return d.createdAt ? new Date(d.createdAt).toLocaleDateString('en-CA') : today();
}

// อ่านวันที่ที่พิมพ์บนหัวใบ (รูปแบบ 21-Aug-2026) กลับเป็น YYYY-MM-DD สำหรับเก็บลงฐานข้อมูล
// พิมพ์มั่วหรือเว้นว่าง → ใช้วันนี้แทน ดีกว่าบันทึกค่าที่อ่านไม่ออกลงไป
// ช่องวันที่บนใบพิมพ์เองได้ คนกรอกจึงพิมพ์มาได้หลายแบบ — 24/07/2569 พอๆ กับ 24-Jul-2026
// เดิมรู้จักแค่ 24-Jul-2026 กับ 2026-07-24 แบบอื่นตกไปเป็น "วันนี้" เงียบๆ ใบที่ออกย้อนหลังเลยลงวันที่ผิด
// คืน '' เมื่ออ่านไม่ออก ให้ฝั่งที่เรียกเตือนแทนที่จะเดาวันให้
const TH_MONTHS = ['มกรา','กุมภา','มีนา','เมษา','พฤษภา','มิถุนา','กรกฎา','สิงหา','กันยา','ตุลา','พฤศจิกา','ธันวา'];
function parseDODate(text) {
  const s = String(text || '').trim();
  if (!s) return today();

  // ปี พ.ศ. → ค.ศ. (2569 → 2026) — ใช้กับทุกรูปแบบด้านล่าง
  const ce = y => (Number(y) >= 2400 ? Number(y) - 543 : Number(y));
  const mk = (y, mo, d) => {
    const dt = new Date(ce(y), mo - 1, Number(d));
    // กันวันที่ไม่มีจริง เช่น 31/02/2026 (JS จะเลื่อนไปเป็น 3 มี.ค. ให้เงียบๆ)
    if (dt.getFullYear() !== ce(y) || dt.getMonth() !== mo - 1 || dt.getDate() !== Number(d)) return '';
    return `${ce(y)}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  };

  // 24-Jul-2026 / 24 กรกฎาคม 2569 / 24-ก.ค.-69 ไม่รับ (ปีต้อง 4 หลัก)
  let m = s.match(/^(\d{1,2})[-/.\s]+([A-Za-z฀-๿.]{2,})[-/.\s]+(\d{4})$/);
  if (m) {
    const name = m[2].replace(/\./g, '').toLowerCase();
    let i = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(name.slice(0, 3));
    if (i < 0) i = TH_MONTHS.findIndex(th => name.startsWith(th.slice(0, 4)));
    if (i >= 0) return mk(m[3], i + 1, m[1]);
    return '';
  }
  // 24/07/2026 · 24-07-2569 · 24.07.2026
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (m) return mk(m[3], Number(m[2]), m[1]);
  // 2026-07-24
  m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (m) return mk(m[1], Number(m[2]), m[3]);

  return '';
}

function fmtDODate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const m = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()];
  return `${String(d.getDate()).padStart(2, '0')}-${m}-${d.getFullYear()}`;
}

// รวมรายการในใบ DO ตามชื่อสินค้า — ใช้ร่วมกันทั้งตอนสร้างใหม่ (prepDOModal), เปิดพิมพ์ซ้ำ
// (reopenDOForPrint) และหน้าดูใบเดิม (openDOView) กันไม่ให้ logic แยกกัน 3 ที่แล้วแก้ไม่ครบ
//
// สินค้าทั่วไปนับ "1 แถวใน items = 1 ชิ้น" ผ่าน .sn (ไม่มี SN ก็ไม่ควรมาทางนี้)
// รายการจากอะไหล่ไม่มี SN รายชิ้น เลยส่งมาเป็น 1 แถว = ทั้งจำนวนผ่าน .qty แทน (sn เป็น null/undefined)
// รวมยอดสุดท้ายต้องบวกทั้งสองทาง (g.qty = จำนวน SN ที่นับได้ + จำนวนจากอะไหล่)
function groupDOItems(items) {
  const grp = {};
  (items || []).forEach(i => {
    if (!grp[i.name]) grp[i.name] = { name: i.name, code: i.code, category: i.category, sns: [], ids: [], noSnQty: 0, unitPrice: i.unitPrice, amount: i.amount };
    const g = grp[i.name];
    if (i.id != null) g.ids.push(i.id);
    if (i.qty != null) g.noSnQty += i.qty; else g.sns.push(i.sn);
  });
  Object.values(grp).forEach(g => { g.qty = g.sns.length + g.noSnQty; });
  return grp;
}

// แถวสินค้าในใบ DO (คอลัมน์: Product No. / Description / Qty / Unit Price / Amount)
function doItemRow(name, v, i) {
  // ใต้ชื่อสินค้าไม่โชว์อะไรเลย — รหัสสินค้ากับหมวดหมู่เป็นข้อมูลไว้จัดการภายใน
  // ไม่ใช่ของที่ลูกค้าต้องเห็นบนเอกสาร (ยังมีคอลัมน์ "รหัสสินค้า" ซ้ายสุดเป็นเลขลำดับอยู่)
  const sorted = v.sns.slice().sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true })); // เรียงน้อย→มาก แสดงครบทุกเลข
  // เรียงเป็น 2 คอลัมน์ (ดูที่ .sn ใน style.css) — ใบที่มีของเป็นร้อยชิ้นจะได้ไม่กินกระดาษเป็นสิบแผ่น
  const sns = sorted.map(s => `<span class="sn">Serial NO : ${escapeHtml(s)}</span>`).join('');
  // ส่วนที่มาจากอะไหล่ (ไม่มี SN) — บอกจำนวนไว้เฉยๆ แทนรายชื่อ SN
  const noSn = v.noSnQty ? `<span class="sn" style="opacity:.7">(${t('ไม่มี SN')} — ${v.noSnQty} ${t('ชิ้น')})</span>` : '';
  const priceVal = v.unitPrice != null ? Number(v.unitPrice).toFixed(2) : '';
  const amtVal = v.amount != null ? Number(v.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';
  return `<tr data-qty="${v.qty}" data-name="${escapeHtml(name)}">
      <td class="c">${i + 1}</td>
      <td><div class="do-name">${escapeHtml(name)}</div>${sns}${noSn}</td>
      <td class="c">${v.qty}</td>
      <td><input class="do-num" data-role="price" inputmode="decimal" value="${priceVal}" oninput="calcDOAmount(this)" title="ราคาต่อหน่วย (พิมพ์ได้)"></td>
      <td><input class="do-num" data-role="amount" inputmode="decimal" value="${amtVal}" oninput="recalcDOTotals()" title="จำนวนเงิน (คำนวณให้ หรือพิมพ์ทับเองได้)"></td>
    </tr>`;
}

// ใส่ราคาต่อหน่วย → คำนวณจำนวนเงินให้ (ยังพิมพ์ทับช่องจำนวนเงินเองได้)
function calcDOAmount(inp) {
  const tr = inp.closest('tr'); if (!tr) return;
  const amt = tr.querySelector('input[data-role="amount"]'); if (!amt) return;
  const qty = parseFloat(tr.dataset.qty || '');
  const price = parseFloat(String(inp.value).replace(/,/g, ''));
  if (!isFinite(qty) || !isFinite(price)) amt.value = '';
  else amt.value = (qty * price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  recalcDOTotals();
}

const DO_VAT_RATE = 7;   // ภาษีมูลค่าเพิ่ม (%)
function fmtMoney(n) { return '฿' + (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

// รวมยอด → VAT → ยอดสุทธิ → จำนวนเงินตัวอักษร
function recalcDOTotals() {
  let total = 0, any = false;
  document.querySelectorAll('#do-items input[data-role="amount"]').forEach(el => {
    const v = parseFloat(String(el.value).replace(/,/g, ''));
    if (isFinite(v)) { total += v; any = true; }
  });
  const vat = Math.round(total * DO_VAT_RATE) / 100;
  const grand = Math.round((total + vat) * 100) / 100;
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('do-total', fmtMoney(total));
  set('do-vat', fmtMoney(vat));
  set('do-grand', fmtMoney(grand));
}


async function saveDO() {
  const doNo       = document.getElementById('do-no').value.trim();
  const custVal    = document.getElementById('do-cust').value.trim();
  const salesVal   = document.getElementById('do-salesperson').value.trim();
  const machineVal = document.getElementById('do-machine').value.trim();
  const headerText = document.getElementById('do-header-text').innerText;
  const typ        = document.getElementById('o-type')?.value || 'โอนสินค้า';
  const custId     = customers.some(c => c.id === doCustId) ? doCustId : null;

  if (!doNo) return toast('กรุณาระบุเลขที่ DO', 'error');
  if (!custVal) return toast('กรุณาระบุชื่อลูกค้า', 'error');
  if (!doItems.length) return toast('ไม่มีรายการสินค้าในใบ DO', 'error');
  const doDate = parseDODate(document.getElementById('do-date').value);
  if (!doDate) return toast('อ่านวันที่บนใบไม่ออก — ใช้แบบ 24/07/2569 หรือ 24-Jul-2026', 'error');

  // อ่านราคาต่อหน่วย/จำนวนเงินจากแต่ละแถวสินค้า (ต่อกลุ่ม) เพื่อแนบไปกับทุก SN ในกลุ่มนั้น
  const priceByName = {};
  document.querySelectorAll('#do-items tr[data-name]').forEach(tr => {
    const priceInp = tr.querySelector('input[data-role="price"]');
    const amtInp = tr.querySelector('input[data-role="amount"]');
    const price = priceInp && priceInp.value !== '' ? parseFloat(String(priceInp.value).replace(/,/g, '')) : null;
    const amount = amtInp && amtInp.value !== '' ? parseFloat(String(amtInp.value).replace(/,/g, '')) : null;
    priceByName[tr.dataset.name] = { price: isFinite(price) ? price : null, amount: isFinite(amount) ? amount : null };
  });

  const custAddr = document.getElementById('do-cust-addr')?.innerText.trim() || '';

  // ใบนี้มาจากคิวอะไหล่ที่ตัดขายไว้ — ต้อง "จอง" แถวขายเหล่านั้นก่อน (ผูกกับ id ของใบนี้)
  // สองเครื่องกดออกใบให้รายการเดียวกันพร้อมกัน เครื่องที่ช้ากว่าจะจองไม่ได้ แล้วหยุดก่อนสร้างใบซ้ำ
  // สร้าง id ของหัวใบเองตรงนี้ เพราะต้องใช้จองก่อนที่หัวใบจะมีอยู่จริง
  const saleIds = pendingPartsDOBatch ? pendingPartsDOBatch.map(q => q.id) : [];
  const headerId = saleIds.length ? crypto.randomUUID() : undefined;
  let claimed = false;
  const releaseClaims = async () => {
    if (!claimed) return;
    await supaClient.from('part_moves').update({ do_header_id: null }).eq('do_header_id', headerId).select('id');
    claimed = false;
  };

  try {
    if (saleIds.length) {
      const { data: took, error: cErr } = await supaClient.from('part_moves').update({ do_header_id: headerId })
        .in('id', saleIds).is('do_header_id', null).is('cancelled_at', null).select('id');
      if (cErr) throw cErr;
      claimed = !!(took && took.length);
      if (!took || took.length !== saleIds.length) {
        const nothingTaken = !took || !took.length;
        await releaseClaims();
        pendingPartsDOBatch = null;
        closeDOModal();
        await loadPartSaleQueue(); renderPartsDOQueue();
        // จองไม่ได้สักแถว แต่รายการยังอยู่ในคิวครบ = ไม่ได้ถูกใครแย่ง แต่แก้แถวไม่ได้เลย (RLS ไม่มี update policy
        // คืน 0 แถวโดยไม่แจ้ง error) — ต้องบอกให้ชัด ไม่งั้นจะเข้าใจผิดว่าอีกเครื่องออกใบไปแล้วตลอด
        if (nothingTaken && saleIds.every(id => partsDOQueue.some(q => String(q.id) === String(id)))) {
          return toast('จองรายการอะไหล่ไม่ได้ทั้งที่ไม่มีใครแย่ง — น่าจะยังไม่ได้ตั้งสิทธิ์แก้ part_moves: รัน sql/add-do-items-qty.sql ให้ครบทั้งไฟล์', 'error');
        }
        return toast('รายการอะไหล่บางชิ้นถูกออกใบ DO หรือยกเลิกไปแล้วจากอีกเครื่อง — อัปเดตคิวให้แล้ว ลองสร้างใบใหม่', 'warning');
      }
    }

    const { data: header, error: hErr } = await supaClient.from('do_headers').insert({
      ...(headerId ? { id: headerId } : {}),
      do_no: doNo, do_date: doDate, type: typ, customer_id: custId, customer_name: custVal,
      customer_address: custAddr, salesperson: salesVal, machine: machineVal,
      header_text: headerText, created_by: currentUserId,
    }).select().single();
    if (hErr) {
      await releaseClaims();
      if (hErr.code === '23505') return toast(`เลขที่ DO: ${doNo} มีในระบบแล้ว`, 'error');
      throw hErr;
    }

    // รายการจากอะไหล่ (i.qty != null) ไม่มี SN — 1 แถวในฐานข้อมูลแทนทั้งจำนวน sn เป็น null
    const itemRows = doItems.map(i => ({
      do_header_id: header.id, item_name: i.name, item_code: i.code, item_category: i.category,
      sn: i.qty != null ? null : String(i.sn), qty: i.qty ?? null, part_id: i.partId ?? null,
      unit_price: priceByName[i.name]?.price ?? null, amount: priceByName[i.name]?.amount ?? null,
    }));
    const { data: insertedItems, error: iErr } = await supaClient.from('do_items').insert(itemRows).select();
    if (iErr) { await releaseClaims(); throw iErr; }   // อะไหล่กลับเข้าคิว ไม่ค้างผูกกับใบที่ไม่มีรายการ

    doHistory.unshift({
      id: header.id, doNo, date: header.do_date, type: typ, customer: custVal, customerAddress: custAddr,
      salesperson: salesVal, machine: machineVal, headerText,
      items: (insertedItems || doItems).map(i => ({
        id: i.id, name: i.item_name ?? i.name, code: i.item_code ?? i.code, category: i.item_category ?? i.category,
        sn: i.sn != null ? String(i.sn) : null, qty: i.qty ?? null,
        unitPrice: i.unit_price ?? priceByName[i.item_name ?? i.name]?.price ?? null,
        amount: i.amount ?? priceByName[i.item_name ?? i.name]?.amount ?? null,
      })),
      createdAt: header.created_at, createdBy: currentUserId,
    });
    updateDOBadge();

    const saveBtn = document.getElementById('do-save-btn');
    saveBtn.textContent = '✅ บันทึกแล้ว';
    saveBtn.style.background = '#2dd4a0';
    toast(`บันทึกใบ DO: ${doNo} สำเร็จ`, 'success');
    setTimeout(() => { saveBtn.textContent = '💾 บันทึก DO'; saveBtn.style.background = '#22d3ee'; }, 3000);
    if (doFromLiveSession) { outSession = []; sessionDispatchTime = null; persistOutSession(); renderOutSession(); }
    // ใบนี้มาจากคิวอะไหล่ — แถวขายผูกกับใบนี้แล้ว (จองไว้ข้างบน) เอาออกจากคิวบนจอ
    if (pendingPartsDOBatch) {
      const doneIds = new Set(saleIds.map(String));
      partsDOQueue = partsDOQueue.filter(q => !doneIds.has(String(q.id)));
      pendingPartsDOBatch = null;
      renderPartsDOQueue();
    }
  } catch (err) { await releaseClaims(); toast('บันทึก DO ล้มเหลว: ' + err.message, 'error'); }
}

function closeDOModal() { document.getElementById('do-modal').classList.remove('open'); }
function gatherDOData() {
  const g = id => document.getElementById(id);
  return {
    cust:  g('do-cust').value || '',
    addr:  g('do-cust-addr') ? g('do-cust-addr').innerText : '',
    no:    g('do-no').value || '',
    staff: g('do-salesperson').value || '',
    po:    g('do-machine').value || '',
    date:  g('do-date').value || '',
    // innerText เหมือนตอนบันทึกจริง (saveDO/saveDODocEdits) — ถ้าใช้ innerHTML ตรงนี้
    // จะได้ค่าที่เบราว์เซอร์ encode เอนทิตี้ไว้แล้วรอบหนึ่ง พอ escapeHtml() ซ้ำจะกลายเป็น encode ซ้อน 2 ชั้น
    note:  g('do-header-text').innerText || '',
    items: g('do-items').innerHTML || '',
    total: g('do-total') ? g('do-total').textContent : fmtMoney(0),
    vat:   g('do-vat') ? g('do-vat').textContent : fmtMoney(0),
    grand: g('do-grand') ? g('do-grand').textContent : fmtMoney(0),
  };
}

// สร้าง HTML ของใบ DO 1 ฉบับ (label = 'ต้นฉบับ' หรือ 'สำเนา') จากข้อมูลปัจจุบัน
function doDocHTML(label, d) {
  return `<table class="do-page"><thead><tr><td>
      <div class="do-lh">
        <div class="do-lh-logo"><img src="logo.png" alt="SGDATAPOS"></div>
        <div class="do-lh-info">
          SGDATAPOS (Thailand) Co. Ltd (Head Office)<br>
          113/30 M.1 A. Muang, Chonburi 20000 Thailand<br>
          เอสจี.ดาต้า.พอส. (ไทยแลนด์) จำกัด (สำนักงานใหญ่)<br>
          113/30 หมู่ 1 ต.อ่างศิลา อ.เมือง จ.ชลบุรี 20000<br>
          โทร. (66) 0802493954
        </div>
      </div>
      <div class="do-taxid">หมายเลขประจำตัวผู้เสียภาษีอากร &nbsp;&nbsp; TAX ID 0205561043127</div>
      <div class="do-doc-title"><div>${label}</div><div>ใบส่งสินค้า</div></div>
    </td></tr></thead><tbody><tr><td>
      <table class="do-page-info"><thead><tr><td>
      <div class="do-info">
        <div class="do-to">
          <div style="font-weight:600">TO :</div>
          <div class="do-to-body"><div>${escapeHtml(d.cust)}</div><div class="do-addr">${escapeHtml(d.addr)}</div></div>
        </div>
        <div class="do-meta">
          <div class="do-meta-k"><div>No.</div><div>Staff:</div><div>PO Number:</div><div>Date Issued:</div></div>
          <div class="do-meta-v"><div>${escapeHtml(d.no)}</div><div>${escapeHtml(d.staff)}</div><div>${escapeHtml(d.po)}</div><div>${escapeHtml(d.date)}</div></div>
        </div>
      </div>
      </td></tr></thead><tbody><tr><td>
      <table class="do-items-tbl">
        <thead><tr>
          <th style="width:58px"><span class="th-th">รหัสสินค้า</span><span class="th-en">Product No.</span></th>
          <th><span class="th-th">รายการสินค้า</span><span class="th-en">Product Description</span></th>
          <th style="width:52px"><span class="th-th">จำนวน</span><span class="th-en">Qty</span></th>
          <th style="width:78px"><span class="th-th">หน่วยละ</span><span class="th-en">Unit Price</span></th>
          <th style="width:96px"><span class="th-th">จำนวนเงิน</span><span class="th-en">Amount</span></th>
        </tr></thead>
        <tbody>${d.items}</tbody>
        <tfoot><tr><td colspan="5"></td></tr></tfoot>
      </table>
      <table class="do-totals"><tbody>
        <tr><td class="do-totals-pad" rowspan="3"></td><td class="k">Sub-Total</td><td class="v">${d.total}</td></tr>
        <tr><td class="k">VAT 7%</td><td class="v">${d.vat}</td></tr>
        <tr><td class="k">Total</td><td class="v">${d.grand}</td></tr>
      </tbody></table>
      ${d.note && d.note.trim() ? `<div class="do-note">หมายเหตุ: <span>${escapeHtml(d.note)}</span></div>` : ''}
      <div class="do-received">ข้าพเจ้าได้รับสินค้าข้างต้นจำนวนถูกต้องและสภาพเรียบร้อย &nbsp;/ Received the above goods in good order &amp; condition</div>
      <table class="do-sign"><tbody><tr>
        <td><div class="sig-line"></div>ผู้อนุมัติ / Approver<br><span class="d">วันที่</span></td>
        <td><div class="sig-line"></div>ผู้รับสินค้า / Receiver<br><span class="d">วันที่</span></td>
      </tr></tbody></table>
      </td></tr></tbody></table>
    </td></tr></tbody>
    <tfoot><tr><td class="do-page-foot"></td></tr></tfoot>
    </table>`;
}

// พิมพ์ 2 ฉบับ: ต้นฉบับ + สำเนา (คนละหน้า) แล้วคืนสภาพช่องแก้ไขเดิม
function printDO() {
  const pa = document.getElementById('printArea');
  pa.querySelectorAll('input').forEach(i => i.setAttribute('value', i.value)); // เก็บค่าที่พิมพ์ไว้ใน attribute
  const saved = pa.innerHTML;
  const d = gatherDOData();
  // ห่อแต่ละฉบับด้วย .do-sheet เพื่อให้ระยะขอบกระดาษอยู่ที่ "ใบ" ไม่ใช่กล่องรวม (หัวจดหมายจะได้สูงเท่ากันทุกแผ่น)
  pa.innerHTML = `<div class="do-sheet">${doDocHTML('ต้นฉบับ', d)}</div>`
               + `<div class="do-sheet do-copy2">${doDocHTML('สำเนา', d)}</div>`;
  window.print();
  pa.innerHTML = saved; // คืนฟอร์มที่แก้ไขได้ (window.print บล็อกจนปิด dialog)
}

function renderDOHistory() {
  // ตัดช่องว่างหน้า/หลังก่อนค้น — ไม่งั้นแปะเลข SN ที่ติดช่องว่างมาจะหาไม่เจอทั้งที่มีอยู่
  const q  = (document.getElementById('doh-q').value || '').trim().toLowerCase();
  const ft = document.getElementById('doh-type').value;
  let data = [...doHistory];
  if (ft) data = data.filter(d => d.type === ft);
  if (q) data = data.filter(d =>
    d.doNo.toLowerCase().includes(q) ||
    d.customer.toLowerCase().includes(q) ||
    (d.items||[]).some(i => i.name.toLowerCase().includes(q) || String(i.sn).toLowerCase().includes(q))
  );

  const totalItems = doHistory.reduce((s, d) => s + (d.items||[]).length, 0);
  const uniqueCusts = new Set(doHistory.map(d => d.customer)).size;
  document.getElementById('doh-total').textContent = doHistory.length;
  document.getElementById('doh-items').textContent = totalItems;
  document.getElementById('doh-custs').textContent = uniqueCusts;
  document.getElementById('doh-count').textContent = data.length;

  // ใบที่ติ๊กไว้แล้วหายไปจากตัวกรอง ให้ถือว่าไม่ได้เลือก จะได้ไม่รวมใบที่มองไม่เห็นติดไปด้วย
  const shown = new Set(data.map(d => d.id));
  [...selectedDOIds].forEach(id => { if (!shown.has(id)) selectedDOIds.delete(id); });
  updateDOMergeBtn();

  const tbody = document.getElementById('do-history-tbody');
  if (!data.length) { tbody.innerHTML = `<tr><td colspan="8" class="tbl-empty">${t('ยังไม่มีประวัติใบ DO')}</td></tr>`; return; }
  tbody.innerHTML = data.map(d => `
    <tr class="do-row" onclick="reopenDOForPrint('${d.id}')">
      <td style="text-align:center">${currentRole === 'admin' ? `<input type="checkbox" onclick="event.stopPropagation()" onchange="toggleDOSelect('${d.id}',this)" ${selectedDOIds.has(d.id) ? 'checked' : ''} title="เลือกไว้เพื่อรวมกับใบอื่น">` : ''}</td>
      <td><span style="font-family:var(--mono);font-size:12px;font-weight:700;color:var(--blue)">${escapeHtml(d.doNo)}</span></td>
      <td class="mono" style="font-size:11px">${fmtDate(doDateOf(d))}</td>
      <td>${doTypeBadge(d.type)}</td>
      <td style="color:var(--t1);font-weight:500">${escapeHtml(d.customer)}</td>
      <td style="text-align:center"><span class="do-summary-chip">${(d.items||[]).length} ชิ้น</span></td>
      <td style="font-size:11px;color:var(--t3)">${escapeHtml(userName(d.createdBy))}</td>
      <td style="text-align:center">
        <div style="display:flex;gap:4px;justify-content:center">
          <button onclick="event.stopPropagation();reopenDOForPrint('${d.id}')" class="btn btn-ghost btn-icon btn-sm" title="เปิดใบ (แก้ไข/พิมพ์)">${icon('eye')}</button>
          <button onclick="event.stopPropagation();reopenDOForPrint('${d.id}')" class="btn btn-primary btn-icon btn-sm">${icon('print')}</button>
          ${currentRole === 'admin' ? `<button onclick="event.stopPropagation();deleteDO('${d.id}')" class="btn btn-red btn-icon btn-sm">${icon('trash')}</button>` : ''}
        </div>
      </td>
    </tr>`).join('');
}

// ── รวมใบ DO หลายใบเข้าเป็นใบเดียว (ติ๊กเลือกเอง) ──
function toggleDOSelect(id, el) {
  if (el.checked) selectedDOIds.add(id); else selectedDOIds.delete(id);
  updateDOMergeBtn();
}

function updateDOMergeBtn() {
  const btn = document.getElementById('doh-merge-btn'); if (!btn) return;
  const n = selectedDOIds.size;
  btn.style.display = n >= 2 ? 'inline-flex' : 'none';
  btn.textContent = `🔗 รวม ${n} ใบเป็นใบเดียว`;
}

async function mergeSelectedDOs() {
  if (currentRole !== 'admin') return toast('เฉพาะแอดมินเท่านั้นที่รวมใบ DO ได้', 'error');
  const picked = doHistory.filter(d => selectedDOIds.has(d.id));
  if (picked.length < 2) return toast('ติ๊กเลือกอย่างน้อย 2 ใบ', 'error');

  // ใบที่ออกก่อนสุดคือใบที่เก็บไว้ — เลือกแบบนี้เพื่อให้ผลลัพธ์เดาได้ ไม่ขึ้นกับลำดับที่ติ๊ก
  picked.sort((a, b) => (doDateOf(a) + a.doNo).localeCompare(doDateOf(b) + b.doNo));
  const keep = picked[0], drop = picked.slice(1);
  const custs = [...new Set(picked.map(d => normCustName(d.customer)))];

  let msg = `รวม ${picked.length} ใบเข้าเป็นใบ ${keep.doNo}\n\n`
          + picked.map(d => `${d.id === keep.id ? '📌 เก็บไว้' : '🗑 ลบ'}  ${d.doNo} (${(d.items || []).length} ชิ้น)`).join('\n')
          + `\n\nรายการสินค้าทั้งหมดจะย้ายมาอยู่ในใบ ${keep.doNo}`;
  if (custs.length > 1) msg += `\n\n⚠️ ใบที่เลือกเป็นของลูกค้าคนละเจ้า — ใบที่รวมแล้วจะใช้ชื่อ "${keep.customer}"`;
  if (!confirm(msg + '\n\nยืนยัน? (กู้คืนไม่ได้)')) return;

  const btn = document.getElementById('doh-merge-btn');
  btn.disabled = true;
  try {
    for (const d of drop) {
      const had = (d.items || []).length;
      const { data, error } = await supaClient.from('do_items')
        .update({ do_header_id: keep.id }).eq('do_header_id', d.id).select('id');
      if (error) throw error;
      if (had && (!data || !data.length)) throw new Error('ไม่มีสิทธิ์ย้ายรายการสินค้า (ยังไม่ได้ตั้ง update policy ให้ do_items)');

      // แถวขายอะไหล่ที่ผูกกับใบที่ถูกรวม ต้องย้ายไปผูกกับใบที่เก็บไว้ด้วย ไม่งั้นหลุดกลับเข้าคิวเหมือนยังไม่ได้ออกใบ
      if (!partSaleSchemaMissing && (d.items || []).some(i => i.sn == null)) {
        const { error: pErr } = await supaClient.from('part_moves').update({ do_header_id: keep.id }).eq('do_header_id', d.id).select('id');
        if (pErr) throw pErr;
      }

      const { error: dErr } = await supaClient.from('do_headers').delete().eq('id', d.id);
      if (dErr) throw dErr;

      if (!keep.items) keep.items = [];
      keep.items.push(...(d.items || []));
      doHistory = doHistory.filter(x => x.id !== d.id);
    }

    // จำนวนเงินเก็บเป็นยอดรวมของทั้งกลุ่มสินค้า — กลุ่มมีของมากขึ้นต้องคิดใหม่
    // รายการจากอะไหล่ (ไม่มี SN) 1 แถว อาจแทนหลายชิ้นผ่าน .qty — นับจำนวนจริง ไม่ใช่แค่จำนวนแถว
    for (const name of [...new Set(keep.items.map(i => i.name))]) {
      const rows = keep.items.filter(i => i.name === name);
      const price = rows.find(i => i.unitPrice != null)?.unitPrice;
      if (price == null) continue;
      const totalQty = rows.reduce((s, r) => s + (r.qty ?? 1), 0);
      const amount = Math.round(Number(price) * totalQty * 100) / 100;
      const { error } = await supaClient.from('do_items')
        .update({ unit_price: price, amount }).eq('do_header_id', keep.id).eq('item_name', name).select('id');
      if (error) throw error;
      rows.forEach(i => { i.unitPrice = price; i.amount = amount; });
    }

    // จดไว้บนใบว่ารวมมาจากใบไหนบ้าง กันงงตอนย้อนดูทีหลัง
    const note = `(รวมจากใบ ${drop.map(d => d.doNo).join(', ')})`;
    keep.headerText = keep.headerText ? `${keep.headerText} ${note}` : note;
    await supaClient.from('do_headers').update({ header_text: keep.headerText }).eq('id', keep.id).select('id');

    selectedDOIds.clear();
    renderDOHistory(); updateDOBadge();
    toast(`รวม ${picked.length} ใบเข้าเป็นใบ ${keep.doNo} แล้ว (${keep.items.length} ชิ้น)`, 'success');
  } catch (err) {
    toast('รวมใบล้มเหลว: ' + err.message, 'error');
    renderDOHistory();
  } finally { btn.disabled = false; }
}

// หน้าสรุป — เหลือไว้สำหรับ 2 อย่างที่ไม่ได้พิมพ์บนใบ: ประเภทใบ และ เพิ่ม/ถอดรายการสินค้า
// (ข้อมูลบนหัวใบกับราคา แก้บนหน้ากระดาษได้ตรงๆ แล้ว)
function openDOView(id) {
  const d = doHistory.find(x => x.id === id); if (!d) return;
  currentViewDOId = id;
  closeModal('do-modal');
  document.getElementById('dov-no').textContent = 'เลขที่: ' + d.doNo;
  document.getElementById('dov-no2').value = d.doNo;
  document.getElementById('dov-date').textContent = fmtDate(d.createdAt) + ' ' + new Date(d.createdAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  document.getElementById('dov-date-edit').value = doDateOf(d);
  document.getElementById('dov-type').value = d.type || 'โอนสินค้า';
  document.getElementById('dov-cust').value = d.customer || '';
  document.getElementById('dov-addr').value = d.customerAddress || '';
  document.getElementById('dov-user').textContent = userName(d.createdBy);
  document.getElementById('dov-sales').value = d.salesperson || '';
  document.getElementById('dov-po').value = d.machine || '';
  document.getElementById('dov-note').value = d.headerText || '';

  // จัดกลุ่มตามสินค้า (เหมือนในใบพิมพ์) — แก้ราคาต่อกลุ่ม ไม่ใช่ต่อ SN
  dovGroups = Object.values(groupDOItems(d.items));
  dovGroups.forEach(g => g.sns.sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true })));

  document.getElementById('dov-summary').innerHTML = dovGroups.map(g => `
    <div style="display:flex;justify-content:space-between;font-size:12px">
      <span style="color:var(--t2)">${escapeHtml(g.name)}</span>
      <span style="font-family:var(--mono);font-weight:700;color:var(--blue)">${g.qty} ชิ้น</span>
    </div>`).join('');

  document.getElementById('dov-item-count').textContent = dovGroups.reduce((s, g) => s + g.qty, 0);
  document.getElementById('dov-items-tbody').innerHTML = dovGroups.map((g, gi) => {
    const priceVal = g.unitPrice != null ? Number(g.unitPrice).toFixed(2) : '';
    const amtVal = g.amount != null ? Number(g.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';
    const modelLine = (g.code && g.code !== '-') ? `<div class="code-cell" style="margin-top:2px">${escapeHtml(g.code)}</div>` : '';
    // ส่วนที่ไม่มี SN (มาจากอะไหล่) ถอดออกทีละชิ้นไม่ได้ — มีแค่ป้ายบอกจำนวน ไม่มีปุ่ม ✕
    const noSn = g.noSnQty ? `<span class="dov-sn" style="opacity:.7">(${t('ไม่มี SN')} — ${g.noSnQty} ${t('ชิ้น')})</span>` : '';
    return `<tr data-gi="${gi}">
      <td style="text-align:center;font-size:11px;color:var(--t3)">${gi+1}</td>
      <td style="color:var(--t1)"><b>${escapeHtml(g.name)}</b>${modelLine}<div class="dov-sn-wrap">${g.sns.map(sn => `<span class="dov-sn">${escapeHtml(sn)}${currentRole === 'admin' ? `<button onclick="removeItemFromDO(${jsArg(sn)})" title="ถอด SN นี้ออกจากใบ">✕</button>` : ''}</span>`).join('')}${noSn}</div></td>
      <td style="text-align:center;font-family:var(--mono);color:var(--orange);font-weight:700">${g.qty}</td>
      <td><input type="text" style="text-align:right;font-family:var(--mono);font-size:12px" data-role="price" inputmode="decimal" value="${priceVal}" oninput="calcDOViewAmount(${gi},this)"></td>
      <td><input type="text" style="text-align:right;font-family:var(--mono);font-size:12px" data-role="amount" inputmode="decimal" value="${amtVal}" oninput="recalcDOViewTotals()"></td>
    </tr>`;
  }).join('');
  recalcDOViewTotals();
  document.getElementById('do-view-modal').classList.add('open');
}

// ใส่ราคาต่อหน่วยในหน้าประวัติ → คำนวณจำนวนเงินให้ (แก้ทับเองได้)
function calcDOViewAmount(gi, inp) {
  const tr = inp.closest('tr'); if (!tr) return;
  const amt = tr.querySelector('input[data-role="amount"]'); if (!amt) return;
  const g = dovGroups[gi]; if (!g) return;
  const price = parseFloat(String(inp.value).replace(/,/g, ''));
  if (!isFinite(price)) amt.value = '';
  else amt.value = (g.qty * price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  recalcDOViewTotals();
}

function recalcDOViewTotals() {
  let total = 0;
  document.querySelectorAll('#dov-items-tbody input[data-role="amount"]').forEach(el => {
    const v = parseFloat(String(el.value).replace(/,/g, ''));
    if (isFinite(v)) total += v;
  });
  const vat = Math.round(total * DO_VAT_RATE) / 100;
  const grand = Math.round((total + vat) * 100) / 100;
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('dov-total', fmtMoney(total));
  set('dov-vat', fmtMoney(vat));
  set('dov-grand', fmtMoney(grand));
}

// บันทึกการแก้ไขใบ DO ย้อนหลัง: ข้อมูลหัวใบ + ราคาต่อหน่วย/จำนวนเงินของแต่ละกลุ่มสินค้า
async function saveDOViewPrices() {
  if (!currentViewDOId) return;
  const doNo = document.getElementById('dov-no2').value.trim();
  const cust = document.getElementById('dov-cust').value.trim();
  if (!doNo) return toast('กรุณาระบุเลขที่ DO', 'error');
  if (!cust) return toast('กรุณาระบุชื่อลูกค้า', 'error');
  const headerPayload = {
    do_no: doNo,
    do_date: document.getElementById('dov-date-edit').value || doDateOf(doHistory.find(x => x.id === currentViewDOId) || {}),
    type: document.getElementById('dov-type').value,
    customer_name: cust,
    customer_address: document.getElementById('dov-addr').value.trim(),
    salesperson: document.getElementById('dov-sales').value.trim(),
    machine: document.getElementById('dov-po').value.trim(),
    header_text: document.getElementById('dov-note').value,
  };

  const rows = [...document.querySelectorAll('#dov-items-tbody tr[data-gi]')];
  try {
    // ── หัวใบ ──
    const { data: hData, error: hErr } = await supaClient.from('do_headers')
      .update(headerPayload).eq('id', currentViewDOId).select('id');
    if (hErr) {
      if (hErr.code === '23505') return toast(`เลขที่ DO: ${doNo} มีในระบบแล้ว`, 'error');
      throw hErr;
    }
    if (!hData || !hData.length) throw new Error('ไม่มีสิทธิ์แก้ไขหัวใบ DO (ยังไม่ได้ตั้ง update policy ให้ do_headers ใน Supabase)');

    // ── ราคาแต่ละกลุ่มสินค้า ──
    for (const tr of rows) {
      const gi = Number(tr.dataset.gi);
      const g = dovGroups[gi]; if (!g || !g.ids.length) continue;
      const priceInp = tr.querySelector('input[data-role="price"]');
      const amtInp = tr.querySelector('input[data-role="amount"]');
      const price = priceInp.value !== '' ? parseFloat(String(priceInp.value).replace(/,/g, '')) : null;
      const amount = amtInp.value !== '' ? parseFloat(String(amtInp.value).replace(/,/g, '')) : null;
      g.unitPrice = isFinite(price) ? price : null;
      g.amount = isFinite(amount) ? amount : null;
      const { data, error } = await supaClient.from('do_items')
        .update({ unit_price: g.unitPrice, amount: g.amount }).in('id', g.ids).select('id');
      if (error) throw error;
      // RLS ที่ไม่มี policy สำหรับ update จะคืน 200 พร้อม 0 แถว โดยไม่แจ้ง error — ต้องเช็คเอง
      if (!data || !data.length) throw new Error('ไม่มีสิทธิ์แก้ไขราคา (ยังไม่ได้ตั้ง update policy ให้ do_items ใน Supabase)');
    }
    // อัปเดตแคชในเครื่องให้ตรงกับที่บันทึกไป
    const d = doHistory.find(x => x.id === currentViewDOId);
    if (d) {
      d.doNo = doNo; d.type = headerPayload.type; d.customer = cust; d.date = headerPayload.do_date;
      d.customerAddress = headerPayload.customer_address;
      d.salesperson = headerPayload.salesperson; d.machine = headerPayload.machine;
      d.headerText = headerPayload.header_text;
      dovGroups.forEach(g => {
        (d.items || []).forEach(item => { if (item.name === g.name) { item.unitPrice = g.unitPrice; item.amount = g.amount; } });
      });
    }
    document.getElementById('dov-no').textContent = 'เลขที่: ' + doNo;
    renderDOHistory();
    toast('บันทึกการแก้ไขสำเร็จ', 'success');
  } catch (err) { toast('บันทึกล้มเหลว: ' + err.message, 'error'); }
}

// ── ถอดสินค้าออกจากใบ DO (ใส่ผิดชิ้น) พร้อมคืนของเข้าคลังให้ ──
async function removeItemFromDO(sn) {
  if (!currentViewDOId) return;
  const d = doHistory.find(x => x.id === currentViewDOId); if (!d) return;
  const row = (d.items || []).find(i => String(i.sn) === String(sn));
  if (!row) return toast('ไม่พบ SN นี้ในใบ', 'error');
  const item = stock.find(i => String(i.sn) === String(sn));
  const willReturn = item && item.status === 'Sold';

  if (!confirm(`ถอด SN: ${sn} ออกจากใบ ${d.doNo}?` +
    (willReturn ? `\n\nสินค้าชิ้นนี้จะถูกคืนเข้าคลังเป็น "พร้อมใช้"` : ''))) return;

  try {
    // ลบแถวในใบ — do_items ให้ลบได้เฉพาะแอดมิน ถ้าไม่มีสิทธิ์ RLS จะคืน 0 แถวโดยไม่แจ้ง error
    const del = supaClient.from('do_items').delete();
    const { data, error } = row.id != null
      ? await del.eq('id', row.id).select('id')
      : await del.eq('do_header_id', d.id).eq('sn', String(sn)).select('id');
    if (error) throw error;
    if (!data || !data.length) throw new Error('ไม่มีสิทธิ์ถอดรายการออกจากใบ (เฉพาะแอดมิน)');

    if (willReturn) {
      const back = { status: 'Available', dispatched_at: null, dispatched_to: null };
      const won = await updateInventoryIf(item.id, back, [['status', 'eq', 'Sold']]);
      if (!won.size) toast('ถอดออกจากใบแล้ว แต่ของไม่ได้คืนเข้าคลัง — มีคนอื่นย้ายไปก่อน', 'warning');
      else Object.assign(item, back);
      await logTransaction(today(), '♻️ คืนสต็อก', item.name, item.code, sn, getBalance(item.code), `ถอดออกจากใบ ${d.doNo}`);
    }

    d.items = d.items.filter(i => String(i.sn) !== String(sn));
    // จำนวนเงินเก็บเป็นยอดรวมของทั้งกลุ่ม — กลุ่มมีของน้อยลง ต้องคิดใหม่
    const left = d.items.filter(i => i.name === row.name);
    if (row.unitPrice != null && left.length) {
      const amount = Math.round(Number(row.unitPrice) * left.length * 100) / 100;
      const { error: aErr } = await supaClient.from('do_items')
        .update({ amount }).eq('do_header_id', d.id).eq('item_name', row.name);
      if (aErr) throw aErr;
      left.forEach(i => { i.amount = amount; });
    }

    openDOView(currentViewDOId);
    renderDOHistory(); filterStock(); renderOutboundHistory(); checkAlerts();
    toast(willReturn ? `ถอด SN: ${sn} ออกจากใบ และคืนเข้าคลังแล้ว` : `ถอด SN: ${sn} ออกจากใบแล้ว`, 'success');
  } catch (err) { toast('ถอดรายการล้มเหลว: ' + err.message, 'error'); }
}

// ── เพิ่มสินค้าเข้าใบ DO ที่ออกไปแล้ว (ตอนสร้างใบใส่ไม่ครบ) พร้อมตัดสต็อกให้ตรงนั้นเลย ──
async function addItemsToDO() {
  if (!currentViewDOId) return;
  const d = doHistory.find(x => x.id === currentViewDOId); if (!d) return;

  const raw = document.getElementById('dov-add-sn').value || '';
  const list = [...new Set(raw.split(/[\s,]+/).map(s => s.trim().replace(/^\*+|\*+$/g, '')).filter(Boolean))];
  if (!list.length) return inlineMsg('dov-add-msg', '❌ กรุณายิงบาร์โค้ดหรือวางรายการ SN ก่อน', false);

  let toAdd = [];               // ตัดตัวที่คนอื่นชิงไปก่อนออกทีหลัง จึงต้องเป็น let
  const notFound = [], notAvail = [];
  list.forEach(sn => {
    const item = stock.find(i => String(i.sn) === sn && i.status === 'Available');
    if (item) toAdd.push(item);
    else if (stock.find(i => String(i.sn) === sn)) notAvail.push(sn);
    else notFound.push(sn);
  });
  if (!toAdd.length) return inlineMsg('dov-add-msg', `❌ ไม่มี SN ที่เพิ่มได้ (ไม่พบ ${notFound.length}, ตัดไปแล้ว/ไม่พร้อม ${notAvail.length})`, false);
  if (!confirm(`เพิ่ม ${toAdd.length} รายการเข้าใบ ${d.doNo}\nและตัดสต็อกทันที?`)) return;

  // วันที่จ่ายออก = วันที่กดเพิ่มจริง ไม่ใช่วันของใบเดิม
  // เดิมยัดให้เป็นชุดเดียวกับของเดิมในใบ ของที่เพิ่มวันนี้เลยไปโผล่ใต้วันเก่า หาไม่เจอตอนกรองตามวันที่
  const batchAt = nowISO();
  // ราคาต่อหน่วยของสินค้าชื่อเดียวกันที่มีอยู่แล้วในใบ — ของใหม่ใช้ราคาเดียวกัน
  const priceByName = {};
  (d.items || []).forEach(i => { if (i.unitPrice != null && priceByName[i.name] == null) priceByName[i.name] = Number(i.unitPrice); });

  try {
    // ตัดได้เฉพาะของที่ยังว่างอยู่จริง ตัวที่คนอื่นชิงไปก่อนต้องไม่ขึ้นใบ
    const wonAdd = await updateInventoryIf(toAdd.map(i => i.id), { status: 'Sold', dispatched_at: batchAt },
                                            [['status', 'eq', 'Available']]);
    const lostAdd = toAdd.filter(i => !wonAdd.has(i.id));
    toAdd = toAdd.filter(i => wonAdd.has(i.id));
    if (!toAdd.length) return inlineMsg('dov-add-msg', raceMsg(`เพิ่มไม่สำเร็จทั้ง ${lostAdd.length} รายการ`), false);
    if (lostAdd.length) toast(`⚠️ ข้าม ${lostAdd.length} รายการ มีคนตัดไปก่อน: ${lostAdd.map(i => i.sn).join(', ')}`, 'warning');

    const { data: inserted, error: iErr } = await supaClient.from('do_items').insert(
      toAdd.map(i => ({
        do_header_id: d.id, item_name: i.name, item_code: i.code, item_category: i.category,
        sn: String(i.sn), unit_price: priceByName[i.name] ?? null, amount: null,
      }))
    ).select();
    if (iErr) throw iErr;

    toAdd.forEach(i => {
      i.status = 'Sold'; i.dispatched_at = batchAt; i.dispatched_to = d.customer;
    });
    recordDispatchTo(toAdd.map(i => i.id), d.customer);
    if (!d.items) d.items = [];
    (inserted || []).forEach(r => d.items.push({
      id: r.id, name: r.item_name, code: r.item_code, category: r.item_category,
      sn: String(r.sn), unitPrice: r.unit_price, amount: r.amount,
    }));

    // จำนวนเงินเก็บเป็นยอดรวมของทั้งกลุ่ม — พอกลุ่มมีของเพิ่ม ต้องคิดใหม่ทั้งกลุ่ม
    for (const name of [...new Set(toAdd.map(i => i.name))]) {
      const price = priceByName[name];
      if (price == null) continue;
      const amount = Math.round(price * d.items.filter(i => i.name === name).length * 100) / 100;
      const { error } = await supaClient.from('do_items')
        .update({ amount }).eq('do_header_id', d.id).eq('item_name', name).select('id');
      if (error) throw error;
      d.items.forEach(i => { if (i.name === name) i.amount = amount; });
    }

    for (const i of toAdd) {
      await logTransaction(today(), d.type || 'โอนสินค้า', i.name, i.code, i.sn, getBalance(i.code),
                           `→ ${d.customer} (เพิ่มเข้าใบ ${d.doNo})`);
    }

    document.getElementById('dov-add-sn').value = '';
    openDOView(currentViewDOId);   // โหลดใบใหม่ให้เห็นรายการ/ยอดที่เพิ่งเพิ่ม
    renderDOHistory(); filterStock(); renderOutboundHistory(); checkAlerts();
    let msg = `✅ เพิ่ม ${toAdd.length} รายการเข้าใบ ${d.doNo} และตัดสต็อกแล้ว`;
    if (notFound.length || notAvail.length) msg += `  (ข้าม: ไม่พบ ${notFound.length}, ไม่พร้อม ${notAvail.length})`;
    inlineMsg('dov-add-msg', msg, true);
    toast(`เพิ่ม ${toAdd.length} รายการเข้าใบ ${d.doNo} สำเร็จ`, 'success');
  } catch (err) {
    inlineMsg('dov-add-msg', '❌ เพิ่มไม่สำเร็จ: ' + err.message, false);
    toast('เพิ่มรายการล้มเหลว: ' + err.message, 'error');
  }
}

// ── เปิดใบเก่ามาดู/พิมพ์ — แก้ได้ทั้งใบตรงหน้ากระดาษเลย ไม่ต้องกลับไปแก้ในฟอร์มแยก ──
// เปิดมาล็อกไว้ก่อนกันพิมพ์ทับใบที่ส่งไปแล้วโดยไม่ตั้งใจ ต้องกด "แก้ไขใบนี้" ก่อนถึงพิมพ์ทับได้
const DO_DOC_FIELDS = ['do-no', 'do-cust', 'do-salesperson', 'do-machine', 'do-date'];

function setDODocEditable(on) {
  DO_DOC_FIELDS.forEach(id => { document.getElementById(id).readOnly = !on; });
  document.getElementById('do-header-text').contentEditable = on ? 'true' : 'false';
  const addr = document.getElementById('do-cust-addr');
  if (addr) addr.contentEditable = on ? 'true' : 'false';
  // ช่องราคา/จำนวนเงินก็ล็อกด้วย เดิมพิมพ์ได้ทั้งที่ไม่มีปุ่มบันทึก พิมพ์ไปก็หาย
  document.querySelectorAll('#printArea .do-num').forEach(el => { el.readOnly = !on; });
  document.getElementById('do-edit-btn').style.display = on ? 'none' : 'inline-flex';
  document.getElementById('do-update-btn').style.display = on ? 'inline-flex' : 'none';
  // ประเภทใบ กับ เพิ่ม/ถอดรายการ ไม่มีที่บนกระดาษ เลยยังต้องเข้าไปทำในหน้าสรุป
  document.getElementById('do-manage-btn').style.display = on ? 'none' : 'inline-flex';
  document.getElementById('do-modal-hint').textContent = on
    ? 'แก้ได้ทุกช่องบนใบ แล้วกด "บันทึกการแก้ไข"'
    : 'กด "แก้ไขใบนี้" เพื่อพิมพ์ทับข้อมูลบนใบ';
}

function reopenDOForPrint(id) {
  const d = doHistory.find(x => x.id === id); if (!d) return;
  currentViewDOId = id;
  closeModal('do-view-modal'); doModalMode = 'view';
  document.getElementById('do-modal-badge').style.display = 'inline';
  document.getElementById('do-save-btn').style.display = 'none';
  document.getElementById('do-header-text').innerText = d.headerText || '';
  document.getElementById('do-no').value = d.doNo;
  document.getElementById('do-cust').value = d.customer;
  document.getElementById('do-salesperson').value = d.salesperson || '';
  document.getElementById('do-machine').value = d.machine || '';
  document.getElementById('do-date').value = fmtDODate(doDateOf(d));
  const addr = document.getElementById('do-cust-addr'); if (addr) addr.textContent = d.customerAddress || '';

  const grp = groupDOItems(d.items);
  document.getElementById('do-items').innerHTML = Object.entries(grp).map(([name, v], i) => doItemRow(name, v, i)).join('');
  recalcDOTotals();
  setDODocEditable(false);
  document.getElementById('do-modal').classList.add('open');
}

// บันทึกสิ่งที่พิมพ์ทับบนหน้ากระดาษกลับเข้าฐานข้อมูล (หัวใบ + ราคาแต่ละรายการ)
async function saveDODocEdits() {
  if (!currentViewDOId) return;
  const d = doHistory.find(x => x.id === currentViewDOId);
  if (!d) return toast('ไม่พบใบนี้ในประวัติ', 'error');
  const doNo = document.getElementById('do-no').value.trim();
  const cust = document.getElementById('do-cust').value.trim();
  if (!doNo) return toast('กรุณาระบุเลขที่ DO', 'error');
  if (!cust) return toast('กรุณาระบุชื่อลูกค้า', 'error');
  const editedDate = parseDODate(document.getElementById('do-date').value);
  if (!editedDate) return toast('อ่านวันที่บนใบไม่ออก — ใช้แบบ 24/07/2569 หรือ 24-Jul-2026', 'error');

  const headerPayload = {
    do_no: doNo,
    do_date: editedDate,
    customer_name: cust,
    customer_address: document.getElementById('do-cust-addr')?.innerText.trim() || '',
    salesperson: document.getElementById('do-salesperson').value.trim(),
    machine: document.getElementById('do-machine').value.trim(),
    header_text: document.getElementById('do-header-text').innerText,
  };

  const btn = document.getElementById('do-update-btn');
  btn.disabled = true;
  try {
    const { data: hData, error: hErr } = await supaClient.from('do_headers')
      .update(headerPayload).eq('id', currentViewDOId).select('id');
    if (hErr) {
      if (hErr.code === '23505') return toast(`เลขที่ DO: ${doNo} มีในระบบแล้ว`, 'error');
      throw hErr;
    }
    if (!hData || !hData.length) throw new Error('ไม่มีสิทธิ์แก้ไขหัวใบ DO (ยังไม่ได้ตั้ง update policy ให้ do_headers)');

    // ราคาต่อหน่วย/จำนวนเงิน — เก็บเป็นยอดของทั้งกลุ่มสินค้า เหมือนตอนสร้างใบ
    for (const tr of document.querySelectorAll('#do-items tr[data-name]')) {
      const name = tr.dataset.name;
      const num = sel => { const el = tr.querySelector(`input[data-role="${sel}"]`);
        const v = el && el.value !== '' ? parseFloat(String(el.value).replace(/,/g, '')) : null;
        return isFinite(v) ? v : null; };
      const unit_price = num('price'), amount = num('amount');
      const { error } = await supaClient.from('do_items')
        .update({ unit_price, amount }).eq('do_header_id', currentViewDOId).eq('item_name', name).select('id');
      if (error) throw error;
      (d.items || []).forEach(i => { if (i.name === name) { i.unitPrice = unit_price; i.amount = amount; } });
    }

    d.doNo = doNo; d.date = headerPayload.do_date; d.customer = cust;
    d.customerAddress = headerPayload.customer_address;
    d.salesperson = headerPayload.salesperson; d.machine = headerPayload.machine;
    d.headerText = headerPayload.header_text;

    setDODocEditable(false);
    renderDOHistory();
    toast('บันทึกการแก้ไขใบ DO สำเร็จ', 'success');
  } catch (err) {
    toast('บันทึกล้มเหลว: ' + err.message, 'error');
  } finally { btn.disabled = false; }
}

async function deleteDO(id) {
  const d = doHistory.find(x => x.id === id); if (!d) return;
  if (!confirm(`ลบใบ DO เลขที่: ${d.doNo}?`)) return;

  // ของในใบยังถูกตัดสต็อกอยู่ — ต้องให้คนตัดสินใจเอง ว่าออกใบผิด (คืนของ) หรือส่งไปแล้วจริง (ไม่คืน)
  // ตัดสินใจแทนไม่ได้ทั้งสองทาง เพราะเดาผิดแล้วสต็อกเพี้ยนทันที
  // รายการจากอะไหล่ (ไม่มี SN) ไม่อยู่ใน stock อยู่แล้ว ตัดออกก่อนกันเทียบเพี้ยนเป็น "null"
  // — อะไหล่ไม่คืนยอดตรงนี้ แต่กลับเข้าคิวรอออกใบ (ดูท้ายฟังก์ชัน) ยกเลิกขายที่คิวถ้าต้องการคืนยอด
  const sns = (d.items || []).filter(i => i.sn != null).map(i => String(i.sn));
  const stillOut = stock.filter(i => sns.includes(String(i.sn)) && i.status === 'Sold');
  let restore = false;
  if (stillOut.length) {
    restore = confirm(
      `ใบนี้มีสินค้าที่ยังตัดสต็อกอยู่ ${stillOut.length} ชิ้น\n\n` +
      `[ตกลง] = คืนกลับเข้าคลังเป็น "พร้อมใช้" — ใช้เมื่อออกใบผิด ของยังไม่ได้ส่ง\n` +
      `[ยกเลิก] = ลบแค่ใบ ของยังเป็น "โอน/ขาย" ตามเดิม — ใช้เมื่อของส่งไปแล้วจริง`
    );
  }

  try {
    const { error } = await supaClient.from('do_headers').delete().eq('id', id); // do_items ลบตามด้วย cascade
    if (error) throw error;

    if (restore && stillOut.length) {
      const back = { status: 'Available', dispatched_at: null, dispatched_to: null };
      const wonBack = await updateInventoryIf(stillOut.map(i => i.id), back, [['status', 'eq', 'Sold']]);
      const lostBack = stillOut.filter(i => !wonBack.has(i.id));
      if (lostBack.length) toast(`⚠️ คืนของไม่ได้ ${lostBack.length} ชิ้น — มีคนอื่นย้ายไปก่อน: ${lostBack.map(i => i.sn).join(', ')}`, 'warning');
      for (const item of stillOut.filter(i => wonBack.has(i.id))) {
        Object.assign(item, back);
        await logTransaction(today(), '♻️ คืนสต็อก', item.name, item.code, item.sn, getBalance(item.code), `ลบใบ ${d.doNo} แล้วคืนของเข้าคลัง`);
      }
    }

    // อะไหล่ในใบนี้ตัดยอดไปแล้วตั้งแต่ตอนขาย — ลบใบแล้วให้กลับไปรอออกใบใหม่ (หรือกดยกเลิกขายที่คิวเพื่อคืนยอด)
    let backToQueue = 0;
    if ((d.items || []).some(i => i.sn == null) && !partSaleSchemaMissing) {
      const { data: rel } = await supaClient.from('part_moves').update({ do_header_id: null }).eq('do_header_id', id).select('id');
      backToQueue = (rel || []).length;
      if (backToQueue) { await loadPartSaleQueue(); renderPartsDOQueue(); }
    }

    doHistory = doHistory.filter(x => x.id !== id);
    renderDOHistory(); updateDOBadge(); filterStock(); renderOutboundHistory(); checkAlerts();
    toast((restore ? `ลบใบ DO และคืนของ ${stillOut.length} ชิ้นเข้าคลังแล้ว` : 'ลบใบ DO สำเร็จ')
      + (backToQueue ? ` — อะไหล่ ${backToQueue} รายการกลับไปรอออกใบ DO ใหม่` : ''), 'info');
  } catch (err) { toast('ลบล้มเหลว: ' + err.message, 'error'); }
}
