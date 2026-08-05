-- ══════════════════════════════════════════════════════════════
--  เพิ่มคอลัมน์ราคาต่อหน่วย/จำนวนเงิน ให้ใบ DO จำราคาไว้ได้
--  วิธีใช้: รันใน Supabase Dashboard > SQL Editor
-- ══════════════════════════════════════════════════════════════
alter table public.do_items add column if not exists unit_price numeric;
alter table public.do_items add column if not exists amount numeric;
