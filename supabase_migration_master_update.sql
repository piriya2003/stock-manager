-- ══════════════════════════════════════════════════════════════
--  ให้แก้ไขต้นแบบสินค้าเดิมได้ (เดิมมีแค่ เพิ่ม/ลบ)
--  ถ้าไม่รัน การกดแก้ไขจะถูก RLS ปฏิเสธเงียบๆ (คืน 200 แต่ไม่มีแถวถูกแก้)
--  วิธีใช้: รันใน Supabase Dashboard > SQL Editor
-- ══════════════════════════════════════════════════════════════
drop policy if exists "update master_products" on public.master_products;
create policy "update master_products"
  on public.master_products for update to authenticated using (true) with check (true);
