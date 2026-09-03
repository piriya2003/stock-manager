// ══════════════════════════════════════════════════════════════
//  LIVE SYNC — ให้หน้าจอตามข้อมูลจริงโดยไม่ต้องล็อกอินใหม่
//
//  เดิมข้อมูลโหลดตอนล็อกอินครั้งเดียว สิ่งที่คนอื่นทำหลังจากนั้นเราไม่เห็นเลย
//  ของที่เพื่อนจ่ายออกไปแล้วยังขึ้นว่า "พร้อมใช้" บนจอเรา
//
//  ที่นี่ถามฐานข้อมูลทุก 30 วินาทีว่า "มีอะไรเปลี่ยนตั้งแต่ครั้งที่แล้วบ้าง"
//  โดยกรองด้วย updated_at ซึ่งฐานข้อมูลอัปเดตให้เองทุกครั้งที่มีการแก้ (trigger
//  trg_inventory_updated_at ใน stockhq_schema.sql) — ปกติจะได้ 0 แถวกลับมา
//  จึงเบามาก ไม่ได้โหลดคลังใหม่ทั้งก้อน
//
//  ทำไมไม่ใช้ Supabase Realtime: ต้องเปิดเองในแดชบอร์ด ต้องจัดการเน็ตหลุด/
//  ต่อใหม่เอง และถ้าการเชื่อมต่อตายเงียบๆ ผู้ใช้จะเชื่อว่าข้อมูลสดทั้งที่ค้าง
//  ซึ่งอันตรายกว่ารู้ตัวว่าข้อมูลเก่า วิธีนี้ถามใหม่ทุกรอบจึงไม่มีสถานะ "ตายเงียบ"
//
//  หมายเหตุ: จับ "แถวที่ถูกลบ" ไม่ได้ (ไม่มีแถวให้เห็น) แต่การลบเป็นสิทธิ์แอดมิน
//  และนานๆ ครั้ง ออกจากระบบแล้วเข้าใหม่ก็ตรงเอง
// ══════════════════════════════════════════════════════════════
const SYNC_EVERY_MS = 30000;
const SYNC_OVERLAP_MS = 5000;   // เผื่อเวลาซ้อน กันแถวที่ถูกแก้ระหว่างคิวรีหลุดหาย

let syncTimer   = null;
let lastSyncAt  = null;
let syncRunning = false;

function startLiveSync() {
  stopLiveSync();
  lastSyncAt = new Date(Date.now() - SYNC_OVERLAP_MS).toISOString();
  syncTimer = setInterval(syncChanges, SYNC_EVERY_MS);
  document.addEventListener('visibilitychange', syncOnVisible);
}

function stopLiveSync() {
  clearInterval(syncTimer);
  syncTimer = null;
  document.removeEventListener('visibilitychange', syncOnVisible);
}

// กลับมาที่แท็บนี้เมื่อไหร่ ดึงทันที ไม่ต้องรอครบ 30 วินาที
function syncOnVisible() { if (!document.hidden) syncChanges(); }

async function syncChanges() {
  if (!currentUser || syncRunning || document.hidden) return;
  syncRunning = true;
  // จับเวลาไว้ "ก่อน" ยิงคิวรี ของที่ถูกแก้ระหว่างนี้จะได้ไม่หลุดรอบถัดไป
  const mark = new Date(Date.now() - SYNC_OVERLAP_MS).toISOString();
  try {
    const { data, error } = await supaClient.from('inventory')
      .select('*').gt('updated_at', lastSyncAt).order('updated_at');
    if (error) throw error;
    lastSyncAt = mark;
    if (data && data.length) applySyncedRows(data);
  } catch (err) {
    // ล้มเหลวเงียบๆ ไม่กวนผู้ใช้ระหว่างทำงาน รอบหน้าค่อยลองใหม่
    console.warn('sync ไม่สำเร็จ:', err.message);
  } finally {
    syncRunning = false;
  }
}

// เอาแถวที่เปลี่ยนมาทับของเดิม "ในตัวเดิม" (Object.assign) ไม่ใช่สร้างก้อนใหม่
// เพราะเซสชันสแกนที่ค้างอยู่ถืออ้างอิงไปยังวัตถุเดียวกัน ถ้าเปลี่ยนก้อนจะชี้ผิดตัว
function applySyncedRows(rows) {
  let changed = 0, added = 0;
  rows.forEach(r => {
    const cur = stock.find(i => i.id === r.id);
    if (cur) {
      if (cur.status !== r.status || cur.name !== r.name || cur.dispatched_to !== r.dispatched_to) changed++;
      Object.assign(cur, r);
    } else {
      stock.unshift(r);
      added++;
    }
  });
  const n = changed + added;
  if (!n) return;

  showSync('success', `✓ อัปเดตข้อมูล ${n} รายการ`);
  // กำลังเปิดหน้าต่างแก้ไขอยู่ ไม่วาดตารางใหม่ทับ เดี๋ยวของที่กรอกค้างหาย
  if (document.querySelector('.modal-bg.open')) return;
  refreshActiveView();
}

// วาดใหม่เฉพาะหน้าที่เปิดอยู่ และต้องไม่ไปแย่งโฟกัสช่องสแกน
// (จึงไม่เรียก tab() ซึ่งมีการ focus ให้อัตโนมัติ)
function refreshActiveView() {
  const active = document.querySelector('.nav-item.active')?.id?.replace(/^nav-/, '');
  if (active === 'overview')        renderDashboard();
  else if (active === 'stock')      filterStock();
  else if (active === 'do-create')  renderOutboundHistory();
  else if (active === 'do-history') renderDOHistory();
  else if (active === 'report')     renderReport();
  checkAlerts();
  if (typeof updateDataLists === 'function') updateDataLists();
}

// ปุ่มบนแถบบน — สำหรับตอนที่อยากได้ข้อมูลสดเดี๋ยวนี้ ไม่รอครบ 30 วินาที
async function syncNow() {
  const btn = document.getElementById('sync-now-btn');
  if (btn) btn.disabled = true;
  showSync('syncing', 'กำลังตรวจข้อมูลใหม่...');
  const before = stock.length;
  await syncChanges();
  if (btn) btn.disabled = false;
  showSync('success', '✓ ข้อมูลเป็นปัจจุบันแล้ว');
  toast(stock.length > before ? `มีของใหม่เข้ามา ${stock.length - before} รายการ` : 'ข้อมูลเป็นปัจจุบันแล้ว', 'success');
}
