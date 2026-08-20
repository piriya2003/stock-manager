-- ══════════════════════════════════════════════════════════════
--  เก็บ "หมวดหมู่ย่อย" ไว้ที่ตัวสินค้าแต่ละชิ้น (กรอกตอนรับเข้า)
--  ถ้าไม่รัน ช่องหมวดหมู่ย่อยในหน้ารับเข้าจะยังกรอกได้ แต่บันทึกไม่ลง
--  (ระบบจะเตือนให้ทราบ ไม่ทำให้การรับเข้าพัง)
--  วิธีใช้: รันใน Supabase Dashboard > SQL Editor
-- ══════════════════════════════════════════════════════════════
alter table public.inventory add column if not exists subcategory text;

comment on column public.inventory.subcategory is 'หมวดหมู่ย่อยของสินค้าชิ้นนี้ เช่น category = POS, subcategory = สลิม';

create index if not exists idx_inventory_subcategory on public.inventory(subcategory);

-- เติมย้อนหลังให้ของที่มีอยู่แล้ว โดยดูจากหมวดหมู่ย่อยของ "ต้นแบบสินค้า" ที่ชื่อตรงกัน
update public.inventory inv
set    subcategory = mp.subcategory
from   public.master_products mp
where  inv.subcategory is null
  and  mp.subcategory is not null
  and  inv.name = mp.name;

-- ดูผลว่าเติมไปได้กี่ชิ้น
select coalesce(subcategory, '(ยังไม่มีหมวดย่อย)') as หมวดหมู่ย่อย, count(*) as จำนวน
from   public.inventory
group  by subcategory
order  by count(*) desc;
