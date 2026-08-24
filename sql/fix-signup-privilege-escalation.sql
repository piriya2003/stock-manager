-- ── 🔴 ด่วน: ปิดช่องโหว่ "สมัครเองเป็นแอดมินได้" ────────────────────────
--
-- ปัญหา (ตรวจพบ 24 ส.ค. 2569):
--   1. โปรเจกต์เปิดให้สมัครสมาชิกได้ (ยืนยันแล้วจากการทดสอบ)
--   2. trigger handle_new_user() รับค่า role มาจาก raw_user_meta_data
--      ซึ่งเป็นค่าที่ "ฝั่งผู้ใช้ส่งมาเอง" ไม่ใช่ค่าที่เซิร์ฟเวอร์กำหนด
--
-- ผลคือ ใครก็ตามที่เอา publishable key จาก js/config.js ไป (ซึ่งเปิดดูได้จากหน้าเว็บ)
-- สมัครสมาชิกพร้อมแนบ role: 'admin' มาด้วย → ได้สิทธิ์แอดมินทันที
-- ไม่ต้องรู้รหัสผ่านของใครเลย
--
-- ⚠️ ต้องทำ 2 อย่าง ทำแค่อย่างเดียวไม่พอ:
--
--   ขั้นที่ 1 — ปิดรับสมัครสมาชิก (ทำในหน้าเว็บ Supabase ไม่ใช่ SQL)
--     Dashboard → Authentication → Sign In / Providers → Email
--     → ปิด "Allow new users to sign up"
--     (พนักงานใหม่ให้แอดมินสร้างให้ที่ Authentication → Users → Add user)
--
--   ขั้นที่ 2 — รันไฟล์นี้ เพื่อไม่ให้ตั้ง role เองได้ ต่อให้เปิดรับสมัครอีกในอนาคต
--
-- รันไฟล์นี้ไม่กระทบผู้ใช้เดิม — สิทธิ์ของทุกคนที่มีอยู่แล้วยังเหมือนเดิม

-- ── แก้ trigger: บัญชีที่สมัครเข้ามาเป็น staff เสมอ ──
-- เลื่อนเป็นแอดมินต้องให้แอดมินเดิมสั่งเปลี่ยนใน public.users เท่านั้น
create or replace function public.handle_new_user()
returns trigger
set search_path = ''
as $$
begin
  insert into public.users (id, username, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    'staff'::public.user_role      -- 🔒 ไม่อ่าน role จากฝั่งผู้ใช้อีกต่อไป
  );
  return new;
end;
$$ language plpgsql security definer;

-- ── ตรวจว่ามีบัญชีแอดมินแปลกปลอมโผล่มาหรือยัง ──
-- ดูรายชื่อแอดมินทั้งหมด ถ้าเจอชื่อที่ไม่รู้จัก = มีคนใช้ช่องโหว่นี้ไปแล้ว
select
  u.username        as ชื่อผู้ใช้,
  u.role            as สิทธิ์,
  u.position        as ตำแหน่ง,
  u.created_at      as สร้างเมื่อ
from public.users u
order by (u.role = 'admin') desc, u.created_at desc;

-- ถ้าเจอบัญชีแปลกปลอม ลดสิทธิ์ทันทีด้วยคำสั่งนี้ (แก้ชื่อให้ตรงก่อนรัน)
-- แล้วไปลบบัญชีจริงที่ Dashboard → Authentication → Users
--
-- update public.users set role = 'staff'
-- where username = 'ชื่อที่ไม่รู้จัก'
-- returning username, role;
