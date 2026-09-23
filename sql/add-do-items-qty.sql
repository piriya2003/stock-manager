-- ── ออกใบ DO ให้อะไหล่ที่ไม่มี SN ได้ (เช่น รับจอมา 100 จอ นับเป็นจำนวน ไม่ยิง SN รายชิ้น) ──
--
-- เดิม do_items ออกแบบไว้ว่า 1 แถว = สินค้า 1 ชิ้นที่มี SN (sn ห้ามว่าง)
-- ของจากอะไหล่ไม่มี SN รายชิ้น เลยต้องมีทางเก็บ "จำนวน" แทน SN
--
-- ▶ รันไฟล์นี้ใน Supabase Dashboard > SQL Editor แล้วกด Run
--   รันซ้ำได้ไม่พัง — ไม่ลบ ไม่ทับข้อมูลเดิม ใบ DO เก่าที่มี SN ทุกใบไม่กระทบ
--
-- 💡 ต้องรัน sql/add-parts.sql ไปก่อนแล้ว (ต้องมีตาราง parts อยู่ก่อน จึงจะอ้างอิง part_id ได้)

alter table public.do_items alter column sn drop not null;
alter table public.do_items add column if not exists qty     integer;  -- จำนวนของรายการที่ไม่มี SN (sn เป็น null)
alter table public.do_items add column if not exists part_id uuid references public.parts(id);

comment on column public.do_items.sn      is 'Serial Number ของชิ้นนั้น — null เมื่อมาจากอะไหล่ที่ไม่มี SN (ดู qty แทน)';
comment on column public.do_items.qty     is 'จำนวนของรายการที่ไม่มี SN — มีค่าคู่กับ sn เป็น null เท่านั้น';
comment on column public.do_items.part_id is 'อ้างอิงกลับไปที่อะไหล่ต้นทาง (ถ้ามาจากอะไหล่)';

-- ── ตรวจว่าเพิ่มคอลัมน์สำเร็จ ──
select column_name, is_nullable, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'do_items'
order by ordinal_position;
-- ควรเห็นคอลัมน์ qty, part_id เพิ่มมา และ sn เป็น is_nullable = YES
