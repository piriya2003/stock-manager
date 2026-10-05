-- ── ขายอะไหล่ที่ไม่มี SN แล้วออกใบ DO ได้ (เช่น รับจอมา 100 จอ นับเป็นจำนวน ไม่ยิง SN รายชิ้น) ──
--
-- ▶ รันไฟล์นี้ใน Supabase Dashboard > SQL Editor แล้วกด Run
--   รันซ้ำได้ไม่พัง — ไม่ลบ ไม่ทับข้อมูลเดิม ใบ DO เก่าที่มี SN ทุกใบไม่กระทบ
--   ถ้าเคยรันไฟล์นี้ไปแล้วรอบหนึ่ง ให้รันอีกรอบ (มีส่วนที่ 2 เพิ่มเข้ามา)
--
-- 💡 ต้องรัน sql/add-parts.sql ไปก่อนแล้ว (ต้องมีตาราง parts / part_moves อยู่ก่อน)

-- ── 1. ใบ DO เก็บ "จำนวน" แทน SN ได้ ──────────────────────────────────
-- เดิม do_items ออกแบบไว้ว่า 1 แถว = สินค้า 1 ชิ้นที่มี SN (sn ห้ามว่าง)
alter table public.do_items alter column sn drop not null;
alter table public.do_items add column if not exists qty     integer;  -- จำนวนของรายการที่ไม่มี SN (sn เป็น null)
alter table public.do_items add column if not exists part_id uuid references public.parts(id);

comment on column public.do_items.sn      is 'Serial Number ของชิ้นนั้น — null เมื่อมาจากอะไหล่ที่ไม่มี SN (ดู qty แทน)';
comment on column public.do_items.qty     is 'จำนวนของรายการที่ไม่มี SN — มีค่าคู่กับ sn เป็น null เท่านั้น';
comment on column public.do_items.part_id is 'อ้างอิงกลับไปที่อะไหล่ต้นทาง (ถ้ามาจากอะไหล่)';

-- ── 2. คิว "รอออกใบ DO" เก็บในฐานข้อมูล — ทุกเครื่องเห็นคิวเดียวกัน ─────
-- แถวขาย (type = 'ขาย') ใน part_moves จำลูกค้าไว้ และจำว่าออกใบ DO ไปแล้วหรือยัง
-- do_header_id ว่าง = ตัดขายแล้วแต่ยังไม่ออกใบ
-- ไม่ผูก foreign key กับ do_headers โดยตั้งใจ: แอปจองแถวก่อน แล้วค่อยสร้างหัวใบด้วย id เดียวกัน
-- กันสองเครื่องออกใบให้รายการเดียวกันพร้อมกัน — ตอนลบใบ แอปคืนแถวกลับเข้าคิวเอง
alter table public.part_moves add column if not exists customer_id   uuid references public.customers(id);
alter table public.part_moves add column if not exists customer_name text;
alter table public.part_moves add column if not exists do_header_id  uuid;
alter table public.part_moves add column if not exists cancelled_at  timestamptz;   -- ยกเลิกการขาย (คืนยอดแล้ว)

create index if not exists idx_part_moves_sale_queue on public.part_moves (created_at)
  where type = 'ขาย' and do_header_id is null and cancelled_at is null;

-- ต้องแก้แถวได้ (จองเข้าใบ DO / คืนเข้าคิว / ยกเลิก) — ไม่มี policy นี้ การแก้จะ "เงียบ" ไม่มี error แต่ไม่เปลี่ยนอะไร
drop policy if exists "Authenticated users can update part_moves" on public.part_moves;
create policy "Authenticated users can update part_moves"
  on public.part_moves for update to authenticated using (true) with check (true);

-- ── ตรวจว่าครบ ──
select
  (select count(*) from information_schema.columns
    where table_schema='public' and table_name='do_items' and column_name in ('qty','part_id'))                          as do_items_ครบ_2,
  (select is_nullable from information_schema.columns
    where table_schema='public' and table_name='do_items' and column_name='sn')                                        as sn_ว่างได้_YES,
  (select count(*) from information_schema.columns
    where table_schema='public' and table_name='part_moves'
      and column_name in ('customer_id','customer_name','do_header_id','cancelled_at'))                                 as part_moves_ครบ_4,
  (select count(*) from pg_policies
    where schemaname='public' and tablename='part_moves' and cmd='UPDATE')                                              as update_policy_1;
-- ควรได้ 2, YES, 4, 1
