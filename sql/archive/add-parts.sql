-- ── เพิ่มระบบ "อะไหล่" (นับเป็นจำนวน ไม่ผูก Serial Number) ──────────────
--
-- ทำไมต้องแยกตาราง ไม่ใช้ inventory เดิม:
--   inventory ออกแบบไว้ว่า 1 แถว = ของ 1 ชิ้น และ sn ห้ามซ้ำ
--   อะไหล่อย่าง RAM/จอ มีทีละหลายสิบชิ้นที่เหมือนกันหมด ไม่มี SN รายชิ้น
--   ถ้ายัดลง inventory จะต้องสร้างแถวละชิ้นพร้อม SN ปลอม — เละทั้งคลังและใบ DO
--   แยกตารางแล้วนับเป็นจำนวนตรงไปตรงมากว่า และไม่กระทบของเดิมเลย
--
-- ▶ รันไฟล์นี้ใน Supabase Dashboard > SQL Editor แล้วกด Run
--   รันซ้ำได้ไม่พัง — ไม่ลบ ไม่ทับข้อมูลเดิม
--
-- 💡 ยังไม่รันก็ใช้แอปได้ตามปกติ แค่เมนู "อะไหล่" จะขึ้นข้อความบอกให้มารันก่อน

-- ── ตารางอะไหล่ — 1 แถว = อะไหล่ 1 ชนิด (ไม่ใช่ 1 ชิ้น) ──
create table if not exists public.parts (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,                        -- ชื่ออะไหล่ เช่น "RAM DDR4 8GB Kingston"
  code        text,                                 -- รหัสอะไหล่ (ถ้ามี)
  category    text not null default 'ไม่ระบุ',       -- ประเภท เช่น RAM, จอ, คีย์บอร์ด
  unit        text not null default 'ชิ้น',          -- หน่วยนับ เช่น ชิ้น/ตัว/เส้น/ม้วน
  qty         integer not null default 0,           -- คงเหลือปัจจุบัน
  min_qty     integer not null default 0,           -- ต่ำกว่านี้ถือว่าใกล้หมด (0 = ไม่เตือน)
  note        text,
  created_by  uuid references public.users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- กันสร้างอะไหล่ชื่อซ้ำจนยอดแตกเป็นสองก้อน — ไม่สนตัวพิมพ์เล็กใหญ่และช่องว่างหัวท้าย
create unique index if not exists idx_parts_name_uniq on public.parts (lower(trim(name)));
create index if not exists idx_parts_category on public.parts (category);

-- ยอดติดลบไม่มีทางเป็นจริง — กันไว้ที่ฐานข้อมูลด้วย เผื่อมีสองคนเบิกพร้อมกัน
do $$ begin
  alter table public.parts add constraint parts_qty_non_negative check (qty >= 0);
exception when duplicate_object then null; end $$;

-- ── ประวัติการเคลื่อนไหวของอะไหล่ (เพิ่มอย่างเดียว ไม่แก้ย้อนหลัง) ──
create table if not exists public.part_moves (
  id           bigint generated always as identity primary key,
  part_id      uuid not null references public.parts(id) on delete cascade,
  move_date    date not null default current_date,
  type         text not null,                       -- 'รับเข้า' | 'เบิกใช้' | 'ปรับยอด'
  qty          integer not null,                    -- บวก = เข้า, ลบ = ออก
  balance      integer not null,                    -- คงเหลือหลังทำรายการนี้
  note         text,
  performed_by uuid references public.users(id),
  created_at   timestamptz not null default now()
);

create index if not exists idx_part_moves_part on public.part_moves (part_id, created_at desc);
create index if not exists idx_part_moves_date on public.part_moves (move_date desc);

-- ── อัปเดต updated_at อัตโนมัติ (ใช้ฟังก์ชันเดิมที่มีอยู่แล้ว) ──
drop trigger if exists trg_parts_updated_at on public.parts;
create trigger trg_parts_updated_at
  before update on public.parts
  for each row execute function public.set_updated_at();

-- ── สิทธิ์การเข้าถึง (ให้เหมือนของเดิม: พนักงานทำได้ ลบเฉพาะแอดมิน) ──
alter table public.parts       enable row level security;
alter table public.part_moves  enable row level security;

do $$
declare p record;
begin
  for p in select policyname, tablename from pg_policies
           where schemaname = 'public' and tablename in ('parts','part_moves')
  loop
    execute format('drop policy if exists %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

create policy "Authenticated users can read parts"
  on public.parts for select to authenticated using (true);
create policy "Authenticated users can write parts"
  on public.parts for insert to authenticated with check (true);
create policy "Authenticated users can update parts"
  on public.parts for update to authenticated using (true) with check (true);
create policy "Only admin can delete parts"
  on public.parts for delete to authenticated using ( public.is_admin() );

create policy "Authenticated users can read part_moves"
  on public.part_moves for select to authenticated using (true);
create policy "Authenticated users can insert part_moves"
  on public.part_moves for insert to authenticated with check (true);
create policy "Only admin can delete part_moves"
  on public.part_moves for delete to authenticated using ( public.is_admin() );

comment on table  public.parts       is 'อะไหล่ — 1 แถวคืออะไหล่ 1 ชนิด นับเป็นจำนวน ไม่ผูก Serial Number';
comment on table  public.part_moves  is 'ประวัติรับเข้า/เบิกใช้อะไหล่ — qty บวกคือเข้า ลบคือออก';
comment on column public.parts.min_qty is 'ต่ำกว่านี้ถือว่าใกล้หมด (0 = ไม่ต้องเตือน)';

-- ── ตรวจว่าสร้างครบ ──
select
  (select count(*) from information_schema.tables
    where table_schema='public' and table_name='parts')      as ตาราง_parts,
  (select count(*) from information_schema.tables
    where table_schema='public' and table_name='part_moves') as ตาราง_part_moves,
  (select count(*) from pg_policies
    where schemaname='public' and tablename in ('parts','part_moves')) as จำนวน_policy;
-- ควรได้ 1, 1, 7
