-- ══════════════════════════════════════════════════════════════
--  เพิ่มประเภทการจ่ายออก: เบิกสินค้า / สินค้าเคลม-ส่งซ่อม
--  ประเภทของใบ DO เป็น enum ถ้าไม่เพิ่มค่าใหม่เข้าไปก่อน การบันทึก DO
--  ของ 2 ประเภทนี้จะ error (invalid input value for enum do_type)
--  วิธีใช้: รันใน Supabase Dashboard > SQL Editor
-- ══════════════════════════════════════════════════════════════
alter type do_type add value if not exists 'เบิกสินค้า';
alter type do_type add value if not exists 'สินค้าเคลม/ส่งซ่อม';
