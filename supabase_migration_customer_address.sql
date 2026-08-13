-- ══════════════════════════════════════════════════════════════
--  เก็บที่อยู่ลูกค้าไว้ในทะเบียนลูกค้า (ดึงไปพิมพ์บนหัวใบ DO อัตโนมัติ)
--  วิธีใช้: รันใน Supabase Dashboard > SQL Editor
-- ══════════════════════════════════════════════════════════════
alter table public.customers add column if not exists address text;

comment on column public.customers.address is 'ที่อยู่ + เลขผู้เสียภาษี ที่พิมพ์บนใบ DO';

-- ต้องมี policy update ด้วย ไม่งั้นการแก้ชื่อ/ที่อยู่ลูกค้าเดิมจะถูก RLS ปฏิเสธเงียบๆ
-- (PostgREST คืน 200 แต่ไม่มีแถวถูกแก้จริง)
drop policy if exists "update customers" on public.customers;
create policy "update customers"
  on public.customers for update to authenticated using (true) with check (true);
