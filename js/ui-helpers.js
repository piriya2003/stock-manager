// ══════════════════════════════════════════════════════════════
//  SYNC INDICATOR (เหลือไว้ใช้แสดงสถานะ "กำลังบันทึก" จริงๆ)
// ══════════════════════════════════════════════════════════════
let syncHideTimer = null;
function showSync(state, text) {
  const el = document.getElementById('sync-indicator');
  const dot = document.getElementById('sync-dot');
  const txt = document.getElementById('sync-text');
  el.className = state; // syncing | error | success
  dot.className = 'sync-dot' + (state === 'syncing' ? ' pulse' : '');
  txt.textContent = text;
  clearTimeout(syncHideTimer);
  if (state !== 'syncing') {
    syncHideTimer = setTimeout(() => { el.className = ''; }, 2500);
  }
}

// ══════════════════════════════════════════════════════════════
//  BARCODE FILTER
// ══════════════════════════════════════════════════════════════
function filterBarcode(rawVal, msgElementId) {
  let cleanVal = rawVal.trim().replace(/^\*+|\*+$/g, '');
  if (!cleanVal) return null;
  // เครื่องสแกนพิมพ์ตามตำแหน่งปุ่มเหมือนคีย์บอร์ด ถ้าเครื่องตั้งภาษาไทยไว้ตอนสแกน
  // ตัวอักษร/ตัวเลขจะกลายเป็นภาษาไทยแทน (เช่น "คคถาุตก/-ถจฎ") ต้องกันไว้ไม่ให้บันทึก SN ผิดเข้าระบบ
  if (/[฀-๿]/.test(cleanVal)) {
    inlineMsg(msgElementId, '⚠️ สแกนได้เป็นภาษาไทย — เปลี่ยนภาษาคีย์บอร์ดเครื่องเป็นอังกฤษ (EN) แล้วสแกนใหม่', false);
    return null;
  }
  if (cleanVal.length === 12 && cleanVal.startsWith('567')) {
    inlineMsg(msgElementId, '⚠️ สแกนโดนรหัส SKU กรุณาสแกน Serial No. (บาร์โค้ดด้านล่าง)', false);
    return null;
  }
  return cleanVal;
}

// ══════════════════════════════════════════════════════════════
//  UI HELPERS
// ══════════════════════════════════════════════════════════════
function toast(msg, type = 'info') {
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
  el.textContent = (icons[type] || '') + ' ' + msg;
  const c = document.getElementById('toast-area');
  c.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(() => el.remove(), 300); }, 3200);
}

function tab(name) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  const nb = document.getElementById('nav-' + name);
  if (nb) nb.classList.add('active');
  if (name === 'overview') renderDashboard();
  if (name === 'stock') { populateCatFilter(); filterStock(); }
  if (name === 'report') renderReport();
  if (name === 'maintenance') { renderRepairList(); updateRepairBadges(); }
  if (name === 'claim') renderClaimList();
  if (name === 'do-history') renderDOHistory();
  if (name === 'grn-history') renderGRNHistory();
  if (name === 'backup') renderBackupStats();
  if (name === 'inbound') { renderInSession(); setTimeout(() => document.getElementById('i-sn').focus(), 80); }
  if (name === 'outbound') setTimeout(() => document.getElementById('o-sn').focus(), 80);
  if (name === 'do-create') renderOutboundHistory();
}

function repairSubTab(name) {
  document.getElementById('rsub-intake').style.display = name === 'intake' ? 'block' : 'none';
  document.getElementById('rsub-list').style.display = name === 'list' ? 'block' : 'none';
  document.getElementById('stab-intake').classList.toggle('active', name === 'intake');
  document.getElementById('stab-list').classList.toggle('active', name === 'list');
  if (name === 'list') renderRepairList();
  if (name === 'intake') setTimeout(() => document.getElementById('r-sn').focus(), 80);
}

