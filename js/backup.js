// ══════════════════════════════════════════════════════════════
//  BACKUP / RESTORE
// ══════════════════════════════════════════════════════════════
function exportBackup() {
  const data = { version: 'supabase-1', exportedAt: nowISO(), stock, txns, masterProds, customers, repairJobs, doHistory, grnHistory };
  const b = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `backup_${today()}.json`; a.click();
}

function renderBackupStats() {
  document.getElementById('backup-stats').innerHTML = `
    <div style="background:var(--s2);padding:10px;border-radius:4px">สินค้าในระบบ: <b>${stock.length}</b></div>
    <div style="background:var(--s2);padding:10px;border-radius:4px">ประวัติเคลื่อนไหว: <b>${txns.length}</b></div>
    <div style="background:var(--s2);padding:10px;border-radius:4px">งานซ่อมรวม: <b>${repairJobs.length}</b></div>
    <div style="background:var(--s2);padding:10px;border-radius:4px">ใบ DO รวม: <b>${doHistory.length}</b></div>
    <div style="background:var(--s2);padding:10px;border-radius:4px">ใบ GRN รวม: <b>${grnHistory.length}</b></div>
    <div style="background:var(--s2);padding:10px;border-radius:4px">ต้นแบบสินค้า: <b>${masterProds.length}</b></div>
    <div style="background:var(--s2);padding:10px;border-radius:4px">ลูกค้า: <b>${customers.length}</b></div>`;
}

// หมายเหตุ: ปุ่ม "ลบข้อมูลทั้งหมด (รีเซ็ตโรงงาน)" ถูกถอดออกแล้ว — ไม่มีใครใช้ แต่กดพลาดทีเดียวข้อมูลหายหมด
// ถ้าวันหลังจำเป็นต้องล้างข้อมูลจริงๆ ให้ทำผ่าน Supabase SQL Editor ซึ่งมีขั้นตอนกว่าและย้อนดูได้ว่าใครทำ

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
