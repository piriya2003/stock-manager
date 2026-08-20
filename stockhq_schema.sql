-- ════════════════════════════════════════════════════════════════════════
--  StockHQ — Supabase (PostgreSQL) Schema  ★ ฉบับรวมไฟล์เดียว ★
--
--  ไฟล์นี้แทน snippet เก่าทั้งหมดใน SQL Editor ได้เลย
--  ✅ รันซ้ำได้ไม่พัง (idempotent) — ไม่ลบ ไม่ทับข้อมูลเดิม
--  ✅ ครอบคลุมทุกอย่างถึงวันที่ 14 ส.ค. 2026
--
--  ▶ วิธีใช้: Supabase Dashboard > SQL Editor > New query > วางทั้งไฟล์ > Run
--
--  ⚠️ ไม่รวมสคริปต์สร้างบัญชี login (มีรหัสผ่านแบบข้อความล้วน)
--     เก็บไฟล์นั้นไว้ต่างหากแบบออฟไลน์ อย่าเอาขึ้น git
-- ════════════════════════════════════════════════════════════════════════


-- ════════════════════════════════════════════════════════════════════════
--  0. Extensions
-- ════════════════════════════════════════════════════════════════════════
create extension if not exists "pgcrypto";   -- gen_random_uuid(), crypt()


-- ════════════════════════════════════════════════════════════════════════
--  1. Enum types (คุมค่าสถานะไม่ให้พิมพ์ผิด)
--     create type ไม่มี "if not exists" → ห่อ DO block ให้รันซ้ำได้
-- ════════════════════════════════════════════════════════════════════════
do $$ begin
  create type public.inventory_status as enum ('Available','Sold','Repair','Claimed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.repair_status as enum ('รอซ่อม','กำลังซ่อม','ซ่อมเสร็จ','เคลมเครื่อง');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.do_type as enum ('โอนสินค้า','ขายสินค้า','เบิกสินค้า','สินค้าเคลม/ส่งซ่อม');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.user_role as enum ('admin','staff');
exception when duplicate_object then null; end $$;

-- enum ที่สร้างไว้ตั้งแต่แรกมีแค่ 2 ค่า — เติมประเภทการจ่ายออกที่เพิ่มมาทีหลัง
-- ⚠️ ถ้า Run แล้วขึ้น "unsafe use of new value of enum type" ให้ตัด 2 บรรทัดนี้
--    ไปรันแยกเป็น query ของตัวเองก่อน 1 รอบ แล้วค่อยรันไฟล์นี้ทั้งไฟล์
alter type public.do_type add value if not exists 'เบิกสินค้า';
alter type public.do_type add value if not exists 'สินค้าเคลม/ส่งซ่อม';


-- ════════════════════════════════════════════════════════════════════════
--  2. Functions กลาง
-- ════════════════════════════════════════════════════════════════════════

-- 2.1 อัปเดต updated_at อัตโนมัติทุกครั้งที่ UPDATE
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- 2.2 เช็คสิทธิ์ admin แบบข้าม RLS (กัน infinite recursion เวลา policy อ้างตาราง users)
--     ต้องประกาศก่อน policy ทุกอันที่เรียกใช้
create or replace function public.is_admin()
returns boolean
set search_path = ''
as $$
  select exists (
    select 1 from public.users
    where id = auth.uid() and role = 'admin'
  );
$$ language sql security definer;


-- ════════════════════════════════════════════════════════════════════════
--  3. users — profile เสริมของผู้ใช้
--     รหัสผ่าน/การ login จริงอยู่ใน auth.users ของ Supabase Auth
--     id ต้องเท่ากับ auth.users.id เสมอ (ผูกกันด้วย trigger ด้านล่าง)
-- ════════════════════════════════════════════════════════════════════════
create table if not exists public.users (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    text not null unique,
  role        public.user_role not null default 'staff',
  position    text,
  created_at  timestamptz not null default now()
);

alter table public.users add column if not exists position text;

-- สร้างแถวใน public.users อัตโนมัติเมื่อมีคนสมัครผ่าน Supabase Auth
-- ⚠️ ต้องใส่ set search_path = '' + ระบุ public. ให้ครบ ไม่งั้นจะขึ้น
--    "Database error creating new user" เพราะ trigger รันในบริบทของ auth schema
create or replace function public.handle_new_user()
returns trigger
set search_path = ''
as $$
begin
  insert into public.users (id, username, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'staff'::public.user_role)
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_on_auth_user_created on auth.users;
create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ════════════════════════════════════════════════════════════════════════
--  4. master_products — ต้นแบบสินค้า
-- ════════════════════════════════════════════════════════════════════════
create table if not exists public.master_products (
  id          uuid primary key default gen_random_uuid(),
  category    text not null default 'ไม่ระบุ',
  subcategory text,                       -- หมวดหมู่ย่อยใต้ category เช่น POS ↳ สลิม
  name        text not null,
  code        text,
  created_at  timestamptz not null default now()
);

alter table public.master_products add column if not exists subcategory text;


-- ════════════════════════════════════════════════════════════════════════
--  5. customers — ลูกค้า / สาขา
-- ════════════════════════════════════════════════════════════════════════
create table if not exists public.customers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  address     text,                       -- ที่อยู่ + เลขผู้เสียภาษี ที่พิมพ์บนใบ DO
  created_at  timestamptz not null default now()
);

