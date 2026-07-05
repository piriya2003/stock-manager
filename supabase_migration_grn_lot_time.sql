-- ══════════════════════════════════════════════════════════════
--  Migration: เวลารับเข้า/ออก + เลขล็อต + ใบรับเข้าสินค้า (GRN)
--  วิธีใช้: copy ทั้งไฟล์นี้ไปวางรันใน Supabase Dashboard > SQL Editor
--  (ปลอดภัย รันซ้ำได้ ใช้ IF NOT EXISTS ทุกจุด)
-- ══════════════════════════════════════════════════════════════

-- 1) เวลารับเข้า / เวลาออกจากคลัง + เลขล็อต + supplier/PO บนตัวสินค้าแต่ละชิ้น
alter table inventory add column if not exists received_at timestamptz not null default now();
alter table inventory add column if not exists dispatched_at timestamptz;
alter table inventory add column if not exists lot_no text;
alter table inventory add column if not exists supplier text;
alter table inventory add column if not exists po_no text;

-- 2) เอกสารใบรับเข้าสินค้า (GRN) — คู่กับ do_headers/do_items ที่มีอยู่แล้วสำหรับตอนออก
create table if not exists grn_headers (
  id uuid primary key default gen_random_uuid(),
  grn_no text unique not null,
  grn_date date not null default current_date,
  supplier text,
  po_no text,
  lot_no text,
  note text,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists grn_items (
  id uuid primary key default gen_random_uuid(),
  grn_header_id uuid not null references grn_headers(id) on delete cascade,
  item_name text not null,
  item_code text,
  item_category text,
  sn text not null
);

alter table inventory add column if not exists grn_header_id uuid references grn_headers(id);

-- 3) RLS — ให้ authenticated ใช้งานได้เหมือนตารางอื่น (do_headers/do_items)
--    ถ้า policy จริงของ do_headers/do_items ไม่ได้ตั้งแบบ "authenticated เข้าถึงได้ทั้งหมด"
--    ให้เช็คด้วย: select * from pg_policies where tablename in ('do_headers','do_items');
--    แล้วปรับ policy ด้านล่างให้ตรงกัน
alter table grn_headers enable row level security;
alter table grn_items  enable row level security;

create policy "authenticated full access" on grn_headers
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on grn_items
  for all to authenticated using (true) with check (true);

-- 4) index ช่วยค้นหา/join เร็วขึ้น
create index if not exists idx_inventory_lot_no on inventory(lot_no);
create index if not exists idx_grn_items_header on grn_items(grn_header_id);
