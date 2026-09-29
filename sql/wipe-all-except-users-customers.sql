-- ── ล้างข้อมูลทั้งหมด เก็บไว้แค่ "บัญชีผู้ใช้" กับ "ลูกค้า" ─────────────────
-- ลบ: ต้นแบบสินค้า, สต็อกสินค้าทุกชิ้น, ประวัติเคลื่อนไหว, ใบ DO, ใบ GRN,
--     งานซ่อม/เคลม, อะไหล่ + ประวัติอะไหล่
-- เก็บไว้: บัญชีผู้ใช้ (users), รายชื่อลูกค้า (customers)
--
-- ⚠️ ทำก่อนรัน — กู้คืนไม่ได้ ⚠️
--   1. เปิดแอป → แท็บ "Backup / Restore" → กด "Export JSON Backup" เก็บไฟล์ไว้ก่อน
--   2. เช็คให้แน่ใจว่าไม่มีใครกำลังสแกน/บันทึกอะไรอยู่ตอนนี้
--
-- รันเสร็จแล้วให้ทุกคนที่เปิดแอปอยู่ ออกจากระบบ แล้วล็อกอินใหม่
-- (แอปโหลดข้อมูลตอนล็อกอินครั้งเดียว ไม่ล็อกอินใหม่จะยังเห็นข้อมูลเก่าค้างอยู่)
--
-- เลขที่ใบ DO / GRN จะเริ่มนับจาก 0001 ใหม่เองอัตโนมัติ เพราะแอปคำนวณเลขถัดไป
-- จากใบที่มีอยู่จริงในฐานข้อมูล ไม่ได้ใช้ตัวนับแยกต่างหาก
--
-- ลบ master_products ด้วย แปลว่าตอนรับของเข้าครั้งถัดไปจะไม่มีต้นแบบสินค้าให้เลือก
-- ต้องพิมพ์ชื่อ/รหัสสินค้าใหม่เองทั้งหมด

truncate table
  public.inventory,
  public.master_products,
  public.repair_jobs,
  public.do_headers,
  public.do_items,
  public.grn_headers,
  public.grn_items,
  public.transactions,
  public.parts,
  public.part_moves
restart identity cascade;

-- ตรวจว่าว่างจริง (ทุกช่องต้องเป็น 0 ยกเว้นลูกค้ากับบัญชีผู้ใช้)
select
  (select count(*) from public.inventory)        as สต็อกสินค้า,
  (select count(*) from public.master_products)  as ต้นแบบสินค้า,
  (select count(*) from public.repair_jobs)      as งานซ่อม_เคลม,
  (select count(*) from public.do_headers)       as ใบ_do,
  (select count(*) from public.grn_headers)      as ใบ_grn,
  (select count(*) from public.transactions)     as ประวัติเคลื่อนไหว,
  (select count(*) from public.parts)            as อะไหล่,
  (select count(*) from public.part_moves)       as ประวัติอะไหล่,
  (select count(*) from public.customers)        as ลูกค้า_เก็บไว้,
  (select count(*) from public.users)            as บัญชีผู้ใช้_เก็บไว้;