alter table public.customers add column if not exists address text;


-- ════════════════════════════════════════════════════════════════════════
--  6. GRN — ใบรับเข้าสินค้า (สร้างก่อน inventory เพราะ inventory อ้างถึง)
-- ════════════════════════════════════════════════════════════════════════
create table if not exists public.grn_headers (
  id          uuid primary key default gen_random_uuid(),
  grn_no      text not null unique,
  grn_date    date not null default current_date,
  supplier    text,
  po_no       text,
  lot_no      text,
  note        text,
  created_by  uuid,
  created_at  timestamptz not null default now()
);

create table if not exists public.grn_items (
  id             uuid primary key default gen_random_uuid(),
  grn_header_id  uuid not null references public.grn_headers(id) on delete cascade,
  item_name      text not null,
  item_code      text,
  item_category  text,
  sn             text not null
);


-- ════════════════════════════════════════════════════════════════════════
--  7. inventory — สินค้าคงคลัง (ตารางหลัก)
-- ════════════════════════════════════════════════════════════════════════
create table if not exists public.inventory (
  id              uuid primary key default gen_random_uuid(),
  category        text not null default 'ไม่ระบุ',
  subcategory     text,                                -- หมวดหมู่ย่อย เช่น category = POS, subcategory = สลิม
  name            text not null,
  code            text not null default '-',
  sn              text not null unique,               -- 🔒 กัน SN ซ้ำที่ระดับฐานข้อมูล
  status          public.inventory_status not null default 'Available',
  prev_sn         text,                                -- SN เดิมก่อนสลับเคลม
  claimed_at      timestamptz,
  claim_reason    text,
  replaced_by_sn  text,
  received_at     timestamptz not null default now(),  -- เวลารับเข้าคลัง
  dispatched_at   timestamptz,                         -- เวลาออกจากคลัง
  dispatched_to   text,                                -- ลูกค้า/สาขาปลายทางที่จ่ายออก
  lot_no          text,
  supplier        text,
  po_no           text,
  grn_header_id   uuid references public.grn_headers(id),
  created_by      uuid references public.users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- คอลัมน์ที่เพิ่มมาทีหลัง (ตารางที่สร้างไว้ก่อนหน้าจะได้ครบเหมือนกัน)
alter table public.inventory add column if not exists subcategory   text;
alter table public.inventory add column if not exists received_at   timestamptz not null default now();
alter table public.inventory add column if not exists dispatched_at timestamptz;
alter table public.inventory add column if not exists dispatched_to text;
alter table public.inventory add column if not exists lot_no        text;
alter table public.inventory add column if not exists supplier      text;
alter table public.inventory add column if not exists po_no         text;
alter table public.inventory add column if not exists grn_header_id uuid references public.grn_headers(id);


-- ════════════════════════════════════════════════════════════════════════
--  8. transactions — ประวัติการเคลื่อนไหว (log แบบเพิ่มอย่างเดียว)
-- ════════════════════════════════════════════════════════════════════════
create table if not exists public.transactions (
  id           bigint generated always as identity primary key,
  tx_date      date not null default current_date,
  type         text not null,   -- 'รับเข้า','โอนสินค้า','ขายสินค้า','เบิกสินค้า','ซ่อม','คืนสต็อก' ฯลฯ
  item_name    text not null,
  item_code    text,
  sn           text not null,
  balance      integer not null default 0,
  note         text,
  performed_by uuid references public.users(id),
  created_at   timestamptz not null default now()
);


-- ════════════════════════════════════════════════════════════════════════
--  9. repair_jobs — งานซ่อม / เคลม
-- ════════════════════════════════════════════════════════════════════════
create table if not exists public.repair_jobs (
  id            uuid primary key default gen_random_uuid(),
  inventory_id  uuid references public.inventory(id),
  sn            text not null,
  name          text not null,
  code          text,
  category      text,
  customer_id   uuid references public.customers(id),
  tech_name     text,
  symptom       text not null,
  status        public.repair_status not null default 'รอซ่อม',
  notes         text,
  replaced_sn   text,
  claim_reason  text,
  created_by    uuid references public.users(id),
  started_at    timestamptz,
  finished_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);


-- ════════════════════════════════════════════════════════════════════════
--  10. DO — ใบส่งสินค้า
-- ════════════════════════════════════════════════════════════════════════
create table if not exists public.do_headers (
  id               uuid primary key default gen_random_uuid(),
  do_no            text not null unique,
  do_date          date not null default current_date,
  type             public.do_type not null default 'โอนสินค้า',
  customer_id      uuid references public.customers(id),
  customer_name    text not null,   -- เก็บชื่อ ณ เวลานั้น เผื่อลูกค้าถูกลบ/เปลี่ยนชื่อ
  customer_address text,            -- ที่อยู่ / เลขผู้เสียภาษี ที่พิมพ์บนใบ
  salesperson      text,
  machine          text,
  header_text      text,
  created_by       uuid references public.users(id),
  created_at       timestamptz not null default now()
);

alter table public.do_headers add column if not exists customer_address text;

create table if not exists public.do_items (
  id            bigint generated always as identity primary key,
  do_header_id  uuid not null references public.do_headers(id) on delete cascade,
  item_name     text not null,
  item_code     text,
  item_category text,
  sn            text not null,
  unit_price    numeric,
  amount        numeric
);

alter table public.do_items add column if not exists unit_price numeric;
alter table public.do_items add column if not exists amount     numeric;


-- ════════════════════════════════════════════════════════════════════════
--  11. Index
-- ════════════════════════════════════════════════════════════════════════
create index if not exists idx_inventory_status   on public.inventory(status);
create index if not exists idx_inventory_category on public.inventory(category);
create index if not exists idx_inventory_code     on public.inventory(code);
create index if not exists idx_inventory_lot_no   on public.inventory(lot_no);
create index if not exists idx_inventory_subcat   on public.inventory(subcategory);
create index if not exists idx_transactions_sn    on public.transactions(sn);
create index if not exists idx_transactions_date  on public.transactions(tx_date desc);
create index if not exists idx_repair_status      on public.repair_jobs(status);
create index if not exists idx_repair_sn          on public.repair_jobs(sn);
create index if not exists idx_do_items_header    on public.do_items(do_header_id);
create index if not exists idx_grn_items_header   on public.grn_items(grn_header_id);


-- ════════════════════════════════════════════════════════════════════════
--  12. Trigger updated_at
-- ════════════════════════════════════════════════════════════════════════
drop trigger if exists trg_inventory_updated_at on public.inventory;
create trigger trg_inventory_updated_at
  before update on public.inventory
  for each row execute function public.set_updated_at();

drop trigger if exists trg_repair_updated_at on public.repair_jobs;
create trigger trg_repair_updated_at
  before update on public.repair_jobs
  for each row execute function public.set_updated_at();


-- ════════════════════════════════════════════════════════════════════════
--  13. กู้ลูกค้าปลายทางย้อนหลังจากใบ DO ที่เคยออกไปแล้ว
--      (เติมเฉพาะชิ้นที่ยังว่าง — รันซ้ำไม่ทับของที่แก้มือไว้)
-- ════════════════════════════════════════════════════════════════════════
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


-- ════════════════════════════════════════════════════════════════════════
--  14. Row Level Security
-- ════════════════════════════════════════════════════════════════════════
alter table public.users           enable row level security;
alter table public.master_products enable row level security;
alter table public.customers       enable row level security;
alter table public.inventory       enable row level security;
alter table public.transactions    enable row level security;
alter table public.repair_jobs     enable row level security;
alter table public.do_headers      enable row level security;
alter table public.do_items        enable row level security;
alter table public.grn_headers     enable row level security;
alter table public.grn_items       enable row level security;

-- ── ล้าง policy ชื่อเก่าที่สะสมมาจาก snippet หลายรุ่น แล้วสร้างชุดมาตรฐานชุดเดียว ──
do $$
declare p record;
begin
  for p in
    select schemaname, tablename, policyname
    from   pg_policies
    where  schemaname = 'public'
      and  tablename in ('users','master_products','customers','inventory','transactions',
                         'repair_jobs','do_headers','do_items','grn_headers','grn_items')
  loop
    execute format('drop policy if exists %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end $$;

-- users — เห็นแถวตัวเอง / admin เห็นทุกคน
create policy "Users can read their own row"
  on public.users for select to authenticated using (auth.uid() = id);
create policy "Only admin can read all users"
  on public.users for select to authenticated using ( public.is_admin() );

-- inventory — อ่าน/เพิ่ม/แก้ได้ทุกคนที่ login, ลบเฉพาะ admin
create policy "Authenticated users can read inventory"
  on public.inventory for select to authenticated using (true);
create policy "Authenticated users can write inventory"
  on public.inventory for insert to authenticated with check (true);
create policy "Authenticated users can update inventory"
  on public.inventory for update to authenticated using (true) with check (true);
create policy "Only admin can delete inventory"
  on public.inventory for delete to authenticated using ( public.is_admin() );

-- transactions — log เพิ่มได้อย่างเดียว ลบเฉพาะ admin
create policy "Authenticated users can read transactions"
  on public.transactions for select to authenticated using (true);
create policy "Authenticated users can insert transactions"
  on public.transactions for insert to authenticated with check (true);
create policy "Only admin can delete transactions"
  on public.transactions for delete to authenticated using ( public.is_admin() );

-- repair_jobs
create policy "Authenticated users can read repair_jobs"
  on public.repair_jobs for select to authenticated using (true);
create policy "Authenticated users can write repair_jobs"
  on public.repair_jobs for insert to authenticated with check (true);
create policy "Authenticated users can update repair_jobs"
  on public.repair_jobs for update to authenticated using (true) with check (true);
create policy "Only admin can delete repair_jobs"
  on public.repair_jobs for delete to authenticated using ( public.is_admin() );

-- do_headers / do_items — update จำเป็นสำหรับแก้หัวใบ + ราคาย้อนหลัง
create policy "Authenticated users can read do_headers"
  on public.do_headers for select to authenticated using (true);
create policy "Authenticated users can write do_headers"
  on public.do_headers for insert to authenticated with check (true);
create policy "Authenticated users can update do_headers"
  on public.do_headers for update to authenticated using (true) with check (true);
create policy "Only admin can delete do_headers"
  on public.do_headers for delete to authenticated using ( public.is_admin() );

create policy "Authenticated users can read do_items"
  on public.do_items for select to authenticated using (true);
create policy "Authenticated users can write do_items"
  on public.do_items for insert to authenticated with check (true);
create policy "Authenticated users can update do_items"
  on public.do_items for update to authenticated using (true) with check (true);
create policy "Only admin can delete do_items"
  on public.do_items for delete to authenticated using ( public.is_admin() );

-- grn_headers / grn_items
create policy "Authenticated users can read grn_headers"
  on public.grn_headers for select to authenticated using (true);
create policy "Authenticated users can write grn_headers"
  on public.grn_headers for insert to authenticated with check (true);
create policy "Authenticated users can update grn_headers"
  on public.grn_headers for update to authenticated using (true) with check (true);
create policy "Only admin can delete grn_headers"
  on public.grn_headers for delete to authenticated using ( public.is_admin() );

create policy "Authenticated users can read grn_items"
  on public.grn_items for select to authenticated using (true);
create policy "Authenticated users can write grn_items"
  on public.grn_items for insert to authenticated with check (true);
create policy "Authenticated users can update grn_items"
  on public.grn_items for update to authenticated using (true) with check (true);
create policy "Only admin can delete grn_items"
  on public.grn_items for delete to authenticated using ( public.is_admin() );

-- master_products / customers — จัดการได้เต็ม (update จำเป็นสำหรับปุ่มแก้ไขในหน้าข้อมูลหลัก)
create policy "Authenticated users can read master_products"
  on public.master_products for select to authenticated using (true);
create policy "Authenticated users can write master_products"
  on public.master_products for insert to authenticated with check (true);
create policy "Authenticated users can update master_products"
  on public.master_products for update to authenticated using (true) with check (true);
create policy "Authenticated users can delete master_products"
  on public.master_products for delete to authenticated using (true);

create policy "Authenticated users can read customers"
  on public.customers for select to authenticated using (true);
create policy "Authenticated users can write customers"
  on public.customers for insert to authenticated with check (true);
create policy "Authenticated users can update customers"
  on public.customers for update to authenticated using (true) with check (true);
create policy "Authenticated users can delete customers"
  on public.customers for delete to authenticated using (true);


-- ════════════════════════════════════════════════════════════════════════
--  15. Comment (อ่านง่ายตอนเปิด Supabase Studio)
-- ════════════════════════════════════════════════════════════════════════
comment on table  public.inventory  is 'สินค้าคงคลังทั้งหมด — sn ต้องไม่ซ้ำ (unique constraint)';
comment on table  public.do_headers is 'หัวใบส่งของ 1 แถว ต่อ 1 ใบ DO';
comment on table  public.do_items   is 'รายการสินค้าในใบ DO แต่ละใบ — ลบ header แล้ว item ถูกลบตาม (cascade)';
comment on column public.inventory.dispatched_to        is 'ลูกค้า/สาขาปลายทางที่จ่ายออก';
comment on column public.customers.address              is 'ที่อยู่ + เลขผู้เสียภาษี ที่พิมพ์บนใบ DO';
comment on column public.master_products.subcategory    is 'หมวดหมู่ย่อยใต้ category เช่น category = POS, subcategory = สลิม';


-- ════════════════════════════════════════════════════════════════════════
--  16. ตำแหน่งงานของผู้ใช้ (แถวไหนยังไม่มีบัญชี จะข้ามไปเฉยๆ ไม่ error)
-- ════════════════════════════════════════════════════════════════════════
update public.users u set position = v.position
from (values
  ('lex','Executive'),          ('wan','HR'),              ('g','HR'),
  ('games','Sale Engineer'),    ('doll','IT Supervisor'),  ('git','IT Support'),
  ('mook','Digital Marketing'), ('earn','Accounting'),     ('sia','BD Tech'),
  ('jane','Business Support'),  ('nat','Intern'),          ('ken','Intern'),
  ('ame','Intern'),             ('m','IT helpdesk'),       ('nin','Intern')
) as v(username, position)
where u.username = v.username;


-- ════════════════════════════════════════════════════════════════════════
--  17. สรุปผลหลังรัน — ดูว่าครบไหม
-- ════════════════════════════════════════════════════════════════════════
select 'ประเภทใบ DO ที่ใช้ได้' as รายการ,
       string_agg(enumlabel, ' · ' order by enumsortorder) as ค่า
from   pg_enum where enumtypid = 'public.do_type'::regtype
union all
select 'คอลัมน์ที่เพิ่มมาทีหลัง',
       string_agg(t || '.' || c, ' · ')
from ( values
  ('inventory','dispatched_to'), ('customers','address'),
  ('master_products','subcategory'), ('do_headers','customer_address'),
  ('do_items','unit_price')
) as x(t,c)
where exists (select 1 from information_schema.columns
              where table_schema='public' and table_name=x.t and column_name=x.c)
union all
select 'สินค้าที่จ่ายออกแล้วและรู้ปลายทาง',
       count(*) filter (where dispatched_to is not null) || ' / ' || count(*) || ' ชิ้น'
from   public.inventory where status = 'Sold';
