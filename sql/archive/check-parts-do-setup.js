// ตรวจว่ารัน sql/add-do-items-qty.sql ครบไหม — ก๊อปทั้งไฟล์ไปวางใน Console ของเว็บ (F12 → Console) แล้วกด Enter
// ต้องล็อกอินในเว็บก่อน · ไม่แก้และไม่ลบข้อมูลจริงเลย (ข้อ 3 ลองเขียนแล้วให้ฐานข้อมูลปฏิเสธเอง ไม่มีอะไรถูกบันทึก)
(async () => {
  const out = [];
  const ok = (m) => out.push('✅ ' + m);
  const bad = (m) => out.push('❌ ' + m);
  const skip = (m) => out.push('➖ ' + m);

  // 1. คอลัมน์ใหม่มีครบไหม (คอลัมน์ที่ไม่มีจะได้ error 42703)
  for (const [table, cols] of [['do_items', 'qty,part_id'], ['part_moves', 'customer_id,customer_name,do_header_id,cancelled_at']]) {
    const { error } = await supaClient.from(table).select(cols).limit(1);
    error ? bad(`${table} ยังขาดคอลัมน์ (${cols}) — ${error.message}`) : ok(`${table} มีคอลัมน์ ${cols}`);
  }

  // 2. sn ว่างได้ไหม — ลองใส่รายการที่ sn ว่าง แต่อ้างใบ DO ที่ไม่มีอยู่จริง
  //    ถ้า sn ยังห้ามว่าง ฐานข้อมูลจะปฏิเสธด้วย 23502 · ถ้าว่างได้ จะไปติดที่ใบ DO ไม่มีจริง (23503) — ไม่มีแถวไหนถูกบันทึกทั้งสองกรณี
  const probe = await supaClient.from('do_items').insert({
    do_header_id: crypto.randomUUID(), item_name: '__ตรวจระบบ__', sn: null,
  });
  if (probe.error?.code === '23503') ok('do_items.sn เป็นค่าว่างได้แล้ว');
  else if (probe.error?.code === '23502') bad('do_items.sn ยังห้ามว่าง — ต้องรันบรรทัด alter column sn drop not null');
  else skip('do_items.sn ตรวจไม่ได้: ' + (probe.error ? probe.error.code + ' ' + probe.error.message : 'ไม่มี error (ไม่ควรเกิด)'));

  // 3. มีสิทธิ์แก้แถว part_moves ไหม — เขียนค่าเดิมทับตัวเอง (ไม่เปลี่ยนอะไร) แล้วดูว่าแก้โดนไหม
  //    ไม่มี policy → ได้ 0 แถวโดยไม่มี error (กับดักที่เงียบ)
  const { data: rows } = await supaClient.from('part_moves').select('id,cancelled_at').order('created_at', { ascending: false }).limit(1);
  if (!rows || !rows.length) skip('สิทธิ์แก้ part_moves: ยังไม่มีประวัติอะไหล่ให้ลอง — ลองขาย 1 ชิ้นแล้วกด ✕ ยกเลิก แทน');
  else {
    const r = await supaClient.from('part_moves').update({ cancelled_at: rows[0].cancelled_at ?? null }).eq('id', rows[0].id).select('id');
    if (r.error) bad('สิทธิ์แก้ part_moves: ' + r.error.message);
    else if (!r.data || !r.data.length) bad('แก้ part_moves ไม่ได้ (ไม่มี update policy) — รันไฟล์ SQL ให้ครบอีกรอบ');
    else ok('มีสิทธิ์แก้ part_moves (update policy ครบ)');
  }

  // 4. หน้าเว็บโหลดคิวจากฐานข้อมูลได้
  const loaded = await loadPartSaleQueue();
  loaded && !partSaleSchemaMissing ? ok(`โหลดคิวรอออกใบ DO ได้ — ตอนนี้มี ${partsDOQueue.length} รายการรอ`) : bad('หน้าเว็บโหลดคิวไม่ได้ (partSaleSchemaMissing = ' + partSaleSchemaMissing + ')');

  const allOk = out.every(l => !l.startsWith('❌'));
  console.log('\n' + out.join('\n') + '\n\n' + (allOk ? '🎉 ระบบพร้อมใช้งาน' : '⚠️ มีข้อที่ต้องแก้ — ดูบรรทัด ❌ ด้านบน'));
  return allOk;
})();
