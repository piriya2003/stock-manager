-- ══════════════════════════════════════════════════════════════
--  เพิ่มคอลัมน์ราคาต่อหน่วย/จำนวนเงิน ให้ใบ DO จำราคาไว้ได้
--  วิธีใช้: รันใน Supabase Dashboard > SQL Editor
-- ══════════════════════════════════════════════════════════════
alter table public.do_items add column if not exists unit_price numeric;
alter table public.do_items add column if not exists amount numeric;

-- ต้องมี policy "update" ด้วย ไม่งั้นการแก้ราคาจะถูก RLS ปฏิเสธเงียบๆ (คืน 200 แต่ไม่มีแถวถูกแก้)
drop policy if exists "Authenticated users can update do_items" on public.do_items;
create policy "Authenticated users can update do_items"
  on public.do_items for update to authenticated using (true) with check (true);

-- แก้ข้อมูลหัวใบ DO (เลขที่ / ลูกค้า / พนักงานขาย / PO / หมายเหตุ) ย้อนหลัง — ต้องมี policy update เช่นกัน
drop policy if exists "Authenticated users can update do_headers" on public.do_headers;
create policy "Authenticated users can update do_headers"
  on public.do_headers for update to authenticated using (true) with check (true);