// ── ไอคอนเส้นสำหรับปุ่มในตาราง — วาดเป็น SVG ในโค้ดเลย ไม่ต้องโหลดจากที่อื่น ──
// อิโมจิหน้าตาต่างกันไปตามเครื่อง/ระบบปฏิบัติการ และดูไม่เป็นชุดเดียวกัน
const ICONS = {
  edit:   '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  trash:  '<path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
  undo:   '<path d="M3 7v6h6"/><path d="M3.5 13a9 9 0 1 0 2.1-6.4L3 9"/>',
  wrench: '<path d="M14.7 6.3a4 4 0 0 0 5 5l-9.4 9.4a2.1 2.1 0 0 1-3-3Z"/>',
  eye:    '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  print:  '<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6Z"/>',
};
function icon(name, size = 14) {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" style="display:block">${ICONS[name] || ''}</svg>`;
}

// เอกสาร/ประวัติเก็บแค่ id ของผู้ใช้ — แปลงกลับเป็นชื่อตอนแสดงผล
// พนักงานทั่วไปอ่านแถวของคนอื่นไม่ได้ (RLS) เลยแสดง id สั้นๆ แทน ยังพอแยกออกว่าคนละคน
function userName(id) {
  if (!id) return '—';
  return userNames[id] || (String(id).slice(0, 8) + '…');
}

function closeModal(id) { document.getElementById(id).classList.remove('open'); }

function inlineMsg(id, msg, ok) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.style.color = ok ? 'var(--green)' : 'var(--red)';
  setTimeout(() => { if (el.textContent === msg) el.textContent = ''; }, 3500);
}

// เลขรันของเอกสาร (DO / GRN) = เลขสูงสุดที่ขึ้นต้นด้วย prefix เดียวกัน + 1
// prefix เป็นตัวกำหนดเองว่าจะให้เริ่มนับใหม่เมื่อไหร่ (DO ใช้รายเดือน, GRN ใช้รายวัน)
// เดิมนับจากจำนวนใบทั้งหมดที่มี ซึ่งพอลบใบเก่าทิ้ง เลขจะวนกลับมาชนใบที่ยังอยู่ (บันทึกไม่ผ่าน)
function nextDocNo(prefix, existingNos) {
  const maxSeq = (existingNos || []).reduce((max, no) => {
    const s = String(no || '');
    if (!s.startsWith(prefix)) return max;
    const seq = parseInt(s.slice(prefix.length), 10);
    return Number.isFinite(seq) && seq > max ? seq : max;
  }, 0);
  return prefix + String(maxSeq + 1).padStart(4, '0');
}

