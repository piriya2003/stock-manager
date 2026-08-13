-- ══════════════════════════════════════════════════════════════
--  เพิ่ม "หมวดหมู่ย่อย" ให้ต้นแบบสินค้า (เช่น หมวดหลัก POS ↳ ย่อย สลิม)
--  วิธีใช้: รันใน Supabase Dashboard > SQL Editor
-- ══════════════════════════════════════════════════════════════
alter table public.master_products add column if not exists subcategory text;

comment on column public.master_products.subcategory is 'หมวดหมู่ย่อยใต้ category เช่น category = POS, subcategory = สลิม';
