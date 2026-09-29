// ══════════════════════════════════════════════════════════════
//  BACKUP / RESTORE
// ══════════════════════════════════════════════════════════════
// PostgREST คืนได้ไม่เกินราว 1000 แถวต่อครั้ง — ต้องวนทีละหน้า ไม่งั้นไฟล์ backup ขาดแบบเงียบๆ
// เรียงจากเก่าไปใหม่ แถวที่เพิ่มเข้ามาระหว่างดึงจะไปต่อท้าย หน้าก่อนหน้าจึงไม่เลื่อน
async function fetchAllRows(table) {
  const CHUNK = 1000, rows = [];
  for (let from = 0; ; from += CHUNK) {
    const { data, error } = await supaClient.from(table).select('*')
      .order('created_at').order('id').range(from, from + CHUNK - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < CHUNK) return rows;
  }
}

// ประวัติเคลื่อนไหวกับประวัติอะไหล่บนจอโหลดมาแค่ชุดแรก และอะไหล่เคยไม่ได้อยู่ในไฟล์เลย
// จึงดึงสามตารางนี้จากฐานข้อมูลใหม่ให้ครบ ดึงไม่ได้ก็ไม่ออกไฟล์ — ไฟล์ที่ดูครบแต่ขาดอันตรายกว่า
async function exportBackup() {
  const btn = document.getElementById('backup-btn');
  if (btn) btn.disabled = true;
  try {
    const [txAll, partsAll, movesAll] = await Promise.all([
      fetchAllRows('transactions'),
      partsTableMissing ? [] : fetchAllRows('parts'),
      partsTableMissing ? [] : fetchAllRows('part_moves'),
    ]);
    const data = { version: 'supabase-2', exportedAt: nowISO(), stock, txns: txAll.map(mapTxRow), masterProds, customers,
                   repairJobs, doHistory, grnHistory, parts: partsAll, partMoves: movesAll };
    const b = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `backup_${today()}.json`; a.click();
    toast(`Export แล้ว — สินค้า ${stock.length}, ประวัติ ${txAll.length}, อะไหล่ ${partsAll.length}, ประวัติอะไหล่ ${movesAll.length} รายการ`, 'success');
  } catch (err) {
    toast('Export Backup ไม่สำเร็จ ยังไม่ได้บันทึกไฟล์: ' + err.message, 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

function renderBackupStats() {
  document.getElementById('backup-stats').innerHTML = `
    <div style="background:var(--s2);padding:10px;border-radius:4px">สินค้าในระบบ: <b>${stock.length}</b></div>
    <div style="background:var(--s2);padding:10px;border-radius:4px">ประวัติเคลื่อนไหว: <b>${txns.length}</b></div>
    <div style="background:var(--s2);padding:10px;border-radius:4px">งานซ่อมรวม: <b>${repairJobs.length}</b></div>
    <div style="background:var(--s2);padding:10px;border-radius:4px">ใบ DO รวม: <b>${doHistory.length}</b></div>
    <div style="background:var(--s2);padding:10px;border-radius:4px">ใบ GRN รวม: <b>${grnHistory.length}</b></div>
    <div style="background:var(--s2);padding:10px;border-radius:4px">ต้นแบบสินค้า: <b>${masterProds.length}</b></div>
    <div style="background:var(--s2);padding:10px;border-radius:4px">ลูกค้า: <b>${customers.length}</b></div>
    <div style="background:var(--s2);padding:10px;border-radius:4px">อะไหล่: <b>${parts.length}</b></div>`;
}

// หมายเหตุ: ปุ่ม "ลบข้อมูลทั้งหมด (รีเซ็ตโรงงาน)" ถูกถอดออกแล้ว — ไม่มีใครใช้ แต่กดพลาดทีเดียวข้อมูลหายหมด
// ถ้าวันหลังจำเป็นต้องล้างข้อมูลจริงๆ ให้ทำผ่าน Supabase SQL Editor ซึ่งมีขั้นตอนกว่าและย้อนดูได้ว่าใครทำ

// หมายเหตุ: ส่วน Restore ถูกถอดออกแล้ว (24 ส.ค. 2569) — ของเดิมเลือกไฟล์ได้ ถามยืนยันได้
// แต่ไม่ได้เขียนข้อมูลกลับสักแถว ได้แค่ toast บอกให้ติดต่อแอดมิน ซึ่งหลอกให้เข้าใจว่ากู้คืนได้
// การกู้คืนจริงต้องทำผ่าน Supabase SQL Editor — หน้านี้เหลือแค่ Export อย่างเดียวให้ตรงกับความจริง
