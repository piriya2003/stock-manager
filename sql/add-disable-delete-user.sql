-- ════════════════════════════════════════════════════════════════════════
--  ปิดบัญชี / ลบบัญชี จากหน้า "จัดการผู้ใช้" ในเว็บ — ใช้ได้คนเดียว: piriya
--    • ปิดบัญชีคนลาออก (และเปิดกลับได้)   admin_set_disabled()
--    • ลบบัญชีที่ยังไม่เคยทำรายการ          admin_delete_user()
--  (เพิ่ม 9 ต.ค. 2569 — ต้องรัน add-user-management.sql ก่อน / รวมอยู่ใน stockhq_schema.sql หัวข้อ 3.1 แล้ว)
--
--  วิธีใช้: ก๊อปทั้งไฟล์ไปวางใน Supabase → SQL Editor แล้วกด Run (รันซ้ำได้ ไม่พัง)
--  รันเสร็จ ตารางสุดท้ายต้องขึ้น "พร้อมใช้" 2 แถว
--
--  ทำไมลบได้แค่บัญชีที่ยังไม่เคยทำรายการ: ใบ DO / GRN / ประวัติ / งานซ่อม / อะไหล่ เก็บไว้ว่า "ใครทำ"
--  ฐานข้อมูลจึงไม่ยอมลบคนที่มีชื่ออยู่ในเอกสาร (ถ้ายอม ประวัติจะเหลือแต่ช่องว่าง)
--  คนลาออกให้ "ปิดบัญชี" แทน — เข้าระบบไม่ได้อีก แต่ชื่อในประวัติยังอยู่ครบ
-- ════════════════════════════════════════════════════════════════════════

-- สถานะปิดบัญชีให้หน้าเว็บอ่านได้ (ตัวที่กันล็อกอินจริงคือ banned_until ใน auth.users)
alter table public.users add column if not exists disabled boolean not null default false;


-- ── ปิด / เปิดบัญชี ──
-- ปิด = ตั้ง banned_until ไปไกลมาก → Supabase ไม่ให้ล็อกอินและไม่ต่ออายุ session
-- (ใช้ปี 2999 ไม่ใช่ 'infinity' — ตัว Supabase Auth อ่านค่า infinity ไม่ได้ ผู้ใช้คนนั้นจะล็อกอินพังแปลกๆ)
-- แล้วลบ session ที่ค้างอยู่ทิ้ง — แต่คนที่เปิดหน้าเว็บค้างไว้ยังใช้ต่อได้อีกไม่เกิน 1 ชม. จนกว่า token จะหมดอายุ
create or replace function public.admin_set_disabled(target_user uuid, make_disabled boolean)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uname text;
begin
  if not public.is_user_admin_owner() then
    raise exception 'เฉพาะ piriya เท่านั้นที่ปิดบัญชีได้' using errcode = '42501';
  end if;
  if target_user = auth.uid() then
    raise exception 'ปิดบัญชีของตัวเองไม่ได้' using errcode = '22023';
  end if;

  update auth.users
     set banned_until = case when make_disabled then '2999-12-31 00:00:00+00'::timestamptz else null end,
         updated_at = now()
   where id = target_user;
  if not found then
    raise exception 'ไม่พบบัญชีผู้ใช้นี้' using errcode = 'P0002';
  end if;

  if make_disabled then
    delete from auth.refresh_tokens where user_id = target_user::text;
    delete from auth.sessions where user_id = target_user;
  end if;

  update public.users set disabled = coalesce(make_disabled, false)
   where id = target_user
  returning username into uname;
  return uname;
end;
$$;


-- ── ลบบัญชี (เฉพาะที่ยังไม่มีชื่อในเอกสาร/ประวัติ) ──
create or replace function public.admin_delete_user(target_user uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uname text;
begin
  if not public.is_user_admin_owner() then
    raise exception 'เฉพาะ piriya เท่านั้นที่ลบบัญชีได้' using errcode = '42501';
  end if;
  if target_user = auth.uid() then
    raise exception 'ลบบัญชีของตัวเองไม่ได้' using errcode = '22023';
  end if;

  select username into uname from public.users where id = target_user;
  begin
    -- ลบใน auth.users แล้ว public.users / identities / sessions หายตาม (cascade)
    delete from auth.users where id = target_user;
    if not found then
      raise exception 'ไม่พบบัญชีผู้ใช้นี้' using errcode = 'P0002';
    end if;
  exception when foreign_key_violation then
    raise exception 'บัญชี % มีชื่ออยู่ในเอกสาร/ประวัติแล้ว ลบไม่ได้ — ใช้ "ปิดบัญชี" แทน', coalesce(uname, '')
      using errcode = '23503';
  end;
  return uname;
end;
$$;


revoke all on function public.admin_set_disabled(uuid, boolean) from public, anon;
revoke all on function public.admin_delete_user(uuid) from public, anon;
grant execute on function public.admin_set_disabled(uuid, boolean) to authenticated;
grant execute on function public.admin_delete_user(uuid) to authenticated;


-- ── ตรวจผล ──
select 'ฟังก์ชันปิด/ลบบัญชี 2 ตัว' as รายการ,
       case when (select count(distinct proname) from pg_proc
                  where proname in ('admin_set_disabled','admin_delete_user')) = 2
             and exists (select 1 from pg_proc where proname = 'is_user_admin_owner')
            then 'พร้อมใช้' else '❌ ไม่ครบ (รัน add-user-management.sql ก่อนหรือยัง?)' end as ผล
union all
select 'คอลัมน์ users.disabled',
       case when exists (select 1 from information_schema.columns
                         where table_schema = 'public' and table_name = 'users' and column_name = 'disabled')
            then 'พร้อมใช้' else '❌ ยังไม่มี' end;
