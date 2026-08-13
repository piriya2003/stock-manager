-- ══════════════════════════════════════════════════════════════
--  เก็บ "ลูกค้าปลายทาง" ไว้กับสินค้าแต่ละชิ้นที่จ่ายออก
--  คอลัมน์นี้มีในไฟล์ setup แต่ฐานข้อมูลจริงยังไม่มี โค้ดที่สั่งบันทึกเลยล้มเหลวเงียบๆ
--  ทำให้ประวัติการจ่ายออกไม่รู้ว่าของไปที่บริษัทไหน
--  วิธีใช้: รันใน Supabase Dashboard > SQL Editor (รันทีเดียวทั้งไฟล์ได้เลย)
-- ══════════════════════════════════════════════════════════════

-- 1) เพิ่มคอลัมน์
alter table public.inventory add column if not exists dispatched_to text;
comment on column public.inventory.dispatched_to is 'ลูกค้า/สาขาปลายทางที่จ่ายออก';

-- 2) กู้ข้อมูลย้อนหลังจากใบ DO ที่เคยออกไปแล้ว — ของชิ้นไหนเคยอยู่ในใบ DO ใบไหน
--    ก็ถือว่าจ่ายให้ลูกค้าตามหัวใบนั้น (ถ้าอยู่หลายใบ เอาใบที่ออกล่าสุด)
update public.inventory inv
set    dispatched_to = src.customer_name
from (
  select distinct on (di.sn) di.sn, h.customer_name
  from   public.do_items di
  join   public.do_headers h on h.id = di.do_header_id
  order  by di.sn, h.created_at desc
) src
where inv.sn = src.sn
  and inv.dispatched_to is null;

-- 3) ดูผลว่ากู้กลับมาได้กี่ชิ้น เหลือชิ้นไหนที่ยังไม่รู้ปลายทาง
--    (ของที่ตัดสต็อกออกไปโดยไม่เคยออกใบ DO จะกู้ไม่ได้ ต้องใส่เองทีหลัง)
select status,
       count(*)                                          as ทั้งหมด,
       count(dispatched_to)                              as รู้ลูกค้าแล้ว,
       count(*) filter (where dispatched_to is null)     as ยังไม่รู้ลูกค้า
from   public.inventory
group  by status
order  by status;
