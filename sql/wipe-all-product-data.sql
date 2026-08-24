-- ── ล้างข้อมูล "สินค้า" ทั้งหมด เพื่อเริ่มนับใหม่ ─────────────────────────
-- ลบ: สต็อกสินค้าทุกชิ้น, ประวัติการเคลื่อนไหว, ใบ DO, ใบ GRN, งานซ่อม/เคลม
-- เก็บไว้: รายชื่อลูกค้า/สาขา, ต้นแบบสินค้า, บัญชีผู้ใช้
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

truncate table
  public.inventory,
  public.repair_jobs,
  public.do_headers,
  public.do_items,
  public.grn_headers,
  public.grn_items,
  public.transactions
restart identity cascade;

-- ตรวจว่าว่างจริง (ทุกช่องต้องเป็น 0)
select
  (select count(*) from public.inventory)    as สต็อกสินค้า,
  (select count(*) from public.repair_jobs)  as งานซ่อม_เคลม,
  (select count(*) from public.do_headers)   as ใบ_do,
  (select count(*) from public.grn_headers)  as ใบ_grn,
  (select count(*) from public.transactions) as ประวัติเคลื่อนไหว,
  (select count(*) from public.customers)    as ลูกค้า_เก็บไว้,
  (select count(*) from public.master_products) as ต้นแบบสินค้า_เก็บไว้;
