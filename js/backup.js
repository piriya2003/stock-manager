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

// หมายเหตุ: ส่วน Restore ถูกถอดออกแล้ว (24 ส.ค. 2569) — ของเดิมเลือกไฟล์ได้ ถามยืนยันได้
// แต่ไม่ได้เขียนข้อมูลกลับสักแถว ได้แค่ toast บอกให้ติดต่อแอดมิน ซึ่งหลอกให้เข้าใจว่ากู้คืนได้
// การกู้คืนจริงต้องทำผ่าน Supabase SQL Editor — หน้านี้เหลือแค่ Export อย่างเดียวให้ตรงกับความจริง
