-- ══════════════════════════════════════════════════════════════════════════
--  StockHQ — Supabase (PostgreSQL) FULL SETUP
--  ไฟล์เดียวจบ สำหรับตั้งค่าฐานข้อมูลใหม่ตั้งแต่ต้น (โปรเจกต์เปล่า)
--
--  วิธีใช้: สร้าง Supabase project ใหม่ → SQL Editor → New query → วางทั้งไฟล์ → Run
--  รวมเวอร์ชันที่แก้บั๊กแล้วทั้งหมด: is_admin() กัน infinite recursion,
--  handle_new_user() ที่ตั้ง search_path, ตาราง/คอลัมน์ GRN·ล็อต·เวลา,
--  สิทธิ์ลบเฉพาะ admin, และคอลัมน์ตำแหน่งงาน (position)
--
--  ⚠️ ไฟล์นี้เก็บ "โครงสร้าง" อย่างเดียว — ไม่รวมการสร้างบัญชีผู้ใช้/รหัสผ่าน
--     (บัญชีสร้างผ่าน Supabase Auth หรือสคริปต์แยกที่ไม่เก็บใน repo)
-- ══════════════════════════════════════════════════════════════════════════

-- ── Extensions ────────────────────────────────────────────────────────────
create extension if not exists "pgcrypto";   -- gen_random_uuid(), crypt()

-- ── Enum types (คุมค่าสถานะไม่ให้พิมพ์ผิด) ─────────────────────────────────
do $$ begin
  create type inventory_status as enum ('Available', 'Sold', 'Repair', 'Claimed');
exception when duplicate_object then null; end $$;
do $$ begin
  create type repair_status as enum ('รอซ่อม', 'กำลังซ่อม', 'ซ่อมเสร็จ', 'เคลมเครื่อง');
exception when duplicate_object then null; end $$;
do $$ begin
  create type do_type as enum ('โอนสินค้า', 'ขายสินค้า');
exception when duplicate_object then null; end $$;
do $$ begin
  create type user_role as enum ('admin', 'staff');
exception when duplicate_object then null; end $$;

-- ── Trigger กลาง: อัปเดต updated_at อัตโนมัติทุกครั้งที่ UPDATE ─────────────
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ══════════════════════════════════════════════════════════════════════════
--  1. users — โปรไฟล์ผู้ใช้ (รหัสผ่าน/การ login จริงอยู่ใน auth.users)
-- ══════════════════════════════════════════════════════════════════════════
create table if not exists users (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    text not null unique,
  role        user_role not null default 'staff',
  position    text,                                    -- ตำแหน่งงาน เช่น HR, Executive (แสดงใต้ชื่อ)
  created_at  timestamptz not null default now()
);

-- สร้างแถวใน public.users อัตโนมัติเมื่อมีคนสมัครผ่าน Supabase Auth
-- (ตั้ง search_path='' + ระบุ public. ให้ครบ เพื่อไม่ให้ trigger หา type ไม่เจอ)
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

-- เช็คสิทธิ์ admin แบบข้าม RLS (กัน infinite recursion เวลา policy อ้าง users)
create or replace function public.is_admin()
returns boolean
set search_path = ''
as $$
  select exists (
    select 1 from public.users where id = auth.uid() and role = 'admin'
  );
$$ language sql security definer;

-- ══════════════════════════════════════════════════════════════════════════
--  2. customers / master_products
-- ══════════════════════════════════════════════════════════════════════════
create table if not exists customers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  created_at  timestamptz not null default now()
);

create table if not exists master_products (
  id          uuid primary key default gen_random_uuid(),
  category    text not null default 'ไม่ระบุ',
  subcategory text,                                   -- หมวดหมู่ย่อยใต้ category เช่น POS ↳ สลิม
  name        text not null,
  code        text,
  created_at  timestamptz not null default now()
);
alter table master_products add column if not exists subcategory text;   -- ตารางที่สร้างไว้ก่อนหน้า

-- ══════════════════════════════════════════════════════════════════════════
--  3. GRN — ใบรับเข้าสินค้า (สร้างก่อน inventory เพราะ inventory อ้างถึง)
-- ══════════════════════════════════════════════════════════════════════════
create table if not exists grn_headers (
  id          uuid primary key default gen_random_uuid(),
  grn_no      text unique not null,
  grn_date    date not null default current_date,
  supplier    text,
  po_no       text,
  lot_no      text,
  note        text,
  created_by  uuid,
  created_at  timestamptz not null default now()
);

create table if not exists grn_items (
  id            uuid primary key default gen_random_uuid(),
  grn_header_id uuid not null references grn_headers(id) on delete cascade,
  item_name     text not null,
  item_code     text,
  item_category text,
  sn            text not null
);

