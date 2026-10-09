-- ════════════════════════════════════════════════════════════════════════
--  ให้แอดมินตั้งรหัสผ่านใหม่ให้พนักงานที่ลืมรหัส จากหน้า "จัดการผู้ใช้" ในเว็บ
--  (เพิ่ม 9 ต.ค. 2569 — รวมอยู่ใน stockhq_schema.sql หัวข้อ 3.1 ด้วยแล้ว)
--
--  วิธีใช้: ก๊อปทั้งไฟล์ไปวางใน Supabase → SQL Editor แล้วกด Run (รันซ้ำได้ ไม่พัง)
--  รันเสร็จ ตารางสุดท้ายต้องขึ้น "พร้อมใช้" 2 แถว
--
--  ทำไมต้องเป็นฟังก์ชันในฐานข้อมูล: การแก้รหัสคนอื่นต้องใช้สิทธิ์ระดับสูง
--  ซึ่งห้ามใส่ไว้ในหน้าเว็บ (ใครเปิดดูโค้ดก็เห็น) ฟังก์ชันนี้รันด้วยสิทธิ์ของฐานข้อมูลเอง
--  แต่เช็คก่อนทุกครั้งว่าคนที่กดเป็นแอดมิน — พนักงานทั่วไปเรียกแล้วจะโดนปฏิเสธ
-- ════════════════════════════════════════════════════════════════════════
create or replace function public.admin_set_password(target_user uuid, new_password text)
returns text
language plpgsql
security definer
set search_path = extensions          -- crypt() / gen_salt() ของ pgcrypto อยู่ใน schema นี้บน Supabase
as $$
declare
  uname text;
begin
  if not public.is_admin() then
    raise exception 'เฉพาะแอดมินเท่านั้นที่ตั้งรหัสให้คนอื่นได้' using errcode = '42501';
  end if;
  if new_password is null or length(new_password) < 6 then
    raise exception 'รหัสผ่านต้องมีอย่างน้อย 6 ตัว' using errcode = '22023';
  end if;

  update auth.users
     set encrypted_password = crypt(new_password, gen_salt('bf', 10)),
         updated_at = now()
   where id = target_user;
  if not found then
    raise exception 'ไม่พบบัญชีผู้ใช้นี้' using errcode = 'P0002';
  end if;

  select username into uname from public.users where id = target_user;
  return uname;
end;
$$;

-- เรียกได้เฉพาะคนที่ล็อกอินแล้ว (และในฟังก์ชันยังเช็คซ้ำว่าเป็นแอดมิน)
revoke all on function public.admin_set_password(uuid, text) from public, anon;
grant execute on function public.admin_set_password(uuid, text) to authenticated;


-- ── ตรวจผล ──
select 'ฟังก์ชัน admin_set_password' as รายการ,
       case when exists (select 1 from pg_proc where proname = 'admin_set_password') then 'พร้อมใช้' else '❌ ยังไม่มี' end as ผล
union all
select 'pgcrypto (ใช้เข้ารหัสรหัสผ่าน)',
       case when exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                         where p.proname = 'gen_salt' and n.nspname = 'extensions') then 'พร้อมใช้' else '❌ ไม่อยู่ใน schema extensions' end;