// "วันนี้" ต้องเป็นวันตามเวลาเครื่อง ไม่ใช่ UTC — ไทยเร็วกว่า UTC 7 ชม.
// เดิมใช้ toISOString() ก่อน 7 โมงเช้าเลยได้วันของเมื่อวาน ประวัติกับตัวกรองวันที่จึงไม่ตรงกัน
function today() { return new Date().toLocaleDateString('en-CA'); }
function nowISO() { return new Date().toISOString(); }
function nowStr() {
  const n = new Date();
  return `${String(n.getDate()).padStart(2,'0')}/${String(n.getMonth()+1).padStart(2,'0')}/${n.getFullYear()} ${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}`;
}
function fmtISO(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}
function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}
function durationStr(start, end) {
  if (!start) return '—';
  const ms = (end ? new Date(end) : new Date()) - new Date(start);
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000);
  if (h >= 24) { const d = Math.floor(h / 24); return `${d} วัน ${h % 24} ชม.`; }
  return `${h} ชม. ${m} นาที`;
}
function statusBadge(s) {
  if (s === 'Available') return '<span class="badge b-green">● พร้อมใช้</span>';
  if (s === 'Sold') return '<span class="badge b-gray">● โอน/ขาย</span>';
  if (s === 'Claimed') return '<span class="badge b-red">🔴 เคลม/ชำรุด</span>';
  return '<span class="badge b-orange">● รับซ่อม</span>';
}
function repairStatusBadge(s) {
  if (s === 'รอซ่อม') return '<span class="badge b-orange">🟡 รอซ่อม</span>';
  if (s === 'กำลังซ่อม') return '<span class="badge b-cyan">🔵 กำลังซ่อม</span>';
  if (s === 'เคลมเครื่อง') return '<span class="badge b-red">🔴 เคลมเครื่อง</span>';
  return '<span class="badge b-green">🟢 ซ่อมเสร็จ</span>';
}
function typeBadge(t) {
  if (t.includes('รับเข้า')) return '<span class="badge b-green">📥 รับเข้า</span>';
  // 2 บรรทัดนี้เทียบแบบตรงตัว ไม่ใช่ includes — ไม่งั้นไปกินรายการ 'เคลม (SN เดิม)' / 'เคลมสลับ SN' ของงานเคลมด้วย
  if (t === 'สินค้าเคลม/ส่งซ่อม') return '<span class="badge b-red">🔴 เคลม/ส่งซ่อม</span>';
  if (t === 'เบิกสินค้า') return '<span class="badge b-cyan">📦 เบิก</span>';
  if (t.includes('ซ่อม')) return '<span class="badge b-orange">🔧 ซ่อม</span>';
  if (t.includes('ขาย')) return '<span class="badge b-blue">💰 ขาย</span>';
  if (t.includes('คืน')) return '<span class="badge b-purple">♻️ คืน</span>';
  return '<span class="badge b-gray">📤 ' + t.replace('โอนสินค้า', 'โอน') + '</span>';
}
function doTypeBadge(t) {
  if (t === 'ขายสินค้า') return '<span class="badge b-blue">💰 ขาย</span>';
  if (t === 'เบิกสินค้า') return '<span class="badge b-cyan">📦 เบิก</span>';
  if (t === 'สินค้าเคลม/ส่งซ่อม') return '<span class="badge b-red">🔴 เคลม/ส่งซ่อม</span>';
  return '<span class="badge b-gray">📤 โอน</span>';
}

function checkAlerts() {
  const active = repairJobs.filter(j => j.status !== 'ซ่อมเสร็จ' && j.status !== 'เคลมเครื่อง').length;
  const bar = document.getElementById('alert-bar');
  const badge = document.getElementById('badge-repair');
  if (active > 0) {
    bar.style.display = 'flex';
    document.getElementById('alert-text').textContent = `มีงานซ่อมค้างอยู่ ${active} รายการ`;
    badge.style.display = 'inline-flex'; badge.textContent = active;
  } else { bar.style.display = 'none'; badge.style.display = 'none'; }
}

function updateRepairBadges() {
  const wait = repairJobs.filter(j => j.status === 'รอซ่อม').length;
  const wip  = repairJobs.filter(j => j.status === 'กำลังซ่อม').length;
  const t = today();
  const doneToday = repairJobs.filter(j => j.status === 'ซ่อมเสร็จ' && j.finished_at && j.finished_at.startsWith(t)).length;
  document.getElementById('badge-wait').textContent = wait + ' รอ';
  document.getElementById('badge-wip').textContent  = wip + ' กำลังซ่อม';
  document.getElementById('badge-done-today').textContent = doneToday + ' เสร็จวันนี้';
}

function updateDOBadge() {
  const badge = document.getElementById('badge-do');
  if (doHistory.length > 0) { badge.style.display = 'inline-flex'; badge.textContent = doHistory.length; }
  else badge.style.display = 'none';
}

function updateGRNBadge() {
  const badge = document.getElementById('badge-grn');
  if (!badge) return;
  if (grnHistory.length > 0) { badge.style.display = 'inline-flex'; badge.textContent = grnHistory.length; }
  else badge.style.display = 'none';
}

function updateClaimBadge() {
  const badge = document.getElementById('badge-claim');
  if (!badge) return;
  const n = repairJobs.filter(j => j.status === 'เคลมเครื่อง').length;
  if (n > 0) { badge.style.display = 'inline-flex'; badge.textContent = n; }
  else badge.style.display = 'none';
}

function updateClock() {
  const n = new Date();
  document.getElementById('clock').textContent = n.toLocaleDateString('th-TH') + ' ' + n.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
}
