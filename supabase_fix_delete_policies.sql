-- ══════════════════════════════════════════════════════════════
--  FIX: เพิ่มสิทธิ์ "ลบ" (DELETE policy) ให้ตารางที่ขาดไป
--  ปัญหาเดิม: transactions/repair_jobs/do_headers/do_items เปิด RLS
--  แต่ไม่มี delete policy → ลบจากเว็บไม่ได้ (เงียบๆ ไม่ error)
--  ทำให้ปุ่ม "ลบข้อมูลทั้งหมด" และปุ่มลบใบ DO ใช้ไม่ได้
--
--  วิธีใช้: copy ทั้งไฟล์นี้ไปวางรันใน Supabase Dashboard > SQL Editor
--  (ให้เฉพาะแอดมินลบได้ ใช้ฟังก์ชัน public.is_admin() ที่มีอยู่แล้ว)
-- ══════════════════════════════════════════════════════════════

drop policy if exists "Only admin can delete transactions" on public.transactions;
create policy "Only admin can delete transactions"
  on public.transactions for delete to authenticated using ( public.is_admin() );

drop policy if exists "Only admin can delete repair_jobs" on public.repair_jobs;
create policy "Only admin can delete repair_jobs"
  on public.repair_jobs for delete to authenticated using ( public.is_admin() );

drop policy if exists "Only admin can delete do_headers" on public.do_headers;
create policy "Only admin can delete do_headers"
  on public.do_headers for delete to authenticated using ( public.is_admin() );

drop policy if exists "Only admin can delete do_items" on public.do_items;
create policy "Only admin can delete do_items"
  on public.do_items for delete to authenticated using ( public.is_admin() );
