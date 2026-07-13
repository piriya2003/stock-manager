// ══════════════════════════════════════════════════════════════
//  BACKUP / RESTORE
// ══════════════════════════════════════════════════════════════
function exportBackup() {
  const data = { version: 'supabase-1', exportedAt: nowISO(), stock, txns, masterProds, customers, repairJobs, doHistory, grnHistory };
  const b = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `backup_${today()}.json`; a.click();
}

function renderBackupStats() {
  const dz = document.getElementById('danger-zone');
  if (dz) dz.style.display = currentRole === 'admin' ? 'block' : 'none';
  document.getElementById('backup-stats').innerHTML = `
    <div style="background:var(--s2);padding:10px;border-radius:4px">สินค้าในระบบ: <b>${stock.length}</b></div>
    <div style="background:var(--s2);padding:10px;border-radius:4px">ประวัติเคลื่อนไหว: <b>${txns.length}</b></div>
    <div style="background:var(--s2);padding:10px;border-radius:4px">งานซ่อมรวม: <b>${repairJobs.length}</b></div>
    <div style="background:var(--s2);padding:10px;border-radius:4px">ใบ DO รวม: <b>${doHistory.length}</b></div>
    <div style="background:var(--s2);padding:10px;border-radius:4px">ใบ GRN รวม: <b>${grnHistory.length}</b></div>
    <div style="background:var(--s2);padding:10px;border-radius:4px">ต้นแบบสินค้า: <b>${masterProds.length}</b></div>
    <div style="background:var(--s2);padding:10px;border-radius:4px">ลูกค้า: <b>${customers.length}</b></div>`;
}

// ══════════════════════════════════════════════════════════════
//  ลบข้อมูลทั้งหมด (รีเซ็ตโรงงาน) — เฉพาะแอดมิน
// ══════════════════════════════════════════════════════════════
async function deleteAllData() {
  if (currentRole !== 'admin') return toast('เฉพาะแอดมินเท่านั้นที่ลบข้อมูลทั้งหมดได้', 'error');

  if (!confirm('⚠️ ยืนยันการลบข้อมูลทั้งหมด?\n\nจะลบสินค้าคงคลัง, ประวัติ, งานซ่อม, ใบ DO, ใบ GRN, ต้นแบบสินค้า และลูกค้าทั้งหมด\n\n⛔ กู้คืนไม่ได้!')) return;

  const answer = prompt('การกระทำนี้กู้คืนไม่ได้ หากยืนยัน ให้พิมพ์คำว่า  ลบทั้งหมด  ลงในช่องนี้:');
  if (answer === null) return;
  if (answer.trim() !== 'ลบทั้งหมด') return toast('ยกเลิก: ข้อความยืนยันไม่ถูกต้อง', 'info');

  // ลำดับการลบต้องเคารพ foreign key (ลบตารางลูกก่อนตารางแม่)
  const steps = [
    'transactions', 'do_items', 'grn_items', 'repair_jobs',
    'inventory', 'do_headers', 'grn_headers', 'master_products', 'customers',
  ];

  showSync('syncing', 'กำลังลบข้อมูลทั้งหมด...');
  try {
    for (const table of steps) {
      const { error } = await supaClient.from(table).delete().not('id', 'is', null);
      if (error) throw new Error(`ลบตาราง ${table} ล้มเหลว: ${error.message}`);
    }

    // ล้าง state ในหน่วยความจำ
    stock = []; txns = []; repairJobs = []; doHistory = []; grnHistory = [];
    masterProds = []; customers = [];
    inSession = []; outSession = [];

    // รีเฟรช UI ทุกส่วน
    refreshCustomerSelects(); renderMasterProducts(); renderCustomerList(); updateDataLists();
    renderBackupStats(); checkAlerts(); updateDOBadge(); updateGRNBadge();
    if (typeof renderInSession === 'function') renderInSession();
    if (typeof renderOutSession === 'function') renderOutSession();

    showSync('success', '✓ ลบข้อมูลทั้งหมดแล้ว');
    toast('ลบข้อมูลทั้งหมดเรียบร้อย (รีเซ็ตโรงงาน)', 'success');
  } catch (err) {
    showSync('error', '✗ ลบข้อมูลล้มเหลว');
    toast(err.message, 'error');
  }
}

// หมายเหตุ: importBackup ฝังกลับเฉพาะ inventory/repair/DO (ไม่แท็ะข้อมูล users
// เพราะผู้ใช้จัดการผ่าน Supabase Auth แยกต่างหาก ไม่สามารถ insert auth.users
// จาก frontend ด้วย anon key ได้ — เป็นมาตรการความปลอดภัยของ Supabase เอง)
function importBackup(e) {
  const f = e.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = async ev => {
    try {
      const d = JSON.parse(ev.target.result);
      if (!confirm('การ Restore จะแทนที่ข้อมูล Inventory/Repair/DO ทั้งหมด (ไม่รวมผู้ใช้งาน) ยืนยัน?')) return;
      toast('ฟีเจอร์ Restore เต็มรูปแบบสำหรับ Supabase ต้องทำผ่าน SQL โดยตรง (ป้องกันข้อมูลพังจาก frontend) — กรุณาติดต่อผู้ดูแลระบบเพื่อ Restore', 'warning');
    } catch (err) { toast('ไฟล์ backup ไม่ถูกต้อง: ' + err.message, 'error'); }
  };
  r.readAsText(f);
}