-- ══════════════════════════════════════════════════════════════════════════
--  4. inventory — สินค้าคงคลัง (ตารางหลัก)
-- ══════════════════════════════════════════════════════════════════════════
create table if not exists inventory (
  id              uuid primary key default gen_random_uuid(),
  category        text not null default 'ไม่ระบุ',
  name            text not null,
  code            text not null default '-',
  sn              text not null unique,               -- 🔒 กัน SN ซ้ำ
  status          inventory_status not null default 'Available',
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
  grn_header_id   uuid references grn_headers(id),
  created_by      uuid references users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_inventory_status   on inventory(status);
create index if not exists idx_inventory_category on inventory(category);
create index if not exists idx_inventory_code     on inventory(code);
create index if not exists idx_inventory_lot_no   on inventory(lot_no);

drop trigger if exists trg_inventory_updated_at on inventory;
create trigger trg_inventory_updated_at
  before update on inventory
  for each row execute function set_updated_at();

-- ══════════════════════════════════════════════════════════════════════════
--  5. transactions — ประวัติการเคลื่อนไหว (append-only log)
-- ══════════════════════════════════════════════════════════════════════════
create table if not exists transactions (
  id           bigint generated always as identity primary key,
  tx_date      date not null default current_date,
  type         text not null,
  item_name    text not null,
  item_code    text,
  sn           text not null,
  balance      integer not null default 0,
  note         text,
  performed_by uuid references users(id),
  created_at   timestamptz not null default now()
);

create index if not exists idx_transactions_sn   on transactions(sn);
create index if not exists idx_transactions_date on transactions(tx_date desc);

-- ══════════════════════════════════════════════════════════════════════════
--  6. repair_jobs — งานซ่อม / เคลม
-- ══════════════════════════════════════════════════════════════════════════
create table if not exists repair_jobs (
  id           uuid primary key default gen_random_uuid(),
  inventory_id uuid references inventory(id),
  sn           text not null,
  name         text not null,
  code         text,
  category     text,
  customer_id  uuid references customers(id),
  tech_name    text,
  symptom      text not null,
  status       repair_status not null default 'รอซ่อม',
  notes        text,
  replaced_sn  text,
  claim_reason text,
  created_by   uuid references users(id),
  started_at   timestamptz,
  finished_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_repair_status on repair_jobs(status);
create index if not exists idx_repair_sn     on repair_jobs(sn);

drop trigger if exists trg_repair_updated_at on repair_jobs;
create trigger trg_repair_updated_at
  before update on repair_jobs
  for each row execute function set_updated_at();

-- ══════════════════════════════════════════════════════════════════════════
--  7. do_headers / do_items — ใบส่งของ (DO)
-- ══════════════════════════════════════════════════════════════════════════
create table if not exists do_headers (
  id            uuid primary key default gen_random_uuid(),
  do_no         text not null unique,
  do_date       date not null default current_date,
  type          do_type not null default 'โอนสินค้า',
  customer_id      uuid references customers(id),
  customer_name    text not null,
  customer_address text,                              -- ที่อยู่ / เลขผู้เสียภาษี ที่พิมพ์บนใบ DO
  salesperson   text,
  machine       text,
  header_text   text,
  created_by    uuid references users(id),
  created_at    timestamptz not null default now()
);

create table if not exists do_items (
  id            bigint generated always as identity primary key,
  do_header_id  uuid not null references do_headers(id) on delete cascade,
  item_name     text not null,
  item_code     text,
  item_category text,
  sn            text not null,
  unit_price    numeric,
  amount        numeric
);

create index if not exists idx_do_items_header  on do_items(do_header_id);
create index if not exists idx_grn_items_header on grn_items(grn_header_id);

-- ══════════════════════════════════════════════════════════════════════════
--  8. Row Level Security — เปิดทุกตาราง
-- ══════════════════════════════════════════════════════════════════════════
alter table users           enable row level security;
alter table master_products enable row level security;
alter table customers       enable row level security;
alter table inventory       enable row level security;
alter table transactions    enable row level security;
alter table repair_jobs     enable row level security;
alter table do_headers      enable row level security;
alter table do_items        enable row level security;
alter table grn_headers     enable row level security;
alter table grn_items       enable row level security;

-- ── users: อ่านแถวตัวเองได้ / admin อ่านได้ทุกแถว ──
drop policy if exists "Users can read their own row" on users;
create policy "Users can read their own row"
  on users for select to authenticated using (auth.uid() = id);
drop policy if exists "Only admin can read all users" on users;
create policy "Only admin can read all users"
  on users for select to authenticated using (public.is_admin());

-- ── inventory: authenticated อ่าน/เพิ่ม/แก้ได้ / ลบเฉพาะ admin ──
drop policy if exists "read inventory"   on inventory;
drop policy if exists "insert inventory" on inventory;
drop policy if exists "update inventory" on inventory;
drop policy if exists "delete inventory" on inventory;
create policy "read inventory"   on inventory for select to authenticated using (true);
create policy "insert inventory" on inventory for insert to authenticated with check (true);
create policy "update inventory" on inventory for update to authenticated using (true);
create policy "delete inventory" on inventory for delete to authenticated using (public.is_admin());

-- ── transactions: อ่าน/เพิ่มได้ / ลบเฉพาะ admin ──
drop policy if exists "read transactions"   on transactions;
drop policy if exists "insert transactions" on transactions;
drop policy if exists "delete transactions" on transactions;
create policy "read transactions"   on transactions for select to authenticated using (true);
create policy "insert transactions" on transactions for insert to authenticated with check (true);
create policy "delete transactions" on transactions for delete to authenticated using (public.is_admin());

-- ── repair_jobs: อ่าน/เพิ่ม/แก้ได้ / ลบเฉพาะ admin ──
drop policy if exists "read repair_jobs"   on repair_jobs;
drop policy if exists "insert repair_jobs" on repair_jobs;
drop policy if exists "update repair_jobs" on repair_jobs;
drop policy if exists "delete repair_jobs" on repair_jobs;
create policy "read repair_jobs"   on repair_jobs for select to authenticated using (true);
create policy "insert repair_jobs" on repair_jobs for insert to authenticated with check (true);
create policy "update repair_jobs" on repair_jobs for update to authenticated using (true);
create policy "delete repair_jobs" on repair_jobs for delete to authenticated using (public.is_admin());

-- ── do_headers / do_items: อ่าน/เพิ่มได้ / ลบเฉพาะ admin ──
drop policy if exists "read do_headers"   on do_headers;
drop policy if exists "insert do_headers" on do_headers;
drop policy if exists "update do_headers" on do_headers;
drop policy if exists "delete do_headers" on do_headers;
create policy "read do_headers"   on do_headers for select to authenticated using (true);
create policy "insert do_headers" on do_headers for insert to authenticated with check (true);
create policy "update do_headers" on do_headers for update to authenticated using (true) with check (true);  -- แก้ข้อมูลหัวใบ DO ย้อนหลัง
create policy "delete do_headers" on do_headers for delete to authenticated using (public.is_admin());

drop policy if exists "read do_items"   on do_items;
drop policy if exists "insert do_items" on do_items;
drop policy if exists "update do_items" on do_items;
drop policy if exists "delete do_items" on do_items;
create policy "read do_items"   on do_items for select to authenticated using (true);
create policy "insert do_items" on do_items for insert to authenticated with check (true);
create policy "update do_items" on do_items for update to authenticated using (true) with check (true);  -- แก้ราคาต่อหน่วย/จำนวนเงิน
create policy "delete do_items" on do_items for delete to authenticated using (public.is_admin());

-- ── grn_headers / grn_items: อ่าน/เพิ่มได้ / ลบเฉพาะ admin ──
drop policy if exists "read grn_headers"   on grn_headers;
drop policy if exists "insert grn_headers" on grn_headers;
drop policy if exists "delete grn_headers" on grn_headers;
create policy "read grn_headers"   on grn_headers for select to authenticated using (true);
create policy "insert grn_headers" on grn_headers for insert to authenticated with check (true);
create policy "delete grn_headers" on grn_headers for delete to authenticated using (public.is_admin());

drop policy if exists "read grn_items"   on grn_items;
drop policy if exists "insert grn_items" on grn_items;
drop policy if exists "delete grn_items" on grn_items;
create policy "read grn_items"   on grn_items for select to authenticated using (true);
create policy "insert grn_items" on grn_items for insert to authenticated with check (true);
create policy "delete grn_items" on grn_items for delete to authenticated using (public.is_admin());

-- ── master_products / customers: authenticated จัดการได้เต็ม ──
drop policy if exists "read master_products"   on master_products;
drop policy if exists "insert master_products" on master_products;
drop policy if exists "delete master_products" on master_products;
create policy "read master_products"   on master_products for select to authenticated using (true);
create policy "insert master_products" on master_products for insert to authenticated with check (true);
create policy "delete master_products" on master_products for delete to authenticated using (true);

drop policy if exists "read customers"   on customers;
drop policy if exists "insert customers" on customers;
drop policy if exists "delete customers" on customers;
create policy "read customers"   on customers for select to authenticated using (true);
create policy "insert customers" on customers for insert to authenticated with check (true);
create policy "delete customers" on customers for delete to authenticated using (true);

-- ══════════════════════════════════════════════════════════════════════════
--  Comments
-- ══════════════════════════════════════════════════════════════════════════
comment on table inventory  is 'สินค้าคงคลังทั้งหมด — sn ต้องไม่ซ้ำ (unique)';
comment on table do_headers is 'หัวใบส่งของ 1 แถว ต่อ 1 ใบ DO';
comment on table do_items   is 'รายการสินค้าในใบ DO — ลบ header แล้ว item ลบตาม (cascade)';
comment on table grn_headers is 'หัวใบรับเข้าสินค้า (GRN)';
comment on table grn_items   is 'รายการสินค้าในใบ GRN — ลบ header แล้ว item ลบตาม (cascade)';

-- ══════════════════════════════════════════════════════════════════════════
--  หลังรันไฟล์นี้: สร้างบัญชีผู้ใช้ผ่าน Supabase Dashboard > Authentication > Add user
--  (email = ชื่อผู้ใช้ + '@stockhq.local', ติ๊ก Auto Confirm) trigger จะสร้างแถว
--  ใน public.users ให้เอง — แล้วตั้ง role/position ด้วย UPDATE public.users ...
-- ══════════════════════════════════════════════════════════════════════════
